#!/usr/bin/env python3
"""Test AI detection with a real webcam image"""
import asyncio
import websockets
import json
import cv2
import base64
import numpy as np

async def test_ai_detection():
    uri = "ws://localhost:8001/api/ws/proctoring/test-session-456"
    print(f"🔌 Connecting to: {uri}")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected successfully!")
            
            # Create a test image (simple blank image with a face-like shape)
            # This is just a test - in production, real webcam frames will be sent
            test_image = np.zeros((480, 640, 3), dtype=np.uint8)
            test_image.fill(100)  # Gray background
            
            # Draw a simple face-like shape
            cv2.circle(test_image, (320, 240), 80, (200, 180, 160), -1)  # Face
            cv2.circle(test_image, (290, 220), 15, (50, 50, 50), -1)  # Left eye
            cv2.circle(test_image, (350, 220), 15, (50, 50, 50), -1)  # Right eye
            cv2.ellipse(test_image, (320, 260), (40, 20), 0, 0, 180, (50, 50, 50), 2)  # Mouth
            
            # Encode image to base64
            _, buffer = cv2.imencode('.jpg', test_image)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            img_data_url = f"data:image/jpeg;base64,{img_base64}"
            
            print(f"📸 Created test image: {len(img_data_url)} bytes")
            
            # Send frame message
            test_message = {
                "type": "frame",
                "frame": img_data_url,
                "calibrated_pitch": 0.0,
                "calibrated_yaw": 0.0,
                "exam_id": "550e8400-e29b-41d4-a716-446655440000",  # Valid UUID
                "student_id": "550e8400-e29b-41d4-a716-446655440001",  # Valid UUID
                "student_name": "Test Student",
                "audio_level": 10
            }
            
            print(f"📤 Sending test frame...")
            await websocket.send(json.dumps(test_message))
            print("✅ Frame sent, waiting for AI detection results...")
            
            # Wait for multiple responses
            try:
                for i in range(5):
                    response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                    data = json.loads(response)
                    print(f"\n📥 Response {i+1}:")
                    print(f"   Type: {data.get('type')}")
                    if data.get('type') == 'detection_result':
                        result = data.get('data', {})
                        print(f"   Face count: {result.get('face_count')}")
                        print(f"   No person: {result.get('no_person')}")
                        print(f"   Multiple faces: {result.get('multiple_faces')}")
                        print(f"   Looking away: {result.get('looking_away')}")
                        print(f"   Phone detected: {result.get('phone_detected')}")
                        print(f"   Book detected: {result.get('book_detected')}")
                        print(f"   Violations: {len(result.get('violations', []))}")
                        if result.get('violations'):
                            for v in result['violations']:
                                print(f"      - {v.get('type')}: {v.get('message')}")
                    elif data.get('type') == 'violation':
                        v = data.get('data', {})
                        print(f"   Violation: {v.get('type')} - {v.get('message')}")
                    else:
                        print(f"   Data: {str(data)[:200]}")
            except asyncio.TimeoutError:
                print("\n⏱️  No more responses (timeout)")
                
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print("🧪 Testing AI detection with real image data...\n")
    asyncio.run(test_ai_detection())
