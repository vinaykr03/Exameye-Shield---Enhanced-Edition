#!/usr/bin/env python3
"""
Backend Testing Suite for AI Proctoring WebSocket Functionality
Tests WebSocket connections, violation detection, and database persistence
"""

import asyncio
import websockets
import json
import requests
import base64
import time
from datetime import datetime
import uuid
import os
from supabase import create_client, Client

# Configuration
BACKEND_URL = "https://install-and-run-1.preview.emergentagent.com"
WS_URL = "wss://install-and-run-1.preview.emergentagent.com"
SUPABASE_URL = "https://ukwnvvuqmiqrjlghgxnf.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrd252dnVxbWlxcmpsZ2hneG5mIiwicm9sZSI6ImFub24iLCJpYXQiOjE7NjA0MDQwMTEsImV4cCI6MjA3NTk4MDAxMX0.XhfmvtzuoEXXOrhenEFPzzVQNcIiZhcV3KAClmZnKEI"

# Test data
TEST_SESSION_ID = f"test-session-{uuid.uuid4()}"
TEST_EXAM_ID = "test-exam-123"
TEST_STUDENT_ID = "test-student-456"
TEST_STUDENT_NAME = "John Doe"

# Initialize Supabase client for verification
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def create_test_image_base64():
    """Create a simple test image in base64 format"""
    # Create a simple 100x100 black image
    import cv2
    import numpy as np
    
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, buffer = cv2.imencode('.jpg', img)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{img_base64}"

