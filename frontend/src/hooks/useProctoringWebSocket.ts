import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface ViolationData {
  type: string;
  severity: string;
  message: string;
  confidence?: number;
  timestamp: string;
  snapshot_base64?: string;
}

interface DetectionResult {
  violations: ViolationData[];
  head_pose?: any;
  face_count: number;
  looking_away: boolean;
  multiple_faces: boolean;
  no_person: boolean;
  phone_detected: boolean;
  book_detected: boolean;
  snapshot_base64?: string;
}

interface UseProctoringWebSocketOptions {
  sessionId: string;
  examId: string;
  studentId: string;
  studentName: string;
  calibratedPitch: number;
  calibratedYaw: number;
  onViolation: (violation: ViolationData) => void;
  enabled?: boolean;
}

export const useProctoringWebSocket = ({
  sessionId,
  examId,
  studentId,
  studentName,
  calibratedPitch,
  calibratedYaw,
  onViolation,
  enabled = true,
}: UseProctoringWebSocketOptions) => {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onViolationRef = useRef(onViolation);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const maxReconnectAttempts = 50;

  // WebSocket URL - Use VITE_PROCTORING_WS_URL directly or construct from API URL
  const getWebSocketURL = () => {
    // First try dedicated WebSocket URL
    if (import.meta.env.VITE_PROCTORING_WS_URL) {
      return import.meta.env.VITE_PROCTORING_WS_URL;
    }
    // Fallback: construct from API URL
    const backendURL = import.meta.env.VITE_PROCTORING_API_URL || 'http://localhost:8001';
    return backendURL.replace('https://', 'wss://').replace('http://', 'ws://');
  };
  const WS_URL = getWebSocketURL();
  
  console.log('🔌 WebSocket URL configured:', WS_URL);

  // Update the ref whenever onViolation changes
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  const connect = useCallback(() => {
    if (!enabled || !sessionId) {
      console.log('❌ Cannot connect WebSocket:', { enabled, sessionId });
      return;
    }

    try {
      const wsURL = `${WS_URL}/api/ws/proctoring/${sessionId}`;
      console.log('🔌 Attempting WebSocket connection to:', wsURL);
      const ws = new WebSocket(wsURL);
      
      ws.onopen = () => {
        console.log('✅ Proctoring WebSocket connected successfully!');
        setIsConnected(true);
        setReconnectAttempts(0);
        toast.success('Real-time monitoring active');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📥 WebSocket message received:', data);
          
          if (data.type === 'detection_result') {
            const result: DetectionResult = data.data;
            console.log('🔍 Detection result:', result);
            
            // Process violations
            if (result.violations && result.violations.length > 0) {
              console.log(`🚨 ${result.violations.length} violations detected`);
              result.violations.forEach((violation) => {
                onViolationRef.current({
                  ...violation,
                  timestamp: new Date().toISOString(),
                  snapshot_base64: result.snapshot_base64,
                });
              });
            }
          } else if (data.type === 'violation') {
            console.log('🚨 Violation message received:', data.data);
            onViolationRef.current(data.data);
          } else if (data.type === 'audio_level') {
            console.log('🔊 Audio level update:', data.data);
          } else if (data.type === 'pong') {
            // Heartbeat response
            console.log('💓 Proctoring service heartbeat OK');
          } else {
            console.log('📨 Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket connection error:', error);
        console.error('WebSocket URL was:', `${WS_URL}/api/ws/proctoring/${sessionId}`);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('Proctoring WebSocket disconnected');
        setIsConnected(false);
        
        // Attempt reconnection
        if (enabled && reconnectAttempts < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
          console.log(`Reconnecting in ${delay}ms... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          toast.error('Unable to connect to proctoring service.');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setIsConnected(false);
    }
  }, [enabled, sessionId, reconnectAttempts, WS_URL]);

  const sendFrame = useCallback((frameBase64: string, audioLevel?: number) => {
    console.log('🔍 sendFrame called with:', {
      hasWsRef: !!wsRef.current,
      wsState: wsRef.current?.readyState,
      wsStateString: wsRef.current ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsRef.current.readyState] : 'NO_WS',
      frameSize: frameBase64?.length,
      examId,
      studentId
    });
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'frame',
        frame: frameBase64,
        calibrated_pitch: calibratedPitch,
        calibrated_yaw: calibratedYaw,
        exam_id: examId,
        student_id: studentId,
        student_name: studentName,
        audio_level: audioLevel,
      };
      console.log('✅ WebSocket is OPEN - Sending frame payload');
      wsRef.current.send(JSON.stringify(payload));
      console.log('✅ Frame sent successfully!');
    } else {
      console.error('❌ CANNOT send frame - WebSocket NOT open!', {
        wsExists: !!wsRef.current,
        state: wsRef.current?.readyState,
        stateString: wsRef.current ? ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'][wsRef.current.readyState] : 'NO_WS'
      });
    }
  }, [calibratedPitch, calibratedYaw, examId, studentId, studentName]);

  const sendAudioLevel = useCallback((audioLevel: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'audio',
        audio_level: audioLevel,
        exam_id: examId,
        student_id: studentId,
        student_name: studentName,
      }));
    }
  }, [examId, studentId, studentName]);

  const sendBrowserActivity = useCallback((violationType: string, message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'browser_activity',
        violation_type: violationType,
        message: message,
        exam_id: examId,
        student_id: studentId,
        student_name: studentName,
      };
      console.log('📡 Sending browser activity to backend:', payload);
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.error('❌ Cannot send browser activity - WebSocket not open. State:', wsRef.current?.readyState);
    }
  }, [examId, studentId, studentName]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [isConnected]);

  // Connect on mount and when enabled/sessionId changes
  useEffect(() => {
    console.log('🔄 WebSocket useEffect triggered:', { enabled, sessionId, hasSessionId: !!sessionId });
    if (enabled && sessionId) {
      console.log('✅ Conditions met, attempting connection');
      connect();
    } else {
      console.log('❌ Cannot connect yet:', { enabled, sessionId });
    }
    return () => disconnect();
  }, [enabled, sessionId, connect, disconnect]);

  return {
    isConnected,
    sendFrame,
    sendAudioLevel,
    sendBrowserActivity,
    disconnect,
  };
};
