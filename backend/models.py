from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime
import uuid

# Student Models
class Student(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str  # Auto-generated student ID
    name: str
    email: str
    registered_at: datetime = Field(default_factory=datetime.utcnow)

class StudentCreate(BaseModel):
    name: str
    email: str

class StudentResponse(BaseModel):
    id: str
    student_id: str
    name: str
    email: str
    registered_at: datetime

# Exam Session Models
class ExamSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    student_id: str
    student_name: str
    start_time: datetime = Field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    status: str = "active"  # active, completed, terminated
    calibrated_pitch: float = 0.0
    calibrated_yaw: float = 0.0
    total_frames: int = 0
    violation_count: int = 0

class ExamSessionCreate(BaseModel):
    student_id: str
    student_name: str
    calibrated_pitch: float
    calibrated_yaw: float

class ExamSessionUpdate(BaseModel):
    end_time: Optional[datetime] = None
    status: Optional[str] = None
    total_frames: Optional[int] = None
    violation_count: Optional[int] = None

# Violation Models
class ViolationDetail(BaseModel):
    type: str
    severity: str
    message: str
    confidence: Optional[float] = None  # Confidence score for the violation

class Violation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    student_id: str
    student_name: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    violation_type: str  # looking_away, multiple_faces, phone_detected, book_detected, no_person, copy_paste, tab_switch, excessive_noise
    severity: str  # low, medium, high
    message: str
    confidence: Optional[float] = None  # Confidence score for the violation
    snapshot_url: Optional[str] = None  # Supabase URL
    snapshot_base64: Optional[str] = None  # Temporary base64 before upload
    head_pose: Optional[Dict] = None
    audio_level: Optional[float] = None  # Audio level for noise violations

class ViolationCreate(BaseModel):
    session_id: str
    student_id: str
    student_name: str
    violation_type: str
    severity: str
    message: str
    snapshot_base64: Optional[str] = None
    head_pose: Optional[Dict] = None

# Frame Processing Models
class FrameProcessRequest(BaseModel):
    session_id: str
    frame_base64: str
    calibrated_pitch: float
    calibrated_yaw: float

class FrameProcessResponse(BaseModel):
    timestamp: str
    violations: List[ViolationDetail]
    head_pose: Optional[Dict]
    face_count: int
    looking_away: bool
    multiple_faces: bool
    no_person: bool
    phone_detected: bool
    book_detected: bool
    snapshot_base64: Optional[str] = None

# Calibration Models
class CalibrationRequest(BaseModel):
    frame_base64: str

class CalibrationResponse(BaseModel):
    success: bool
    pitch: Optional[float] = None
    yaw: Optional[float] = None
    message: str

# Environment Check Models
class EnvironmentCheck(BaseModel):
    lighting_ok: bool
    face_detected: bool
    face_centered: bool
    multiple_faces_detected: bool = False  # NEW: Check for multiple faces
    message: str

class EnvironmentCheckRequest(BaseModel):
    frame_base64: str

# Admin Dashboard Models
class SessionStats(BaseModel):
    total_sessions: int
    active_sessions: int
    completed_sessions: int
    total_violations: int

class StudentViolationSummary(BaseModel):
    student_id: str
    student_name: str
    session_id: str
    total_violations: int
    violation_types: Dict[str, int]
    latest_violation: Optional[datetime] = None

# WebSocket Models
class WSMessage(BaseModel):
    type: str  # violation_alert, session_update, student_status
    data: Dict

class ViolationAlert(BaseModel):
    session_id: str
    student_id: str
    student_name: str
    violation_type: str
    severity: str
    message: str
    timestamp: datetime
    snapshot_url: Optional[str] = None

# Browser-based Violation Models
class BrowserViolationRequest(BaseModel):
    session_id: str
    violation_type: str  # copy_paste, tab_switch
    message: str

# Statistics Models
class ViolationTimePoint(BaseModel):
    timestamp: datetime
    count: int

class StudentStatistics(BaseModel):
    student_id: str
    student_name: str
    total_violations: int
    avg_violations_per_session: float
    total_sessions: int
    avg_session_duration_minutes: float
    violation_breakdown: Dict[str, int]
    violations_over_time: List[ViolationTimePoint]

class AverageStatistics(BaseModel):
    avg_violations_per_student: float
    avg_exam_duration_minutes: float
    avg_violation_types: Dict[str, float]
    total_students: int
    total_sessions: int