def test_basic_endpoints():
    """Test basic HTTP endpoints"""
    print("=== Testing Basic HTTP Endpoints ===")
    
    # Test root endpoint
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        print(f"✅ Root endpoint: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"❌ Root endpoint failed: {e}")
    
    # Test health endpoint
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        print(f"✅ Health endpoint: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"❌ Health endpoint failed: {e}")
    
    # Test environment check
    try:
        test_image = create_test_image_base64()
        payload = {"frame_base64": test_image}
        response = requests.post(f"{BACKEND_URL}/api/environment-check", json=payload, timeout=10)
        print(f"✅ Environment check: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"❌ Environment check failed: {e}")
    
    # Test calibration
    try:
        test_image = create_test_image_base64()
        payload = {"frame_base64": test_image}
        response = requests.post(f"{BACKEND_URL}/api/calibrate", json=payload, timeout=10)
        print(f"✅ Calibration: {response.status_code} - {response.json()}")
    except Exception as e:
        print(f"❌ Calibration failed: {e}")

async def test_websocket_connection():
    """Test WebSocket connection and basic ping/pong"""
    print("\n=== Testing WebSocket Connection ===")
    
    ws_endpoint = f"{WS_URL}/api/ws/proctoring/{TEST_SESSION_ID}"
    
    try:
        async with websockets.connect(ws_endpoint) as websocket:
            print(f"✅ WebSocket connected to: {ws_endpoint}")
            
            # Test ping/pong
            ping_message = {"type": "ping"}
            await websocket.send(json.dumps(ping_message))
            
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            response_data = json.loads(response)
            
            if response_data.get("type") == "pong":
                print("✅ Ping/Pong test successful")
                return True
            else:
                print(f"❌ Unexpected ping response: {response_data}")
                return False
                
    except Exception as e:
        print(f"❌ WebSocket connection failed: {e}")
        return False

async def test_browser_activity_violations():
    """Test browser activity violation messages"""
    print("\n=== Testing Browser Activity Violations ===")
    
    ws_endpoint = f"{WS_URL}/api/ws/proctoring/{TEST_SESSION_ID}"
    violations_found = []
    
    try:
        async with websockets.connect(ws_endpoint) as websocket:
            print(f"✅ WebSocket connected for browser activity testing")
            
            # Test tab switch violation
            tab_switch_message = {
                "type": "browser_activity",
                "violation_type": "tab_switch",
                "message": "Tab switched - student navigated away from exam page",
                "exam_id": TEST_EXAM_ID,
                "student_id": TEST_STUDENT_ID,
                "student_name": TEST_STUDENT_NAME
            }
            
            print("📤 Sending tab switch violation...")
            await websocket.send(json.dumps(tab_switch_message))
            
            # Wait for response
            response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
            response_data = json.loads(response)
            print(f"📥 Received response: {response_data}")
            
            if response_data.get("type") == "violation":
                violation_data = response_data.get("data", {})
                if violation_data.get("type") == "tab_switch":
                    print("✅ Tab switch violation response correct")
                    violations_found.append("tab_switch")
                else:
                    print(f"❌ Wrong violation type in response: {violation_data.get('type')}")
            else:
                print(f"❌ Expected violation response, got: {response_data.get('type')}")
            
            # Test copy/paste violation
            copy_paste_message = {
                "type": "browser_activity",
                "violation_type": "copy_paste",
                "message": "Copy operation attempted",
                "exam_id": TEST_EXAM_ID,
                "student_id": TEST_STUDENT_ID,
                "student_name": TEST_STUDENT_NAME
            }
            
            print("📤 Sending copy/paste violation...")
            await websocket.send(json.dumps(copy_paste_message))
            
            # Wait for response
            response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
            response_data = json.loads(response)
            print(f"📥 Received response: {response_data}")
            
            if response_data.get("type") == "violation":
                violation_data = response_data.get("data", {})
                if violation_data.get("type") == "copy_paste":
                    print("✅ Copy/paste violation response correct")
                    violations_found.append("copy_paste")
                else:
                    print(f"❌ Wrong violation type in response: {violation_data.get('type')}")
            else:
                print(f"❌ Expected violation response, got: {response_data.get('type')}")
                
    except Exception as e:
        print(f"❌ Browser activity testing failed: {e}")
    
    return violations_found

async def test_audio_monitoring():
    """Test audio level monitoring and excessive noise detection"""
    print("\n=== Testing Audio Monitoring ===")
    
    ws_endpoint = f"{WS_URL}/api/ws/proctoring/{TEST_SESSION_ID}"
    audio_tests_passed = []
    
    try:
        async with websockets.connect(ws_endpoint) as websocket:
            print(f"✅ WebSocket connected for audio testing")
            
            # Test normal audio level (below threshold)
            normal_audio_message = {
                "type": "audio",
                "audio_level": 20,
                "exam_id": TEST_EXAM_ID,
                "student_id": TEST_STUDENT_ID,
                "student_name": TEST_STUDENT_NAME
            }
            
            print("📤 Sending normal audio level (20)...")
            await websocket.send(json.dumps(normal_audio_message))
            
            # Wait for audio level response
            response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
            response_data = json.loads(response)
            print(f"📥 Received response: {response_data}")
            
            if response_data.get("type") == "audio_level":
                audio_data = response_data.get("data", {})
                if audio_data.get("level") == 20.0:
                    print("✅ Normal audio level response correct")
                    audio_tests_passed.append("normal_audio")
                else:
                    print(f"❌ Wrong audio level in response: {audio_data.get('level')}")
            else:
                print(f"❌ Expected audio_level response, got: {response_data.get('type')}")
            
            # Test excessive audio level (above threshold)
            high_audio_message = {
                "type": "audio",
                "audio_level": 50,
                "exam_id": TEST_EXAM_ID,
                "student_id": TEST_STUDENT_ID,
                "student_name": TEST_STUDENT_NAME
            }
            
            print("📤 Sending high audio level (50)...")
            await websocket.send(json.dumps(high_audio_message))
            
            # Should receive both audio_level and violation responses
            responses_received = 0
            violation_received = False
            audio_level_received = False
            
            while responses_received < 2:
                try:
                    response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                    response_data = json.loads(response)
                    print(f"📥 Received response: {response_data}")
                    
                    if response_data.get("type") == "audio_level":
                        audio_data = response_data.get("data", {})
                        if audio_data.get("level") == 50.0:
                            print("✅ High audio level response correct")
                            audio_level_received = True
                        else:
                            print(f"❌ Wrong audio level in response: {audio_data.get('level')}")
                    
                    elif response_data.get("type") == "violation":
                        violation_data = response_data.get("data", {})
                        if violation_data.get("type") == "excessive_noise":
                            print("✅ Excessive noise violation triggered correctly")
                            violation_received = True
                            audio_tests_passed.append("excessive_noise")
                        else:
                            print(f"❌ Wrong violation type: {violation_data.get('type')}")
                    
                    responses_received += 1
                    
                except asyncio.TimeoutError:
                    print("⚠️ Timeout waiting for additional responses")
                    break
            
            if audio_level_received and violation_received:
                print("✅ High audio level test complete - both responses received")
            else:
                print(f"❌ Missing responses - audio_level: {audio_level_received}, violation: {violation_received}")
                
    except Exception as e:
        print(f"❌ Audio monitoring testing failed: {e}")
    
    return audio_tests_passed

def verify_database_persistence():
    """Verify that violations were saved to Supabase database"""
    print("\n=== Verifying Database Persistence ===")
    
    try:
        # Query violations for our test exam
        result = supabase.table('violations').select('*').eq('exam_id', TEST_EXAM_ID).execute()
        violations = result.data
        
        print(f"📊 Found {len(violations)} violations in database for exam {TEST_EXAM_ID}")
        
        violation_types_found = []
        for violation in violations:
            violation_type = violation.get('violation_type')
            severity = violation.get('severity')
            details = violation.get('details', {})
            student_name = details.get('student_name')
            image_url = violation.get('image_url')
            
            print(f"  - Type: {violation_type}, Severity: {severity}, Student: {student_name}, Image: {image_url is not None}")
            violation_types_found.append(violation_type)
            
            # Verify student_name is included in details
            if student_name == TEST_STUDENT_NAME:
                print(f"    ✅ Student name correctly stored: {student_name}")
            else:
                print(f"    ❌ Student name mismatch: expected {TEST_STUDENT_NAME}, got {student_name}")
            
            # Verify image_url is null for browser activity violations
            if violation_type in ['tab_switch', 'copy_paste']:
                if image_url is None:
                    print(f"    ✅ Image URL correctly null for browser activity: {violation_type}")
                else:
                    print(f"    ❌ Image URL should be null for browser activity: {violation_type}")
        
        return violation_types_found
        
    except Exception as e:
        print(f"❌ Database verification failed: {e}")
        return []

def cleanup_test_data():
    """Clean up test violations from database"""
    print("\n=== Cleaning Up Test Data ===")
    
    try:
        # Delete test violations
        result = supabase.table('violations').delete().eq('exam_id', TEST_EXAM_ID).execute()
        print(f"🧹 Cleaned up test violations for exam {TEST_EXAM_ID}")
    except Exception as e:
        print(f"⚠️ Cleanup failed: {e}")

async def run_all_tests():
    """Run all backend tests"""
    print("🚀 Starting Backend WebSocket Testing Suite")
    print(f"📋 Test Session ID: {TEST_SESSION_ID}")
    print(f"📋 Test Exam ID: {TEST_EXAM_ID}")
    print(f"📋 Test Student: {TEST_STUDENT_NAME} ({TEST_STUDENT_ID})")
    print(f"🌐 Backend URL: {BACKEND_URL}")
    print(f"🔌 WebSocket URL: {WS_URL}")
    
    # Test basic endpoints
    test_basic_endpoints()
    
    # Test WebSocket connection
    ws_connected = await test_websocket_connection()
    if not ws_connected:
        print("❌ WebSocket connection failed - aborting further tests")
        return
    
    # Test browser activity violations
    browser_violations = await test_browser_activity_violations()
    
    # Test audio monitoring
    audio_tests = await test_audio_monitoring()
    
    # Wait a moment for database writes to complete
    print("\n⏳ Waiting for database writes to complete...")
    time.sleep(3)
    
    # Verify database persistence
    db_violations = verify_database_persistence()
    
    # Generate test summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    print(f"🔌 WebSocket Connection: {'✅ PASS' if ws_connected else '❌ FAIL'}")
    print(f"📱 Browser Activity Violations: {len(browser_violations)} detected")
    for violation in browser_violations:
        print(f"   ✅ {violation}")
    
    print(f"🔊 Audio Monitoring Tests: {len(audio_tests)} passed")
    for test in audio_tests:
        print(f"   ✅ {test}")
    
    print(f"💾 Database Violations Saved: {len(db_violations)}")
    for violation in db_violations:
        print(f"   ✅ {violation}")
    
    # Check for expected violations
    expected_violations = ['tab_switch', 'copy_paste', 'excessive_noise']
    missing_violations = [v for v in expected_violations if v not in db_violations]
    
    if missing_violations:
        print(f"\n❌ MISSING VIOLATIONS: {missing_violations}")
    else:
        print(f"\n✅ ALL EXPECTED VIOLATIONS FOUND")
    
    # Clean up test data
    cleanup_test_data()
    
    print("\n🏁 Testing Complete!")

if __name__ == "__main__":
    asyncio.run(run_all_tests())