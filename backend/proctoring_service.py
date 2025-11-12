import cv2
import mediapipe as mp
import numpy as np
from ultralytics import YOLO
import base64
from typing import Dict, Optional, Tuple
import time
from datetime import datetime

class ProctoringService:
    """
    AI-powered proctoring service using MediaPipe and YOLOv8n
    Detects: looking away, multiple people, prohibited objects (phone, book)
    """
    
    def __init__(self):
        # Initialize MediaPipe with optimized settings for real-time performance
        self.mp_face_mesh = mp.solutions.face_mesh.FaceMesh(
            refine_landmarks=True,
            min_detection_confidence=0.3,  # Lowered for better detection
            min_tracking_confidence=0.3   # Lowered for better tracking
        )
        self.mp_face_detection = mp.solutions.face_detection.FaceDetection(
            min_detection_confidence=0.3  # Lowered for better detection
        )
        
        # Initialize YOLO model with optimized settings for real-time performance
        try:
            self.yolo_model = YOLO('models/yolov8n.pt')
            self.yolo_model.conf = 0.3  # Lowered confidence threshold for better detection
            self.yolo_model.iou = 0.5   # IoU threshold for NMS
            print("✅ YOLO model loaded successfully")
        except Exception as e:
            print(f"❌ YOLO model loading failed: {e}")
            self.yolo_model = None
        
        # 3D Model points for head pose estimation
        self.model_points = np.array([
            (0.0, 0.0, 0.0),
            (0.0, -330.0, -65.0),
            (-225.0, 170.0, -135.0),
            (225.0, 170.0, -135.0),
            (-150.0, -150.0, -125.0),
            (150.0, -150.0, -125.0)
        ], dtype=np.float64)
        
        # Thresholds (adjusted to reduce false positives - more lenient)
        self.MAX_YAW_OFFSET = 30   # Degrees - head turning left/right (increased tolerance)
        self.MAX_PITCH_OFFSET = 25  # Degrees - head tilting up/down (increased tolerance)
        
        # Looking away confidence thresholds (more strict to reduce false positives)
        self.LOOKING_AWAY_CONFIDENCE_THRESHOLD = 0.75  # Must be significantly looking away
        self.LOOKING_AWAY_SEVERITY_THRESHOLD = 0.90    # Very high threshold for "clearly" looking away
        
        # Detection confidence thresholds (optimized for real-time)
        self.OBJECT_CONFIDENCE_THRESHOLD = 0.3  # Lowered for better detection
        self.FACE_CONFIDENCE_THRESHOLD = 0.3    # Lowered for better detection
        
        # Snapshot throttle per session: only allow snapshot every 2 seconds
        self.SNAPSHOT_INTERVAL_SEC = 2.0
        self.last_snapshot_time_by_session: Dict[str, float] = {}
        
    def estimate_head_pose(self, landmarks, width: int, height: int) -> Optional[Tuple[float, float, float]]:
        """
        Estimate head pose (pitch, yaw, roll) from facial landmarks
        """
        try:
            image_points = np.array([
                (landmarks[1].x * width, landmarks[1].y * height),
                (landmarks[152].x * width, landmarks[152].y * height),
                (landmarks[33].x * width, landmarks[33].y * height),
                (landmarks[263].x * width, landmarks[263].y * height),
                (landmarks[61].x * width, landmarks[61].y * height),
                (landmarks[291].x * width, landmarks[291].y * height)
            ], dtype=np.float64)

            focal_length = width
            camera_matrix = np.array([
                [focal_length, 0, width / 2],
                [0, focal_length, height / 2],
                [0, 0, 1]
            ], dtype=np.float64)

            success, rotation_vector, _ = cv2.solvePnP(
                self.model_points, 
                image_points, 
                camera_matrix, 
                np.zeros((4, 1))
            )
            
            if not success:
                return None

            rmat, _ = cv2.Rodrigues(rotation_vector)
            angles, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
            return angles  # pitch, yaw, roll
        except Exception as e:
            print(f"Head pose estimation error: {e}")
            return None

    def is_looking_away(self, pitch: float, yaw: float, calibrated_pitch: float, calibrated_yaw: float) -> Tuple[bool, float]:
        """
        Check if user is looking away from camera based on calibrated values
        Returns (is_looking_away, confidence_score)
        
        Improved logic to reduce false positives:
        - Uses stricter thresholds
        - Considers both pitch and yaw together
        - Requires significant deviation from calibrated position
        """
        pitch_offset = abs(pitch - calibrated_pitch)
        yaw_offset = abs(yaw - calibrated_yaw)
        
        # Calculate confidence score based on how far the head is turned
        # Normalize offsets to 0-1 range
        normalized_pitch = min(pitch_offset / self.MAX_PITCH_OFFSET, 1.0)
        normalized_yaw = min(yaw_offset / self.MAX_YAW_OFFSET, 1.0)
        
        # Use weighted average favoring yaw (left/right is more significant than up/down)
        # Yaw has more weight (0.7) as looking left/right is stronger indicator
        confidence_score = (normalized_yaw * 0.7) + (normalized_pitch * 0.3)
        
        # Only trigger if:
        # 1. Confidence score meets threshold AND
        # 2. At least one axis has significant deviation (not just noise)
        significant_yaw_deviation = yaw_offset > (self.MAX_YAW_OFFSET * 0.5)  # More than 50% of max
        significant_pitch_deviation = pitch_offset > (self.MAX_PITCH_OFFSET * 0.5)
        
        is_looking_away = (confidence_score >= self.LOOKING_AWAY_CONFIDENCE_THRESHOLD and 
                          (significant_yaw_deviation or significant_pitch_deviation))
        
        return is_looking_away, confidence_score

    def detect_multiple_faces(self, detections) -> bool:
        """
        Check if multiple faces are detected
        """
        return len(detections) > 1 if detections else False

    def detect_prohibited_objects(self, frame: np.ndarray) -> Dict[str, any]:
        """
        Detect prohibited objects (cell phone, book) using YOLOv8
        Returns dict with detection info and annotated frame
        """
        detections = {
            'phone_detected': False,
            'book_detected': False,
            'objects': []
        }
        
        # Check if YOLO model is available
        if self.yolo_model is None:
            print("⚠️ YOLO model not available, skipping object detection")
            detections['annotated_frame'] = frame
            return detections
        
        try:
            # Run YOLO detection with confidence threshold
            yolo_results = self.yolo_model(
                frame, 
                stream=True, 
                verbose=False,
                conf=self.OBJECT_CONFIDENCE_THRESHOLD
            )
            
            for result in yolo_results:
                if result.boxes is None or len(result.boxes) == 0:
                    continue
                    
                for box in result.boxes:
                    cls = result.names[int(box.cls[0])]
                    confidence = float(box.conf[0])
                    
                    # Only process if confidence meets threshold
                    if confidence < self.OBJECT_CONFIDENCE_THRESHOLD:
                        continue
                    
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    
                    # Detect cell phone (including variations)
                    if cls in ["cell phone", "phone", "mobile"]:
                        detections['objects'].append({
                            'type': 'cell phone',
                            'confidence': confidence,
                            'bbox': [x1, y1, x2, y2]
                        })
                        detections['phone_detected'] = True
                        
                        # Draw bounding box
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
                        cv2.putText(frame, f"PHONE {confidence:.2f}", (x1, y1 - 10),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
                    
                    # Detect book
                    elif cls == "book":
                        detections['objects'].append({
                            'type': 'book',
                            'confidence': confidence,
                            'bbox': [x1, y1, x2, y2]
                        })
                        detections['book_detected'] = True
                        
                        # Draw bounding box
                        cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 3)
                        cv2.putText(frame, f"BOOK {confidence:.2f}", (x1, y1 - 10),
                                  cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)
        except Exception as e:
            print(f"Object detection error: {e}")
        
        detections['annotated_frame'] = frame
        return detections

    def calibrate_head_pose(self, frame: np.ndarray) -> Dict:
        """
        Calibrate head pose from a frame
        Returns calibration values
        """
        try:
            height, width, _ = frame.shape
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            face_mesh_results = self.mp_face_mesh.process(rgb_frame)
            if face_mesh_results.multi_face_landmarks:
                landmarks = face_mesh_results.multi_face_landmarks[0].landmark
                angles = self.estimate_head_pose(landmarks, width, height)
                
                if angles:
                    pitch, yaw, roll = angles
                    return {
                        'success': True,
                        'pitch': float(pitch),
                        'yaw': float(yaw),
                        'roll': float(roll)
                    }
            
            return {'success': False, 'message': 'No face detected for calibration'}
        except Exception as e:
            return {'success': False, 'message': f'Calibration error: {str(e)}'}
    
    def check_environment(self, frame: np.ndarray) -> Dict:
        """
        Check environment lighting and face detection
        """
        try:
            height, width, _ = frame.shape
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Check lighting (convert to grayscale and check brightness)
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            brightness = np.mean(gray)
            lighting_ok = 40 < brightness < 220  # Acceptable range
            
            # Check face detection
            face_detection_results = self.mp_face_detection.process(rgb_frame)
            face_detected = face_detection_results.detections is not None and len(face_detection_results.detections) > 0
            
            # Check if face is centered
            face_centered = False
            if face_detected:
                detection = face_detection_results.detections[0]
                bbox = detection.location_data.relative_bounding_box
                center_x = bbox.xmin + bbox.width / 2
                center_y = bbox.ymin + bbox.height / 2
                face_centered = (0.3 < center_x < 0.7) and (0.2 < center_y < 0.7)
            
            message = []
            if not lighting_ok:
                if brightness < 40:
                    message.append("Lighting too dark")
                else:
                    message.append("Lighting too bright")
            if not face_detected:
                message.append("No face detected")
            elif not face_centered:
                message.append("Face not centered")
            
            if not message:
                message.append("Environment check passed")
            
            return {
                'lighting_ok': lighting_ok,
                'face_detected': face_detected,
                'face_centered': face_centered,
                'message': ', '.join(message),
                'brightness': float(brightness)
            }
        except Exception as e:
            return {
                'lighting_ok': False,
                'face_detected': False,
                'face_centered': False,
                'message': f'Environment check error: {str(e)}'
            }

    def process_frame(self, frame: np.ndarray, session_id: str, calibrated_pitch: float, calibrated_yaw: float) -> Dict:
        """
        Process a single frame for all violations
        Returns comprehensive violation report
        """
        try:
            if frame is None:
                return {'error': 'Invalid frame data'}
            
            height, width, _ = frame.shape
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Initialize result
            result = {
                'timestamp': datetime.utcnow().isoformat(),
                'violations': [],
                'head_pose': None,
                'face_count': 0,
                'looking_away': False,
                'multiple_faces': False,
                'no_person': False,
                'phone_detected': False,
                'book_detected': False,
                'snapshot_base64': None
            }
            
            # Detect multiple faces first
            face_detection_results = self.mp_face_detection.process(rgb_frame)
            if face_detection_results.detections:
                result['face_count'] = len(face_detection_results.detections)
                
                if self.detect_multiple_faces(face_detection_results.detections):
                    result['multiple_faces'] = True
                    result['violations'].append({
                        'type': 'multiple_faces',
                        'severity': 'high',
                        'message': f'{len(face_detection_results.detections)} people detected in frame'
                    })
                    cv2.putText(frame, "MULTIPLE PEOPLE DETECTED!", (50, 100),
                              cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            else:
                # No person detected
                result['no_person'] = True
                result['violations'].append({
                    'type': 'no_person',
                    'severity': 'high',
                    'message': 'No person detected in frame'
                })
                cv2.putText(frame, "NO PERSON DETECTED!", (50, 50),
                          cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            # Process face mesh for head pose (only if single person detected)
            if result['face_count'] == 1:
                face_mesh_results = self.mp_face_mesh.process(rgb_frame)
                if face_mesh_results.multi_face_landmarks:
                    landmarks = face_mesh_results.multi_face_landmarks[0].landmark
                    angles = self.estimate_head_pose(landmarks, width, height)
                    
                    if angles:
                        pitch, yaw, roll = angles
                        result['head_pose'] = {
                            'pitch': float(pitch),
                            'yaw': float(yaw),
                            'roll': float(roll)
                        }
                        
                        # Check if looking away with confidence scoring
                        is_looking_away, confidence_score = self.is_looking_away(pitch, yaw, calibrated_pitch, calibrated_yaw)
                        if is_looking_away:
                            result['looking_away'] = True
                            
                            # Determine severity based on confidence score
                            if confidence_score >= self.LOOKING_AWAY_SEVERITY_THRESHOLD:
                                severity = 'high'
                                message = f'Student is clearly looking away from screen (confidence: {confidence_score:.2f})'
                            else:
                                severity = 'low'
                                message = f'Student may be looking away from screen (confidence: {confidence_score:.2f})'
                            
                            result['violations'].append({
                                'type': 'looking_away',
                                'severity': severity,
                                'message': message,
                                'confidence': confidence_score
                            })
                            
                            # Display confidence on frame
                            cv2.putText(frame, f"LOOKING AWAY! ({confidence_score:.2f})", (50, 150), 
                                      cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            # Detect prohibited objects
            object_detection = self.detect_prohibited_objects(frame)
            result['phone_detected'] = object_detection['phone_detected']
            result['book_detected'] = object_detection['book_detected']
            
            if object_detection['phone_detected']:
                result['violations'].append({
                    'type': 'phone_detected',
                    'severity': 'high',
                    'message': 'Mobile phone detected'
                })
            
            if object_detection['book_detected']:
                result['violations'].append({
                    'type': 'book_detected',
                    'severity': 'medium',
                    'message': 'Book detected'
                })
            
            # If violations exist, capture snapshot (throttled per session)
            if result['violations']:
                now_ts = time.time()
                last_ts = self.last_snapshot_time_by_session.get(session_id, 0.0)
                if (now_ts - last_ts) >= self.SNAPSHOT_INTERVAL_SEC:
                    annotated_frame = object_detection['annotated_frame']
                    _, buffer = cv2.imencode('.jpg', annotated_frame)
                    result['snapshot_base64'] = base64.b64encode(buffer).decode('utf-8')
                    self.last_snapshot_time_by_session[session_id] = now_ts
            
            return result
            
        except Exception as e:
            return {'error': f'Frame processing error: {str(e)}'}

    def calibrate_from_frame(self, frame_base64: str) -> Optional[Tuple[float, float]]:
        """
        Extract calibration values (pitch, yaw) from a frame
        """
        try:
            # Decode base64 frame
            frame_data = base64.b64decode(frame_base64.split(',')[1] if ',' in frame_base64 else frame_base64)
            nparr = np.frombuffer(frame_data, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if frame is None:
                return None
            
            height, width, _ = frame.shape
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            face_mesh_results = self.mp_face_mesh.process(rgb_frame)
            if face_mesh_results.multi_face_landmarks:
                landmarks = face_mesh_results.multi_face_landmarks[0].landmark
                angles = self.estimate_head_pose(landmarks, width, height)
                
                if angles:
                    pitch, yaw, _ = angles
                    return (float(pitch), float(yaw))
            
            return None
        except Exception as e:
            print(f"Calibration error: {e}")
            return None

# Global instance
proctoring_service = ProctoringService()
