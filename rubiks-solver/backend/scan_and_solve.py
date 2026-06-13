"""
scan_and_solve.py
==================
Run this script alongside the FastAPI backend to scan your physical cube
with OpenCV and automatically send the result to the React frontend.

Usage:
    python scan_and_solve.py

Controls:
    SPACE  → capture current face
    R      → retake last face
    Q      → quit

Requirements:
    pip install opencv-python numpy requests
"""

import cv2
import numpy as np
import requests
import json
import sys
import os
import time

sys.path.insert(0, os.path.dirname(__file__))

API_URL = "http://localhost:8000"

FACE_ORDER = ["U", "R", "F", "D", "L", "B"]
FACE_LABELS = {
    "U": "TOP face — White center facing UP",
    "D": "BOTTOM face — Yellow center facing UP",
    "F": "FRONT face — Green center facing YOU",
    "B": "BACK face — Blue center facing YOU",
    "L": "LEFT face — Orange center facing YOU",
    "R": "RIGHT face — Red center facing YOU",
}

# HSV ranges for each color (OpenCV: H=0-179, S=0-255, V=0-255)
HSV_RANGES = {
    "W": [(np.array([0,   0,   170]), np.array([179, 60,  255]))],
    "Y": [(np.array([20,  100, 100]), np.array([38,  255, 255]))],
    "G": [(np.array([55,  80,  60]),  np.array([95,  255, 255]))],
    "B": [(np.array([95,  80,  60]),  np.array([135, 255, 255]))],
    "R": [(np.array([0,   120, 80]),  np.array([10,  255, 255])),
          (np.array([165, 120, 80]),  np.array([179, 255, 255]))],
    "O": [(np.array([10,  120, 80]),  np.array([22,  255, 255]))],
}

COLOR_BGR = {
    "W": (255, 255, 255),
    "Y": (0, 220, 255),
    "G": (0, 200, 50),
    "B": (220, 100, 0),
    "R": (0, 0, 220),
    "O": (0, 140, 255),
}


def classify_hsv(h, s, v):
    for color, ranges in HSV_RANGES.items():
        for lo, hi in ranges:
            if lo[0] <= h <= hi[0] and lo[1] <= s <= hi[1] and lo[2] <= v <= hi[2]:
                return color
    # Fallback by hue only
    if v > 170 and s < 60:
        return "W"
    if h < 12 or h > 165:
        return "R"
    if h < 22:
        return "O"
    if h < 40:
        return "Y"
    if h < 95:
        return "G"
    return "B"


def sample_face(frame, gx, gy, grid_size):
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    cell = grid_size // 3
    colors = []
    for row in range(3):
        for col in range(3):
            cx = gx + col * cell + cell // 2
            cy = gy + row * cell + cell // 2
            r = 8
            patch = hsv[max(0,cy-r):cy+r, max(0,cx-r):cx+r]
            if patch.size == 0:
                colors.append("W")
                continue
            median = np.median(patch.reshape(-1, 3), axis=0).astype(int)
            colors.append(classify_hsv(*median))
    return colors


