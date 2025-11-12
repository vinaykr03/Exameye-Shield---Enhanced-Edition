#!/usr/bin/env python3
"""Test WebSocket connection to proctoring backend"""
import asyncio
import websockets
import json
import base64

async def test_websocket():
    uri = "ws://localhost:8001/api/ws/proctoring/test-session-123"
    print(f"🔌 Connecting to: {uri}")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected successfully!")
            
            # Send a test frame message
            test_message = {
                "type": "frame",
                "frame": "data:image/jpeg;base64,/9j/4AAQSkZJRg==",  # Tiny test image
                "calibrated_pitch": 0.0,
                "calibrated_yaw": 0.0,
                "exam_id": "test-exam",
                "student_id": "test-student",
                "student_name": "Test Student",
                "audio_level": 10
            }
            
            print(f"📤 Sending test frame message...")
            await websocket.send(json.dumps(test_message))
            print("✅ Frame message sent")
            
            # Wait for response
            print("⏳ Waiting for response...")
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"📥 Received response: {response[:200]}")
            
            # Send browser activity test
            browser_activity = {
                "type": "browser_activity",
                "violation_type": "tab_switch",
                "message": "Test tab switch",
                "exam_id": "test-exam",
                "student_id": "test-student",
                "student_name": "Test Student"
            }
            
            print(f"📤 Sending browser activity...")
            await websocket.send(json.dumps(browser_activity))
            print("✅ Browser activity sent")
            
            # Wait for response
            response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
            print(f"📥 Received response: {response[:200]}")
            
    except websockets.exceptions.WebSocketException as e:
        print(f"❌ WebSocket error: {e}")
    except asyncio.TimeoutError:
        print("⏱️  Timeout waiting for response")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("🧪 Testing WebSocket connection to proctoring backend...\n")
    asyncio.run(test_websocket())
