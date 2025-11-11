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

  // WebSocket URL - Construct from backend URL to ensure same domain
  const getWebSocketURL = () => {
    const backendURL = import.meta.env.REACT_APP_BACKEND_URL || import.meta.env.VITE_PROCTORING_API_URL || 'http://localhost:8001';
    // Convert http/https to ws/wss
    return backendURL.replace('https://', 'wss://').replace('http://', 'ws://');
  };
  const WS_URL = getWebSocketURL();

  // Update the ref whenever onViolation changes
  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  const connect = useCallback(() => {
    if (!enabled || !sessionId) return;

    try {
      const ws = new WebSocket(`${WS_URL}/api/ws/proctoring/${sessionId}`);
      
      ws.onopen = () => {
        console.log('Proctoring WebSocket connected');
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
        console.error('WebSocket error:', error);
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
      console.log('📤 Sending frame to backend:', {
        type: payload.type,
        frameSize: frameBase64.length,
        audioLevel,
        examId,
        studentId,
        wsState: wsRef.current.readyState
      });
      wsRef.current.send(JSON.stringify(payload));
    } else {
      console.error('❌ Cannot send frame - WebSocket not open. State:', wsRef.current?.readyState);
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

  // Connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    sendFrame,
    sendAudioLevel,
    sendBrowserActivity,
    disconnect,
  };
};