def draw_overlay(frame, gx, gy, grid_size, colors, face, face_idx):
    cell = grid_size // 3
    h, w = frame.shape[:2]

    # Grid border
    cv2.rectangle(frame, (gx, gy), (gx + grid_size, gy + grid_size), (100, 255, 180), 3)

    for row in range(3):
        for col in range(3):
            x = gx + col * cell
            y = gy + row * cell
            color = colors[row * 3 + col]
            bgr = COLOR_BGR.get(color, (128, 128, 128))

            # Filled cell
            cv2.rectangle(frame, (x+4, y+4), (x+cell-4, y+cell-4), bgr, -1)
            # Border
            cv2.rectangle(frame, (x+4, y+4), (x+cell-4, y+cell-4), (0, 0, 0), 1)
            # Label
            label_color = (0, 0, 0) if color == "W" else (255, 255, 255)
            cv2.putText(frame, color,
                        (x + cell//2 - 8, y + cell//2 + 6),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.55, label_color, 2)

    # Face label
    cv2.putText(frame, f"[{face}] {FACE_LABELS[face]}",
                (10, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (100, 255, 180), 2)

    # Progress
    cv2.putText(frame, f"Face {face_idx+1} / 6",
                (10, 65), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1)

    # Controls
    cv2.putText(frame, "SPACE=capture  R=retake  Q=quit",
                (10, h - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (150, 150, 150), 1)

    return frame


def scan_cube(camera_index=0):
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        print("ERROR: Could not open camera. Try camera_index=1 if you have multiple cameras.")
        return None

    scanned = {}
    face_idx = 0

    print("\n" + "="*50)
    print("  Rubik's Cube OpenCV Scanner")
    print("="*50)
    print("  SPACE = capture face")
    print("  R     = retake previous face")
    print("  Q     = quit")
    print("="*50 + "\n")

    while face_idx < len(FACE_ORDER):
        ret, frame = cap.read()
        if not ret:
            print("Camera read failed.")
            break

        frame = cv2.flip(frame, 1)  # mirror
        h, w = frame.shape[:2]

        grid_size = min(w, h) * 55 // 100
        gx = (w - grid_size) // 2
        gy = (h - grid_size) // 2

        face = FACE_ORDER[face_idx]
        colors = sample_face(frame, gx, gy, grid_size)
        frame = draw_overlay(frame, gx, gy, grid_size, colors, face, face_idx)

        # Show already-scanned faces in sidebar
        for i, f in enumerate(FACE_ORDER[:face_idx]):
            label = f"{f}: {' '.join(scanned[f])}"
            cv2.putText(frame, label, (10, 100 + i * 22),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (80, 220, 140), 1)

        cv2.imshow("Rubik's Cube Scanner — press Q to quit", frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord(" "):
            scanned[face] = colors
            print(f"  ✓ Captured {face}: {colors}")
            face_idx += 1
            time.sleep(0.2)

        elif key == ord("r") and face_idx > 0:
            face_idx -= 1
            old_face = FACE_ORDER[face_idx]
            del scanned[old_face]
            print(f"  ↩ Retaking {old_face}")

        elif key == ord("q"):
            print("Scan cancelled.")
            cap.release()
            cv2.destroyAllWindows()
            return None

    cap.release()
    cv2.destroyAllWindows()

    if len(scanned) == 6:
        print("\n✓ All 6 faces scanned!")
        return scanned
    return None


def post_state_to_api(state):
    """POST scanned state to FastAPI so the React frontend updates live."""
    try:
        r = requests.post(f"{API_URL}/set-scanned-state",
                          json={"state": state}, timeout=3)
        if r.status_code == 200:
            print("✓ State sent to frontend — check your browser!")
            return True
        else:
            print(f"API error: {r.status_code} {r.text}")
    except requests.exceptions.ConnectionError:
        print(f"⚠ Could not connect to API at {API_URL}")
        print("  Make sure the backend is running: uvicorn api.main:app --reload --port 8000")
    return False


def main():
    print(f"\nChecking API connection at {API_URL}...")
    try:
        r = requests.get(f"{API_URL}/", timeout=2)
        print(f"✓ Backend is running (v{r.json().get('version', '?')})\n")
    except Exception:
        print(f"⚠ Backend not reachable at {API_URL}")
        print("  Start it with: uvicorn api.main:app --reload --port 8000")
        print("  Continuing in offline mode — solution will print to terminal.\n")

    state = scan_cube()
    if state is None:
        return

    print("\nScanned state:")
    for face, colors in state.items():
        print(f"  {face}: {colors}")

    # Try to send to frontend
    sent = post_state_to_api(state)

    # Also solve locally and print
    print("\nSolving...")
    try:
        r = requests.post(f"{API_URL}/solve",
                          json={"state": state, "algorithm": "auto"}, timeout=30)
        if r.status_code == 200:
            data = r.json()
            print(f"\n✓ Solution ({data['move_count']} moves, {data['algorithm']}, {data['time_seconds']}s):")
            print("  " + " ".join(data["moves"]))
        else:
            print(f"Solve error: {r.text}")
    except Exception as e:
        print(f"Could not solve via API: {e}")


if __name__ == "__main__":
    main()
