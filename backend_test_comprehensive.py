#!/usr/bin/env python3
"""
Comprehensive Backend Testing Suite for AI Proctoring System
Tests all backend functionality as requested in the review
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
import cv2
import numpy as np

# Configuration from review request
BACKEND_URL = "https://install-and-run-1.preview.emergentagent.com"
WS_URL = "wss://install-and-run-1.preview.emergentagent.com"

# Test data
TEST_SESSION_ID = "test-session"
TEST_EXAM_ID = "test-exam"
TEST_STUDENT_ID = "test-student"
TEST_STUDENT_NAME = "Test Student"

def create_test_image_base64():
    """Create a simple test image in base64 format"""
    # Create a simple 100x100 black image
    img = np.zeros((100, 100, 3), dtype=np.uint8)
    _, buffer = cv2.imencode('.jpg', img)
    img_base64 = base64.b64encode(buffer).decode('utf-8')
    return f"data:image/jpeg;base64,{img_base64}"

def test_1_health_check():
    """Test 1: Health Check - GET /health"""
    print("=== TEST 1: Health Check ===")
    
    try:
        response = requests.get(f"{BACKEND_URL}/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"Response: {data}")
                
                models_loaded = data.get('models_loaded', False)
                if models_loaded:
                    print("✅ PASS: Health check successful, models_loaded: true")
                    return True
                else:
                    print("❌ FAIL: models_loaded is false")
                    return False
            except:
                print("❌ FAIL: Invalid JSON response")
                return False
        else:
            print(f"❌ FAIL: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

def test_2_environment_check():
    """Test 2: Environment Check - POST /api/environment-check"""
    print("\n=== TEST 2: Environment Check ===")
    
    try:
        test_image = create_test_image_base64()
        payload = {"frame_base64": test_image}
        
        response = requests.post(f"{BACKEND_URL}/api/environment-check", json=payload, timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Response: {data}")
            
            # Check required fields
            has_lighting = 'lighting_ok' in data
            has_face_detected = 'face_detected' in data
            
            if has_lighting and has_face_detected:
                print("✅ PASS: Environment check working, returns lighting_ok and face_detected")
                return True
            else:
                print("❌ FAIL: Missing required fields")
                return False
        else:
            print(f"❌ FAIL: HTTP {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ FAIL: Exception - {e}")
        return False

async def test_3_websocket_connection():
    """Test 3: WebSocket Connection Test"""
    print("\n=== TEST 3: WebSocket Connection ===")
    
    ws_endpoint = f"{WS_URL}/api/ws/proctoring/{TEST_SESSION_ID}"
    print(f"Connecting to: {ws_endpoint}")
    
    try:
        async with websockets.connect(ws_endpoint) as websocket:
            print("✅ WebSocket connection established successfully")
            
            # Test ping/pong
            ping_message = {"type": "ping"}
            await websocket.send(json.dumps(ping_message))
            
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            response_data = json.loads(response)
            
            if response_data.get("type") == "pong":
                print("✅ PASS: WebSocket connection and ping/pong working")
                return True
            else:
                print(f"❌ FAIL: Unexpected ping response: {response_data}")
                return False
                
    except Exception as e:
        print(f"❌ FAIL: WebSocket connection failed - {e}")
        return False

async def test_4_frame_processing():
    """Test 4: Frame Processing via WebSocket"""
    print("\n=== TEST 4: Frame Processing ===")
    
    ws_endpoint = f"{WS_URL}/api/ws/proctoring/{TEST_SESSION_ID}"
    
    try:
        async with websockets.connect(ws_endpoint) as websocket:
            print("✅ WebSocket connected for frame testing")
            
            # Create test frame message
            test_image = create_test_image_base64()
            frame_message = {
                "type": "frame",
                "frame": test_image,
                "calibrated_pitch": 0.0,
                "calibrated_yaw": 0.0,
                "exam_id": TEST_EXAM_ID,
                "student_id": TEST_STUDENT_ID,
                "student_name": TEST_STUDENT_NAME,
                "audio_level": 10
            }
            
            print("📤 Sending test frame...")
            await websocket.send(json.dumps(frame_message))
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                response_data = json.loads(response)
                print(f"📥 Received response: {response_data}")
                
                if response_data.get("type") in ["detection_result", "detection_skipped"]:
                    print("✅ PASS: Frame processing working, received detection response")
                    return True
                else:
                    print(f"❌ FAIL: Unexpected response type: {response_data.get('type')}")
                    return False
                    
            except asyncio.TimeoutError:
                print("❌ FAIL: Timeout waiting for frame processing response")
                return False
                
    except Exception as e:
        print(f"❌ FAIL: Frame processing test failed - {e}")
        return False

async def test_5_browser_activity():
    """Test 5: Browser Activity Test"""
    print("\n=== TEST 5: Browser Activity ===")
    
    ws_endpoint = f"{WS_URL}/api/ws/proctoring/{TEST_SESSION_ID}"
    
    try:
        async with websockets.connect(ws_endpoint) as websocket:
            print("✅ WebSocket connected for browser activity testing")
            
            # Test browser activity message
            browser_message = {
                "type": "browser_activity",
                "exam_id": TEST_EXAM_ID,
                "student_id": TEST_STUDENT_ID,
                "student_name": TEST_STUDENT_NAME,
                "violation_type": "tab_switch",
                "message": "Student switched tabs"
            }
            
            print("📤 Sending browser activity violation...")
            await websocket.send(json.dumps(browser_message))
            
            # Wait for response
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=10.0)
                response_data = json.loads(response)
                print(f"📥 Received response: {response_data}")
                
                if response_data.get("type") == "violation":
                    violation_data = response_data.get("data", {})
                    if violation_data.get("type") == "tab_switch":
                        print("✅ PASS: Browser activity violation processed correctly")
                        return True
                    else:
                        print(f"❌ FAIL: Wrong violation type: {violation_data.get('type')}")
                        return False
                else:
                    print(f"❌ FAIL: Expected violation response, got: {response_data.get('type')}")
                    return False
                    
            except asyncio.TimeoutError:
                print("❌ FAIL: Timeout waiting for browser activity response")
                return False
                
    except Exception as e:
        print(f"❌ FAIL: Browser activity test failed - {e}")
        return False

def check_backend_logs():
    """Check backend logs for frame processing"""
    print("\n=== BACKEND LOGS CHECK ===")
    
    try:
        # Check recent backend logs
        import subprocess
        result = subprocess.run(['tail', '-n', '20', '/var/log/supervisor/backend.err.log'], 
                              capture_output=True, text=True)
        
        logs = result.stdout
        print("Recent backend logs:")
        print(logs)
        
        # Look for key indicators
        if "📥 Received message type: frame" in logs:
            print("✅ Backend is receiving frame messages")
        else:
            print("❌ No frame messages found in logs")
            
        if "WebSocket connected:" in logs:
            print("✅ WebSocket connections are being established")
        else:
            print("❌ No WebSocket connections found in logs")
            
    except Exception as e:
        print(f"❌ Could not check backend logs: {e}")

async def run_comprehensive_tests():
    """Run all tests as specified in the review request"""
    print("🚀 COMPREHENSIVE BACKEND TESTING SUITE")
    print("=" * 60)
    print(f"Backend URL: {BACKEND_URL}")
    print(f"WebSocket URL: {WS_URL}")
    print(f"Test Session: {TEST_SESSION_ID}")
    print("=" * 60)
    
    results = {}
    
    # Test 1: Health Check
    results['health_check'] = test_1_health_check()
    
    # Test 2: Environment Check
    results['environment_check'] = test_2_environment_check()
    
    # Test 3: WebSocket Connection
    results['websocket_connection'] = await test_3_websocket_connection()
    
    # Test 4: Frame Processing
    results['frame_processing'] = await test_4_frame_processing()
    
    # Test 5: Browser Activity
    results['browser_activity'] = await test_5_browser_activity()
    
    # Check backend logs
    check_backend_logs()
    
    # Final Summary
    print("\n" + "=" * 60)
    print("📊 FINAL TEST RESULTS")
    print("=" * 60)
    
    passed = 0
    total = len(results)
    
    for test_name, result in results.items():
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name.replace('_', ' ').title()}: {status}")
        if result:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 ALL TESTS PASSED - Backend AI detection functionality working!")
    else:
        print("⚠️  SOME TESTS FAILED - Issues found in backend functionality")
    
    return results

if __name__ == "__main__":
    asyncio.run(run_comprehensive_tests())