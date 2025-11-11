# AI Proctoring System - Complete Setup Guide

## Overview

This AI-powered exam proctoring system integrates:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Python FastAPI with YOLOv8n & MediaPipe
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage for violation evidence
- **Real-time**: WebSocket for live monitoring

## Features

### Detection Capabilities
✅ **Phone Detection** - Detects cell phones using YOLOv8n  
✅ **Multiple Face Detection** - Identifies multiple people in frame  
✅ **No Person Detection** - Alerts when student leaves frame  
✅ **Object Detection** - Detects unauthorized objects (books, laptops, tablets)  
✅ **Head Pose Tracking** - Monitors looking away using MediaPipe  
✅ **Audio Monitoring** - Detects excessive background noise  
✅ **Tab Switching** - Detects when student leaves exam tab  
✅ **Copy/Paste** - Prevents copying and pasting in exam  

### System Features
- Real-time WebSocket monitoring
- Automatic violation snapshots with timestamps
- Evidence storage in Supabase
- Admin dashboard with live alerts
- PDF & CSV report generation
- Environment verification before exam
- Head pose calibration

---

## Setup Instructions

### 1. Python Backend Setup

#### Prerequisites
- Python 3.9 or higher
- pip package manager

#### Installation

```bash
# Navigate to python-backend directory
cd python-backend

# Install dependencies
pip install -r requirements.txt

# Download YOLOv8n model
python download_model.py
```

#### Configuration

Create a `.env` file in the `python-backend` directory:

```bash
SUPABASE_URL=https://ukwnvvuqmiqrjlghgxnf.supabase.co
SUPABASE_KEY=your-supabase-service-role-key
```

#### Running the Backend

```bash
# Development
python server.py

# Production (with Uvicorn)
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

The Python backend will be available at: `http://localhost:8000`

#### Docker Deployment (Optional)

```bash
docker build -t proctoring-backend .
docker run -p 8000:8000 \
  -e SUPABASE_URL=your-url \
  -e SUPABASE_KEY=your-key \
  proctoring-backend
```

---

### 2. Frontend Setup

#### Prerequisites
- Node.js 18+ or Bun
- npm/yarn/bun package manager

#### Installation

```bash
# Install dependencies
npm install
# or
bun install
```

#### Configuration

Update `.env` file with Python backend URLs:

```bash
# Existing Supabase config
VITE_SUPABASE_PROJECT_ID="ukwnvvuqmiqrjlghgxnf"
VITE_SUPABASE_PUBLISHABLE_KEY="your-publishable-key"
VITE_SUPABASE_URL="https://ukwnvvuqmiqrjlghgxnf.supabase.co"

# Python Backend URLs
VITE_PROCTORING_API_URL="http://localhost:8000"
VITE_PROCTORING_WS_URL="ws://localhost:8000"
```

For **production**, update with your deployed Python backend URL:
```bash
VITE_PROCTORING_API_URL="https://your-python-backend.com"
VITE_PROCTORING_WS_URL="wss://your-python-backend.com"
```

#### Running the Frontend

```bash
npm run dev
# or
bun dev
```

The frontend will be available at: `http://localhost:8080`

---

### 3. Supabase Configuration

#### Storage Bucket Setup

The `violation-evidence` bucket should already exist. If not, create it:

```sql
-- Create bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('violation-evidence', 'violation-evidence', true);

-- Create RLS policies
CREATE POLICY "Anyone can upload violation evidence"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'violation-evidence');

CREATE POLICY "Anyone can view violation evidence"
ON storage.objects FOR SELECT
USING (bucket_id = 'violation-evidence');
```

#### Database Tables

All required tables are already set up:
- `students` - Student registration data
- `exams` - Exam sessions
- `exam_questions` - Exam questions
- `exam_answers` - Student answers
- `violations` - Violation records with evidence
- `exam_templates` - Exam templates by subject

#### Real-time Subscriptions

Enable real-time for the `violations` table:

```sql
ALTER TABLE violations REPLICA IDENTITY FULL;

-- Already in publication
```

---

## Architecture

### Data Flow

```
┌─────────────┐         WebSocket        ┌──────────────────┐
│   Student   │◄────────────────────────►│  Python Backend  │
│   Browser   │    (Video Frames +       │   (FastAPI +     │
│             │     Audio Levels)        │  YOLOv8 + MP)    │
└──────┬──────┘                          └────────┬─────────┘
       │                                          │
       │ Violations + Evidence                   │ AI Detection
       │                                          │
       ▼                                          ▼
┌─────────────────────────────────────────────────────┐
│              Supabase                                │
│  ┌──────────────┐        ┌─────────────────────┐  │
│  │  PostgreSQL  │        │  Storage (Evidence)  │  │
│  │  (Database)  │        │   violation-evidence │  │
│  └──────┬───────┘        └─────────┬───────────┘  │
│         │                           │               │
│         │ Real-time Subscriptions   │               │
│         ▼                           ▼               │
└─────────────────────────────────────────────────────┘
         │
         │ Live Updates
         ▼
┌─────────────────┐
│      Admin      │
│    Dashboard    │
└─────────────────┘
```

### WebSocket Communication

