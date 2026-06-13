
import cv2
import numpy as np
from typing import List, Tuple, Optional, Dict
import time

# ─── HSV Color Ranges ────────────────────────────────────────────────
HSV_RANGES = {
    "W": [(np.array([0,   0,   160]), np.array([179, 55,  255]))],
    "Y": [(np.array([20,  100, 100]), np.array([35,  255, 255]))],
    "G": [(np.array([55,  80,  60]),  np.array([85,  255, 255]))],
    "B": [(np.array([100, 80,  60]),  np.array([130, 255, 255]))],
    "R": [(np.array([0,   100, 80]),  np.array([10,  255, 255])),
          (np.array([165, 100, 80]),  np.array([179, 255, 255]))],
    "O": [(np.array([10,  130, 100]), np.array([22,  255, 255]))],
}

# BGR for display
COLOR_BGR = {
    "W": (240, 240, 240),
    "Y": (0,   210, 255),
    "G": (30,  180,  30),
    "B": (200,  60,  10),
    "R": (20,   20, 210),
    "O": (20,  130, 255),
}

FACE_SCAN_ORDER = ["U", "R", "F", "D", "L", "B"]
FACE_INSTRUCTIONS = {
    "U": "TOP face  — White center facing UP,  Green facing you",
    "R": "RIGHT face — Red center facing you,   White on top",
    "F": "FRONT face — Green center facing you, White on top",
    "D": "BOTTOM face — Yellow center facing UP, Green facing you",
    "L": "LEFT face  — Orange center facing you, White on top",
    "B": "BACK face  — Blue center facing you,   White on top",
}


def classify_color(hsv_pixel: np.ndarray) -> str:
    h, s, v = int(hsv_pixel[0]), int(hsv_pixel[1]), int(hsv_pixel[2])
    for color, ranges in HSV_RANGES.items():
        for lower, upper in ranges:
            if lower[0] <= h <= upper[0] and lower[1] <= s <= upper[1] and lower[2] <= v <= upper[2]:
                return color
    # Fallback: nearest by luminance/saturation
    if s < 60 and v > 150:
        return "W"
    return "W"


