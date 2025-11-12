import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Camera, Mic, Sun, User, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

const StudentVerify = () => {
  const navigate = useNavigate();
  const [studentData, setStudentData] = useState<any>(null);
  const [checks, setChecks] = useState({
    camera: { status: 'waiting', message: 'Waiting...' },
    microphone: { status: 'waiting', message: 'Waiting...' },
    lighting: { status: 'waiting', message: 'Waiting...' },
    face: { status: 'waiting', message: 'Waiting...' },
  });
  const [verificationStarted, setVerificationStarted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [microphoneWorking, setMicrophoneWorking] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const data = sessionStorage.getItem('studentData');
    if (!data) {
      toast.error("Please register first");
      navigate('/student/register');
      return;
    }
    setStudentData(JSON.parse(data));

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [navigate]);

  const startVerification = async () => {
    setVerificationStarted(true);
    setProgress(0);

    // Step 1: Camera & Microphone Access
    setChecks(prev => ({ ...prev, camera: { status: 'checking', message: 'Requesting access...' } }));
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 }, 
        audio: true 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      streamRef.current = stream;
      setChecks(prev => ({ ...prev, camera: { status: 'success', message: 'Camera connected' } }));
      setProgress(20);

      // Microphone check - Test if audio is actually working
      setChecks(prev => ({ ...prev, microphone: { status: 'checking', message: 'Testing microphone...' } }));
      
      try {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let audioDetected = false;
        let checkCount = 0;
        const maxChecks = 30; // Check for 3 seconds (100ms * 30)
        
        // Check for audio input
        await new Promise((resolve) => {
          const checkAudio = () => {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            
            console.log(`🎤 Microphone test: audio level = ${average.toFixed(1)}`);
            
            if (average > 10) { // Threshold for detecting sound
              audioDetected = true;
              console.log('✅ Audio input detected!');
              resolve(null);
            } else {
              checkCount++;
              if (checkCount >= maxChecks) {
                console.log('❌ No audio input detected after 3 seconds');
                resolve(null);
              } else {
                setTimeout(checkAudio, 100);
              }
            }
          };
          checkAudio();
        });
        
        audioContext.close();
        
        if (audioDetected) {
          setChecks(prev => ({ ...prev, microphone: { status: 'success', message: 'Microphone working - Audio detected' } }));
          toast.success("Microphone is working properly!");
        } else {
          setChecks(prev => ({ ...prev, microphone: { status: 'warning', message: 'No audio detected - Please speak or check microphone' } }));
          toast.warning("No audio detected from microphone. Please speak to test or check your microphone settings.", {
            duration: 5000
          });
        }
      } catch (audioError) {
        console.error('Audio test error:', audioError);
        setChecks(prev => ({ ...prev, microphone: { status: 'warning', message: 'Microphone connected but not tested' } }));
      }
      
      setProgress(40);

      // Step 2: Wait for camera to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Step 3: Environment Check - Use proctoring backend service
      setChecks(prev => ({ ...prev, lighting: { status: 'checking', message: 'Analyzing environment...' } }));
      
      if (videoRef.current) {
        try {
          const PROCTORING_API_URL = import.meta.env.VITE_PROCTORING_API_URL || import.meta.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
          console.log('Starting proctoring service verification...');
          console.log('Proctoring API URL:', PROCTORING_API_URL);
          
          // Capture frame from video
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Failed to get canvas context');
          
          ctx.drawImage(videoRef.current, 0, 0);
          const frameBase64 = canvas.toDataURL('image/jpeg');
          
          // Call proctoring service environment check
          console.log('Calling environment check at:', `${PROCTORING_API_URL}/api/environment-check`);
          const envResponse = await fetch(`${PROCTORING_API_URL}/api/environment-check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ frame_base64: frameBase64 })
          });
          
          console.log('Environment check response status:', envResponse.status);
          
          if (!envResponse.ok) {
            const errorText = await envResponse.text();
            console.error('Environment check failed:', errorText);
            throw new Error(`Environment check failed: ${envResponse.status} ${errorText}`);
          }
          
          const envResult = await envResponse.json();
          console.log('Environment check result:', envResult);
          
          // Update lighting check - Show actual result
          setChecks(prev => ({ 
            ...prev, 
            lighting: { 
              status: envResult.lighting_ok ? 'success' : 'warning',
              message: envResult.lighting_ok ? 'Good lighting detected' : 'Poor lighting - Please improve lighting'
            } 
          }));
          setProgress(60);

          // Update face detection check - Show actual result
          setChecks(prev => ({ ...prev, face: { status: 'checking', message: 'Verifying face position...' } }));
          
          setChecks(prev => ({ 
            ...prev, 
            face: { 
              status: envResult.face_detected ? (envResult.face_centered ? 'success' : 'warning') : 'error',
              message: envResult.face_detected 
                ? (envResult.face_centered ? 'Face verified and centered' : 'Please center your face in the camera')
                : 'No face detected - Please position yourself in front of camera'
            } 
          }));
          setProgress(70);

          // Calibration: Get head pose for future reference
          if (envResult.face_detected) {
            const calibrationResponse = await fetch(`${PROCTORING_API_URL}/api/calibrate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ frame_base64: frameBase64 })
            });
            
            if (calibrationResponse.ok) {
              const calibration = await calibrationResponse.json();
              if (calibration.success) {
                console.log('Calibration successful:', calibration);
                sessionStorage.setItem('calibration', JSON.stringify({
                  pitch: calibration.pitch,
                  yaw: calibration.yaw
                }));
                toast.success('Proctoring system ready!');
              }
            }
          }
          
          setProgress(85);
          console.log('Proctoring service connected successfully');
          
          // Check if verification passed - MUST have face detected to proceed
          if (!envResult.face_detected) {
            toast.error("Face not detected! Please position yourself in front of the camera and try again.");
            setVerificationStarted(false);
            return; // Block exam start
          }
          
          if (!envResult.lighting_ok) {
            toast.warning("Poor lighting detected. Please improve lighting for better monitoring.");
            // Allow to proceed but warn the user
          }
          
        } catch (error) {
          console.error('Verification error:', error);
          console.error('Error details:', error instanceof Error ? error.message : String(error));
          toast.error("Connection to proctoring service failed. Please try again.");
          
          // Show actual error - don't allow proceeding with bad setup
          setChecks(prev => ({ 
            ...prev, 
            lighting: { status: 'error', message: 'Unable to verify - Service unavailable' },
            face: { status: 'error', message: 'Unable to verify - Service unavailable' }
          }));
          
          setProgress(60);
          setVerificationStarted(false);
          return; // Don't proceed to exam
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      setProgress(100);

      toast.success("Verification complete! Starting exam...");
      
      setTimeout(() => {
        navigate('/student/exam');
      }, 1500);

    } catch (error: any) {
      console.error('Verification error:', error);
      if (error.name === 'NotAllowedError') {
        setChecks(prev => ({ ...prev, camera: { status: 'error', message: 'Access denied' } }));
        toast.error("Please allow camera and microphone access");
      } else {
        toast.error("Verification failed: " + error.message);
      }
    }
  };

  const getStatusIcon = (status: string, Icon: any) => {
    const baseClass = "w-5 h-5";
    if (status === 'success') return <Icon className={`${baseClass} text-primary`} />;
    if (status === 'error') return <Icon className={`${baseClass} text-destructive`} />;
    if (status === 'checking') return <Icon className={`${baseClass} text-primary animate-pulse`} />;
    return <Icon className={`${baseClass} text-muted-foreground`} />;
  };

  if (!studentData) return null;

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-6xl py-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Camera Preview */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">Camera Preview</h2>
              <div className="aspect-video bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                {verificationStarted ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    muted 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-16 h-16 text-muted-foreground" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Verification Progress */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">Verification Progress</h2>
              
              <Progress value={progress} className="mb-6 h-3" />

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3">
                  {getStatusIcon(checks.camera.status, Camera)}
                  <div className="flex-1">
                    <p className="font-semibold">Camera Access</p>
                    <p className="text-sm text-muted-foreground">{checks.camera.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusIcon(checks.microphone.status, Mic)}
                  <div className="flex-1">
                    <p className="font-semibold">Microphone Access</p>
                    <p className="text-sm text-muted-foreground">{checks.microphone.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusIcon(checks.lighting.status, Sun)}
                  <div className="flex-1">
                    <p className="font-semibold">Lighting Conditions</p>
                    <p className="text-sm text-muted-foreground">{checks.lighting.message}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {getStatusIcon(checks.face.status, User)}
                  <div className="flex-1">
                    <p className="font-semibold">Face Detection</p>
                    <p className="text-sm text-muted-foreground">{checks.face.message}</p>
                  </div>
                </div>
              </div>

              {!verificationStarted && (
                <Button 
                  onClick={startVerification} 
                  className="w-full"
                  size="lg"
                >
                  Start Verification
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Before you start */}
        <Card className="mt-6">
          <CardContent className="p-6">
            <h3 className="font-bold mb-4">Before you start:</h3>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Ensure you're in a well-lit room
              </li>
              <li className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Position yourself at the center of the camera
              </li>
              <li className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                No other person should be visible
              </li>
              <li className="flex items-center gap-2 text-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                Remove any background noise
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentVerify;