1. **Student Exam Page** connects to Python backend via WebSocket
2. **Video frames** (base64) sent every 2 seconds
3. **Python backend** processes frames with:
   - MediaPipe for face detection & head pose
   - YOLOv8n for object detection
4. **Violations** sent back to frontend in real-time
5. **Evidence snapshots** uploaded to Supabase Storage
6. **Violation records** saved to database
7. **Admin dashboard** receives real-time updates via Supabase subscriptions

---

## Usage

### For Students

1. **Register**: Enter name, email, student ID, and subject code
2. **Face Capture**: Take a photo for verification
3. **Environment Check**: System verifies:
   - Camera & microphone access
   - Lighting conditions
   - Face detection & centering
   - Head pose calibration
4. **Start Exam**: Begin monitored exam session
5. **Monitored Activities**:
   - Live video feed processed every 2 seconds
   - AI detects violations automatically
   - Snapshots captured as evidence
   - Real-time warnings displayed

### For Administrators

1. **Login**: Access admin dashboard
2. **Monitor**: View real-time statistics:
   - Active exams
   - Total violations
   - Live violation alerts
3. **View Evidence**: Browse violation images with timestamps
4. **Generate Reports**: Export data as:
   - PDF reports (per student)
   - CSV exports (individual or all)
5. **Analytics**: View violation trends over time

---

## API Endpoints

### Python Backend

#### Health Check
```
GET /health
```

#### Environment Check
```
POST /environment-check
Body: { "frame_base64": "data:image/jpeg;base64,..." }
Response: {
  "lighting_ok": true,
  "face_detected": true,
  "face_centered": true,
  "message": "Environment check passed"
}
```

#### Calibration
```
POST /calibrate
Body: { "frame_base64": "data:image/jpeg;base64,..." }
Response: {
  "success": true,
  "pitch": 0.0,
  "yaw": 0.0,
  "message": "Calibration successful"
}
```

#### Frame Processing
```
POST /process-frame
Body: {
  "session_id": "uuid",
  "frame_base64": "data:image/jpeg;base64,...",
  "calibrated_pitch": 0.0,
  "calibrated_yaw": 0.0
}
Response: {
  "violations": [...],
  "face_count": 1,
  "looking_away": false,
  "phone_detected": false,
  ...
}
```

#### WebSocket Monitoring
```
WS /ws/proctoring/{session_id}
Send: {
  "type": "frame",
  "frame": "data:image/jpeg;base64,...",
  "calibrated_pitch": 0.0,
  "calibrated_yaw": 0.0,
  "audio_level": 30
}
Receive: {
  "type": "detection_result",
  "data": { "violations": [...], ... }
}
```

---

## Troubleshooting

### Python Backend Issues

**Issue**: YOLO model not found
```
Solution: Run `python download_model.py` to download the model
```

**Issue**: MediaPipe errors
```
Solution: Install system dependencies:
apt-get install libglib2.0-0 libsm6 libxext6 libxrender-dev libgomp1 libgl1-mesa-glx
```

**Issue**: WebSocket connection fails
```
Solution: Check CORS settings and ensure Python backend is running
```

### Frontend Issues

**Issue**: WebSocket not connecting
```
Solution: Verify VITE_PROCTORING_WS_URL in .env matches Python backend URL
```

**Issue**: Video not displaying
```
Solution: Check browser permissions for camera/microphone access
```

**Issue**: Violations not showing in admin dashboard
```
Solution: Check Supabase real-time subscription is active
```

---

## Performance Optimization

### Python Backend
- Frame processing: ~100-200ms per frame
- YOLOv8n inference: ~50-100ms
- MediaPipe: ~30-50ms
- Recommended: Send frames every 2-3 seconds

### Frontend
- Use `requestAnimationFrame` for smooth video capture
- Compress images before sending (JPEG quality 0.8)
- Batch audio level readings
- Implement exponential backoff for WebSocket reconnection

### Database
- Index on `violations.timestamp` for fast queries
- Index on `violations.student_id` for student lookups
- Use Supabase Edge Functions for heavy processing

---

## Security Considerations

1. **Environment Variables**: Never commit API keys or secrets
2. **CORS**: Configure Python backend CORS for production domains only
3. **RLS Policies**: Review and test all database RLS policies
4. **Authentication**: Implement proper admin authentication
5. **Rate Limiting**: Add rate limiting to Python backend endpoints
6. **HTTPS**: Use HTTPS/WSS in production
7. **Storage Security**: Ensure violation evidence is properly secured

---

## Production Deployment

### Python Backend
- Deploy to: AWS EC2, Google Cloud Run, DigitalOcean, Heroku
- Use: Gunicorn + Uvicorn workers
- Scale: Horizontal scaling with load balancer
- Monitor: Application logs, error tracking

### Frontend
- Lovable already handles deployment
- Update environment variables in production
- Test WebSocket connections

### Monitoring
- Set up application monitoring
- Track violation rates
- Monitor API response times
- Alert on system failures

---

## Support

For issues or questions:
1. Check this documentation first
2. Review Python backend logs: Check console output
3. Review frontend logs: Browser console
4. Check Supabase logs: Database and Storage sections

## License

This project uses:
- YOLOv8 (AGPL-3.0)
- MediaPipe (Apache-2.0)
- FastAPI (MIT)
- React (MIT)
