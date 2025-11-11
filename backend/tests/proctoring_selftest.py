import asyncio
import base64
import json
import os
from io import BytesIO

import requests
from PIL import Image, ImageDraw
import websockets


def make_test_image(width: int = 640, height: int = 480) -> str:
	"""
	Create a simple RGB image with a face-like rectangle and return as data URL base64.
	This avoids needing an actual webcam frame while still exercising the pipeline.
	"""
	img = Image.new("RGB", (width, height), (180, 180, 180))
	draw = ImageDraw.Draw(img)
	# Draw a pseudo face
	face_box = (int(width * 0.35), int(height * 0.25), int(width * 0.65), int(height * 0.65))
	draw.rectangle(face_box, outline=(20, 20, 20), width=4)
	# Eyes
	draw.ellipse((int(width * 0.42), int(height * 0.38), int(width * 0.47), int(height * 0.43)), fill=(0, 0, 0))
	draw.ellipse((int(width * 0.53), int(height * 0.38), int(width * 0.58), int(height * 0.43)), fill=(0, 0, 0))
	# Mouth
	draw.arc((int(width * 0.45), int(height * 0.50), int(width * 0.55), int(height * 0.60)), start=0, end=180, fill=(0, 0, 0), width=3)

	buf = BytesIO()
	img.save(buf, format="JPEG", quality=85)
	data = base64.b64encode(buf.getvalue()).decode("utf-8")
	return f"data:image/jpeg;base64,{data}"


def http_selftest(api_base: str) -> None:
	print(f"[HTTP] Health check: {api_base}/health")
	r = requests.get(f"{api_base}/health", timeout=10)
	r.raise_for_status()
	print("  OK:", r.json())

	frame_b64 = make_test_image()

	print(f"[HTTP] Environment check: {api_base}/api/environment-check")
	r = requests.post(f"{api_base}/api/environment-check", json={"frame_base64": frame_b64}, timeout=20)
	r.raise_for_status()
	print("  OK:", r.json())

	print(f"[HTTP] Calibrate: {api_base}/api/calibrate")
	r = requests.post(f"{api_base}/api/calibrate", json={"frame_base64": frame_b64}, timeout=20)
	r.raise_for_status()
	cal = r.json()
	print("  OK:", cal)

	print(f"[HTTP] Process frame: {api_base}/api/process-frame")
	payload = {
		"session_id": "selftest-session",
		"frame_base64": frame_b64,
		"calibrated_pitch": float(cal.get("pitch", 0.0) or 0.0),
		"calibrated_yaw": float(cal.get("yaw", 0.0) or 0.0),
	}
	r = requests.post(f"{api_base}/api/process-frame", json=payload, timeout=30)
	r.raise_for_status()
	print("  OK:", r.json())


async def websocket_selftest(ws_base: str) -> None:
	url = f"{ws_base}/api/ws/proctoring/selftest-session"
	print(f"[WS] Connecting: {url}")
	async with websockets.connect(url, ping_interval=None) as ws:
		# Expect connection open without error
		print("  Connected.")
		# Send one frame message
		frame_b64 = make_test_image()
		msg = {
			"type": "frame",
			"frame": frame_b64,
			"calibrated_pitch": 0.0,
			"calibrated_yaw": 0.0,
			"exam_id": "selftest-exam",
			"student_id": "selftest-student",
			"student_name": "Self Test",
			"audio_level": 0,
		}
		await ws.send(json.dumps(msg))
		# Wait for a response or throttle notification
		try:
			reply = await asyncio.wait_for(ws.recv(), timeout=10)
			data = json.loads(reply)
			print("  Message:", data.get("type"))
		except asyncio.TimeoutError:
			print("  Warning: No message received within timeout (this may be fine if throttled).")


def main():
	api_base = os.environ.get("PROCTORING_API_URL", "http://localhost:8001")
	ws_base = os.environ.get("PROCTORING_WS_URL", "ws://localhost:8001")

	try:
		http_selftest(api_base)
		asyncio.run(websocket_selftest(ws_base))
		print("\n✅ Self-test completed successfully.")
	except Exception as e:
		print(f"\n❌ Self-test failed: {e}")
		raise


if __name__ == "__main__":
	main()


