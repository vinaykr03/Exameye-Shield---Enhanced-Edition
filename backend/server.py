"""
FastAPI Server for AI Proctoring with WebSocket Support
Integrates YOLOv8n and MediaPipe for real-time exam monitoring
"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Dict, List
import base64
import cv2
import numpy as np
from datetime import datetime
import asyncio
import logging
import json
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from pathlib import Path
import uuid
import re

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from proctoring_service import ProctoringService
from models import (
    FrameProcessRequest,
    FrameProcessResponse,
    CalibrationRequest,
    CalibrationResponse,
    EnvironmentCheckRequest,
    EnvironmentCheck,
    ViolationDetail
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI
app = FastAPI(title="AI Proctoring Service", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase_url = os.environ.get("SUPABASE_URL", "https://ukwnvvuqmiqrjlghgxnf.supabase.co")
supabase_key = os.environ.get("SUPABASE_KEY", "")
supabase: Client = create_client(supabase_url, supabase_key)

# Initialize Proctoring Service
proctoring_service = ProctoringService()

# Helper function to validate and convert UUID
def validate_uuid(value):
    """Validate if a value is a valid UUID, return it or None"""
    if not value:
        return None
    try:
        # Try to parse as UUID
        uuid.UUID(str(value))
        return str(value)
    except (ValueError, AttributeError):
        # If it's not a valid UUID, return None
        logger.warning(f"Invalid UUID format: {value}, using None instead")
        return None

# Active WebSocket connections
active_connections: Dict[str, WebSocket] = {}

def _upload_snapshot_and_get_url(
    supabase: Client,
    exam_id: str,
    student_id: str,
    violation_type: str,
    snapshot_base64: str
):
    """
    Uploads a base64 JPEG snapshot to Supabase Storage bucket 'violation-evidence'
    and returns a public URL. Returns None on failure.
    """
    try:
        if not snapshot_base64:
            return None
        image_data = base64.b64decode(snapshot_base64.split(',')[1] if ',' in snapshot_base64 else snapshot_base64)
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{exam_id}/{student_id}_{violation_type}_{timestamp}.jpg"
        # Upload
        supabase.storage.from_('violation-evidence').upload(
            filename,
            image_data,
            file_options={"content-type": "image/jpeg"}
        )
        public_url = supabase.storage.from_('violation-evidence').get_public_url(filename)
        return public_url
    except Exception as e:
        logger.error(f"Snapshot upload failed: {e}")
        return None

@app.get("/")
async def root():
    return {
        "service": "AI Proctoring Service",
        "status": "running",
        "version": "1.0.0",
        "models": {
            "yolo": proctoring_service.yolo_model is not None,
            "mediapipe": proctoring_service.mp_face_mesh is not None
        }
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "models_loaded": proctoring_service.yolo_model is not None
    }

@app.post("/api/calibrate", response_model=CalibrationResponse)
async def calibrate(request: CalibrationRequest):
    """Calibrate head pose for a student"""
    try:
        # Decode base64 frame
        frame_data = base64.b64decode(request.frame_base64.split(',')[1] if ',' in request.frame_base64 else request.frame_base64)
        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return CalibrationResponse(success=False, message="Invalid frame data")
        
        # Get calibration values
        result = proctoring_service.calibrate_head_pose(frame)
        
        if result['success']:
            return CalibrationResponse(
                success=True,
                pitch=result['pitch'],
                yaw=result['yaw'],
                message="Calibration successful"
            )
        else:
            return CalibrationResponse(
                success=False,
                message=result.get('message', 'Calibration failed')
            )
    except Exception as e:
        logger.error(f"Calibration error: {e}")
        return CalibrationResponse(success=False, message=str(e))

@app.post("/api/environment-check", response_model=EnvironmentCheck)
async def check_environment(request: EnvironmentCheckRequest):
    """Check lighting and face detection for environment verification"""
    try:
        # Decode base64 frame
        frame_data = base64.b64decode(request.frame_base64.split(',')[1] if ',' in request.frame_base64 else request.frame_base64)
        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return EnvironmentCheck(
                lighting_ok=False,
                face_detected=False,
                face_centered=False,
                message="Invalid frame data"
            )
        
        # Check environment
        result = proctoring_service.check_environment(frame)
        
        return EnvironmentCheck(
            lighting_ok=result['lighting_ok'],
            face_detected=result['face_detected'],
            face_centered=result['face_centered'],
            message=result['message']
        )
    except Exception as e:
        logger.error(f"Environment check error: {e}")
        return EnvironmentCheck(
            lighting_ok=False,
            face_detected=False,
            face_centered=False,
            message=str(e)
        )

@app.post("/api/process-frame", response_model=FrameProcessResponse)
async def process_frame(request: FrameProcessRequest):
    """Process a single frame for violations"""
    try:
        # Decode base64 frame
        frame_data = base64.b64decode(request.frame_base64.split(',')[1] if ',' in request.frame_base64 else request.frame_base64)
        nparr = np.frombuffer(frame_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid frame data")
        
        # Process frame
        result = proctoring_service.process_frame(
            frame,
            request.session_id,
            request.calibrated_pitch,
            request.calibrated_yaw
        )
        
        # Convert violations to response format
        violations = [
            ViolationDetail(
                type=v['type'],
                severity=v['severity'],
                message=v['message'],
                confidence=v.get('confidence')
            )
            for v in result['violations']
        ]
        
        return FrameProcessResponse(
            timestamp=datetime.utcnow().isoformat(),
            violations=violations,
            head_pose=result.get('head_pose'),
            face_count=result['face_count'],
            looking_away=result['looking_away'],
            multiple_faces=result['multiple_faces'],
            no_person=result['no_person'],
            phone_detected=result['phone_detected'],
            book_detected=result['book_detected'],
            snapshot_base64=result.get('snapshot_base64')
        )
    except Exception as e:
        logger.error(f"Frame processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.websocket("/api/ws/proctoring/{session_id}")
async def websocket_proctoring(websocket: WebSocket, session_id: str):
    """WebSocket endpoint for real-time proctoring"""
    print(f"🔌 WebSocket connection attempt for session: {session_id}")
    logger.info(f"🔌 WebSocket connection attempt for session: {session_id}")
    await websocket.accept()
    active_connections[session_id] = websocket
    print(f"✅ WebSocket connected and accepted: {session_id}")
    logger.info(f"✅ WebSocket connected: {session_id}")
    
    try:
        # Throttle: only process a frame every 2 seconds per connection
        last_processed_time = 0.0
        FRAME_INTERVAL_SEC = 2.0
        while True:
            # Receive frame data from client
            data = await websocket.receive_text()
            message = json.loads(data)
            logger.info(f"📥 Received message type: {message.get('type')}")
            
            if message['type'] == 'frame':
                logger.info(f"🎥 Processing frame from student {message.get('student_id')}")
                # Throttle processing to every 2 seconds
                now_ts = asyncio.get_event_loop().time()
                if (now_ts - last_processed_time) >= FRAME_INTERVAL_SEC:
                    last_processed_time = now_ts
                    # Process frame
                    try:
                        frame_data = base64.b64decode(message['frame'].split(',')[1] if ',' in message['frame'] else message['frame'])
                        logger.info(f"📦 Frame data decoded: {len(frame_data)} bytes")
                        nparr = np.frombuffer(frame_data, np.uint8)
                        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                        logger.info(f"🖼️  Frame decode result: {frame is not None}")
                    except Exception as decode_err:
                        logger.error(f"❌ Frame decode error: {decode_err}")
                        frame = None
                    
                    if frame is not None:
                        logger.info(f"🔍 Frame decoded successfully: {frame.shape}, Calibration: pitch={message.get('calibrated_pitch', 0.0)}, yaw={message.get('calibrated_yaw', 0.0)}")
                        result = proctoring_service.process_frame(
                            frame,
                            session_id,
                            message.get('calibrated_pitch', 0.0),
                            message.get('calibrated_yaw', 0.0)
                        )
                        logger.info(f"🎯 Detection result: {len(result.get('violations', []))} violations found")
                        logger.info(f"📊 Detection details: faces={result.get('face_count', 0)}, no_person={result.get('no_person', False)}, multiple={result.get('multiple_faces', False)}, looking_away={result.get('looking_away', False)}, phone={result.get('phone_detected', False)}, book={result.get('book_detected', False)}")
                        # Persist violations with snapshot evidence
                        try:
                            exam_id = message.get('exam_id')
                            student_id = message.get('student_id')
                            student_name = message.get('student_name')
                            snapshot_b64 = result.get('snapshot_base64')
                            # If there are violations, upload snapshot and insert rows
                            if result.get('violations'):
                                logger.info(f"💾 Saving {len(result['violations'])} violations to database...")
                                image_url = None
                                # Upload once and reuse URL for all violations in this frame
                                if snapshot_b64:
                                    logger.info(f"📸 Uploading snapshot for violation...")
                                    image_url = _upload_snapshot_and_get_url(
                                        supabase, exam_id or "unknown_exam", student_id or "unknown_student",
                                        result['violations'][0]['type'], snapshot_b64
                                    )
                                    logger.info(f"✅ Snapshot uploaded: {image_url}")
                                else:
                                    logger.warning("⚠️ No snapshot available for violation")
                                # Insert one record per violation type
                                for v in result['violations']:
                                    violation_record = {
                                        "id": str(uuid.uuid4()),
                                        "exam_id": exam_id,
                                        "student_id": student_id,
                                        "violation_type": v.get("type"),
                                        "severity": v.get("severity"),
                                        "details": {
                                            "message": v.get("message"),
                                            "confidence": v.get("confidence"),
                                            "session_id": session_id,
                                            "student_name": student_name,
                                        },
                                        "image_url": image_url,
                                        "timestamp": datetime.utcnow().isoformat()
                                    }
                                    try:
                                        supabase.table('violations').insert(violation_record).execute()
                                        logger.info(f"✅ Violation saved: {v.get('type')} - {v.get('message')}")
                                    except Exception as db_err:
                                        logger.error(f"❌ Insert violation failed: {db_err}")
                            else:
                                logger.info("✅ No violations detected in this frame")
                        except Exception as persist_err:
                            logger.error(f"❌ Persisting violation failed: {persist_err}")
                        # Send results back to client
                        await websocket.send_json({
                            'type': 'detection_result',
                            'data': result
                        })
                        logger.info(f"📤 Detection result sent to client")
                        
                        # Also send individual violation alerts to frontend
                        if result.get('violations'):
                            for v in result['violations']:
                                await websocket.send_json({
                                    'type': 'violation',
                                    'data': {
                                        'type': v.get('type'),
                                        'severity': v.get('severity'),
                                        'message': v.get('message'),
                                        'confidence': v.get('confidence'),
                                        'timestamp': datetime.utcnow().isoformat()
                                    }
                                })
                                logger.info(f"🚨 Violation alert sent to frontend: {v.get('type')}")
                    else:
                        logger.error("❌ Frame is None - could not decode image data")
                        await websocket.send_json({
                            'type': 'error',
                            'data': {'message': 'Failed to decode frame image'}
                        })
                else:
                    # Optionally inform client that frame was skipped due to throttle
                    await websocket.send_json({
                        'type': 'detection_skipped',
                        'data': {
                            'reason': 'throttled',
                            'interval_sec': FRAME_INTERVAL_SEC,
                            'timestamp': datetime.utcnow().isoformat()
                        }
                    })
                    
            elif message['type'] == 'audio':
                # Process audio level
                audio_level = message.get('audio_level', 0)
                # Always echo current audio level so UI can update in real-time
                await websocket.send_json({
                    'type': 'audio_level',
                    'data': {
                        'level': float(audio_level),
                        'timestamp': datetime.utcnow().isoformat()
                    }
                })
                # Record a violation if audio exceeds threshold
                try:
                    if audio_level >= 30:
                        exam_id = message.get('exam_id')
                        student_id = message.get('student_id')
                        student_name = message.get('student_name')
                        violation_record = {
                            "id": str(uuid.uuid4()),
                            "exam_id": exam_id,
                            "student_id": student_id,
                            "violation_type": "excessive_noise",
                            "severity": "medium",
                            "details": {
                                "message": f"Audio level {audio_level:.0f}% over threshold",
                                "session_id": session_id,
                                "student_name": student_name,
                            },
                            "image_url": None,
                            "timestamp": datetime.utcnow().isoformat()
                        }
                        supabase.table('violations').insert(violation_record).execute()
                        await websocket.send_json({
                            'type': 'violation',
                            'data': {
                                'type': 'excessive_noise',
                                'severity': 'medium',
                                'message': 'Excessive background noise detected',
                                'timestamp': datetime.utcnow().isoformat()
                            }
                        })
                except Exception as e:
                    logger.error(f"Audio violation insert failed: {e}")
                    
            elif message['type'] == 'browser_activity':
                # Handle browser activity violations (tab switch, copy/paste)
                try:
                    exam_id = message.get('exam_id')
                    student_id = message.get('student_id')
                    student_name = message.get('student_name')
                    violation_type = message.get('violation_type')
                    violation_message = message.get('message')
                    
                    # Save browser activity violation to database (NO snapshot for browser activity)
                    violation_record = {
                        "id": str(uuid.uuid4()),
                        "exam_id": exam_id,
                        "student_id": student_id,
                        "violation_type": violation_type,
                        "severity": "medium",
                        "details": {
                            "message": violation_message,
                            "session_id": session_id,
                            "student_name": student_name,
                        },
                        "image_url": None,  # No snapshot for browser activity
                        "timestamp": datetime.utcnow().isoformat()
                    }
                    supabase.table('violations').insert(violation_record).execute()
                    
                    # Send violation alert back to client for real-time UI update
                    await websocket.send_json({
                        'type': 'violation',
                        'data': {
                            'type': violation_type,
                            'severity': 'medium',
                            'message': violation_message,
                            'timestamp': datetime.utcnow().isoformat()
                        }
                    })
                    logger.info(f"Browser activity violation recorded: {violation_type} for student {student_id}")
                except Exception as e:
                    logger.error(f"Browser activity violation insert failed: {e}")
                    
            elif message['type'] == 'ping':
                await websocket.send_json({'type': 'pong'})
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {session_id}")
        if session_id in active_connections:
            del active_connections[session_id]
    except Exception as e:
        logger.error(f"WebSocket error for {session_id}: {e}")
        if session_id in active_connections:
            del active_connections[session_id]

@app.post("/api/upload-violation-snapshot")
async def upload_violation_snapshot(
    exam_id: str,
    student_id: str,
    student_name: str,
    violation_type: str,
    snapshot_base64: str
):
    """Upload violation snapshot to Supabase Storage"""
    try:
        # Decode base64 image
        image_data = base64.b64decode(snapshot_base64.split(',')[1] if ',' in snapshot_base64 else snapshot_base64)
        
        # Generate filename
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        filename = f"{exam_id}/{student_id}_{violation_type}_{timestamp}.jpg"
        
        # Upload to Supabase Storage
        response = supabase.storage.from_('violation-evidence').upload(
            filename,
            image_data,
            file_options={"content-type": "image/jpeg"}
        )
        
        # Get public URL
        public_url = supabase.storage.from_('violation-evidence').get_public_url(filename)
        
        return {
            "success": True,
            "url": public_url,
            "filename": filename
        }
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/violations")
async def create_violation(violation_data: dict):
    """Create a violation record in Supabase"""
    try:
        # Insert violation into Supabase
        violation_record = {
            "id": str(uuid.uuid4()),
            "exam_id": violation_data.get("exam_id"),
            "student_id": violation_data.get("student_id"),
            "violation_type": violation_data.get("violation_type"),
            "severity": violation_data.get("severity", "medium"),
            "details": violation_data.get("details", {}),
            "image_url": violation_data.get("image_url"),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        result = supabase.table('violations').insert(violation_record).execute()
        
        return {
            "success": True,
            "violation_id": violation_record["id"],
            "message": "Violation recorded successfully"
        }
    except Exception as e:
        logger.error(f"Error creating violation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/violations")
async def get_violations(exam_id: str = None, student_id: str = None):
    """Get violations from Supabase"""
    try:
        query = supabase.table('violations').select('*')
        
        if exam_id:
            query = query.eq('exam_id', exam_id)
        if student_id:
            query = query.eq('student_id', student_id)
            
        result = query.order('timestamp', desc=True).execute()
        
        return {
            "success": True,
            "violations": result.data
        }
    except Exception as e:
        logger.error(f"Error fetching violations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