def sample_face(frame: np.ndarray, grid_x: int, grid_y: int, grid_size: int) -> List[str]:
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    cell = grid_size // 3
    colors = []
    for row in range(3):
        for col in range(3):
            cx = grid_x + col * cell + cell // 2
            cy = grid_y + row * cell + cell // 2
            r = max(4, cell // 6)
            patch = hsv[max(0, cy - r):cy + r, max(0, cx - r):cx + r]
            if patch.size == 0:
                colors.append("W")
                continue
            avg = np.median(patch.reshape(-1, 3), axis=0).astype(np.uint8)
            colors.append(classify_color(avg))
    return colors


def draw_overlay(frame: np.ndarray, grid_x: int, grid_y: int, grid_size: int,
                 face: str, face_idx: int, detected: Optional[List[str]],
                 confirmed: List[str], countdown: Optional[int] = None) -> np.ndarray:
    frame = frame.copy()
    h_fr, w_fr = frame.shape[:2]
    cell = grid_size // 3

    # Semi-transparent dark overlay outside grid
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (w_fr, h_fr), (0, 0, 0), -1)
    cv2.rectangle(overlay, (grid_x, grid_y), (grid_x + grid_size, grid_y + grid_size),
                  (0, 0, 0), -1)
    frame = cv2.addWeighted(overlay, 0.35, frame, 0.65, 0)

    # Draw sticker cells
    for row in range(3):
        for col in range(3):
            cx = grid_x + col * cell
            cy = grid_y + row * cell
            idx = row * 3 + col

            if detected:
                c = detected[idx]
                bgr = COLOR_BGR.get(c, (128, 128, 128))
                cv2.rectangle(frame, (cx + 3, cy + 3), (cx + cell - 3, cy + cell - 3), bgr, -1)
                cv2.rectangle(frame, (cx + 3, cy + 3), (cx + cell - 3, cy + cell - 3),
                              (255, 255, 255), 1)
                # Center dot to show sample point
                cv2.circle(frame, (cx + cell // 2, cy + cell // 2), 4, (0, 0, 0), -1)
                cv2.putText(frame, c, (cx + cell // 2 - 7, cy + cell // 2 + 5),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1)
            else:
                cv2.rectangle(frame, (cx, cy), (cx + cell, cy + cell), (80, 80, 80), 1)

    # Grid border
    border_color = (0, 255, 100) if countdown else (0, 220, 255)
    cv2.rectangle(frame, (grid_x - 2, grid_y - 2),
                  (grid_x + grid_size + 2, grid_y + grid_size + 2), border_color, 3)

    # Countdown circle
    if countdown is not None:
        cx_c, cy_c = grid_x + grid_size // 2, grid_y - 40
        cv2.circle(frame, (cx_c, cy_c), 28, (0, 255, 100), -1)
        cv2.putText(frame, str(countdown), (cx_c - 8, cy_c + 8),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 0, 0), 2)

    # Top bar
    cv2.rectangle(frame, (0, 0), (w_fr, 58), (20, 20, 20), -1)
    cv2.putText(frame, f"Face {face_idx + 1}/6: {FACE_INSTRUCTIONS.get(face, face)}",
                (12, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 255), 1)
    cv2.putText(frame, "SPACE = capture    A = auto-capture    Q = quit",
                (12, 46), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (160, 160, 160), 1)

    # Progress bar
    bar_w = int((face_idx / 6) * w_fr)
    cv2.rectangle(frame, (0, h_fr - 6), (bar_w, h_fr), (0, 200, 100), -1)

    # Already-scanned faces in bottom-left
    for i, f in enumerate(FACE_SCAN_ORDER[:face_idx]):
        cv2.putText(frame, f"✓ {f}", (10, h_fr - 20 - (len(FACE_SCAN_ORDER[:face_idx]) - 1 - i) * 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 200, 80), 1)

    # Detected color summary bottom-right
    if detected:
        cv2.putText(frame, " ".join(detected),
                    (w_fr - 220, h_fr - 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (200, 200, 200), 1)

    return frame


def scan_all_faces(camera_index: int = 0,
                   auto_capture_delay: float = 2.5) -> Optional[Dict[str, List[str]]]:
    cap = cv2.VideoCapture(camera_index)
    if not cap.isOpened():
        print(f"ERROR: Cannot open camera index {camera_index}")
        return None

    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 800)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 600)

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    grid_size = min(w, h) * 2 // 5
    grid_x = (w - grid_size) // 2
    grid_y = (h - grid_size) // 2

    scanned: Dict[str, List[str]] = {}
    face_idx = 0
    auto_mode = False
    auto_start_time: Optional[float] = None
    STEADY_SECS = auto_capture_delay

    print("\n=== Rubik's Cube Scanner ===")
    print("Hold each face inside the yellow grid.")
    print("SPACE = capture | A = toggle auto | Q = quit\n")

    while face_idx < len(FACE_SCAN_ORDER):
        face = FACE_SCAN_ORDER[face_idx]
        ret, frame = cap.read()
        if not ret:
            break
        frame = cv2.flip(frame, 1)

        detected = sample_face(frame, grid_x, grid_y, grid_size)

        countdown_val = None
        if auto_mode and auto_start_time is not None:
            elapsed = time.time() - auto_start_time
            remaining = max(0, int(STEADY_SECS - elapsed) + 1)
            countdown_val = remaining

        frame = draw_overlay(frame, grid_x, grid_y, grid_size,
                             face, face_idx, detected,
                             list(scanned.keys()), countdown_val)

        cv2.imshow("Rubik's Cube Scanner — Rohinish Raj", frame)
        key = cv2.waitKey(1) & 0xFF

        def capture():
            nonlocal face_idx, auto_start_time
            scanned[face] = detected
            print(f"  ✓ {face}: {' '.join(detected)}")
            face_idx += 1
            auto_start_time = None
            time.sleep(0.2)

        if key == ord(' '):
            capture()

        elif key == ord('a') or key == ord('A'):
            auto_mode = not auto_mode
            auto_start_time = time.time() if auto_mode else None
            print(f"  Auto-capture {'ON' if auto_mode else 'OFF'}")

        elif key == ord('q') or key == ord('Q'):
            print("Scan aborted.")
            cap.release()
            cv2.destroyAllWindows()
            return None

        # Auto-capture trigger
        if auto_mode:
            if auto_start_time is None:
                auto_start_time = time.time()
            elif time.time() - auto_start_time >= STEADY_SECS:
                capture()
                if auto_mode and face_idx < len(FACE_SCAN_ORDER):
                    auto_start_time = time.time()

    cap.release()
    cv2.destroyAllWindows()

    if len(scanned) == 6:
        print("\n✓ All 6 faces scanned!")
        return scanned
    return None


def frame_to_base64(frame: np.ndarray) -> str:
    import base64
    _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return base64.b64encode(buf).decode('utf-8')


def base64_to_frame(b64: str) -> np.ndarray:
    import base64
    data = base64.b64decode(b64)
    arr = np.frombuffer(data, np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)


def detect_from_base64(b64_frame: str, grid_rel: float = 0.42) -> List[str]:
    frame = base64_to_frame(b64_frame)
    h, w = frame.shape[:2]
    grid_size = int(min(w, h) * grid_rel)
    grid_x = (w - grid_size) // 2
    grid_y = (h - grid_size) // 2
    return sample_face(frame, grid_x, grid_y, grid_size)
