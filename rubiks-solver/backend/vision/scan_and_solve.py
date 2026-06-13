
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from vision.color_detector import scan_all_faces, FACE_SCAN_ORDER
from cube.cube import Cube
from cube.validator import validate_cube
from solver.solver import solve


def main():
    parser = argparse.ArgumentParser(description="Scan and solve a Rubik's Cube via webcam")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--auto",   action="store_true",  help="Start in auto-capture mode")
    parser.add_argument("--post",   action="store_true",  help="POST result to FastAPI backend")
    parser.add_argument("--api",    default="http://localhost:8000", help="API base URL")
    args = parser.parse_args()

    print("=" * 50)
    print("  Rubik's Cube Scanner + Solver")
    print("=" * 50)
    print(f"  Camera index : {args.camera}")
    print(f"  Auto-capture : {'ON' if args.auto else 'OFF (press A to enable)'}")
    print(f"  API POST     : {'ON → ' + args.api if args.post else 'OFF'}")
    print("=" * 50)

    # ── Step 1: Scan all 6 faces ──────────────────────────────────────
    state = scan_all_faces(camera_index=args.camera)
    if state is None:
        print("\nScan cancelled.")
        sys.exit(0)

    # ── Step 2: Print detected colors ────────────────────────────────
    print("\n── Detected Colors ──────────────────────────────────────")
    for face in FACE_SCAN_ORDER:
        stickers = state[face]
        row = lambda r: " ".join(stickers[r*3:(r+1)*3])
        print(f"  {face}: {row(0)}  |  {row(1)}  |  {row(2)}")

    # ── Step 3: Validate ──────────────────────────────────────────────
    valid, err = validate_cube(state)
    if not valid:
        print(f"\n✗ Invalid cube state: {err}")
        print("  Tip: Re-scan under better lighting or adjust HSV thresholds")
        print("  in vision/color_detector.py → HSV_RANGES")
        sys.exit(1)
    print("\n✓ Cube state is valid")

    # ── Step 4: Solve ─────────────────────────────────────────────────
    print("\n── Solving ──────────────────────────────────────────────")
    cube = Cube(state)
    result = solve(cube)

    if not result["success"]:
        print(f"✗ Solver failed: {result.get('error')}")
        sys.exit(1)

    print(f"✓ Solved in {result['move_count']} moves  [{result['algorithm']}]  {result['time_seconds']}s")
    print(f"\n  Solution: {' '.join(result['moves'])}")
    print("\n── Step by step ─────────────────────────────────────────")
    for i, move in enumerate(result["moves"], 1):
        print(f"  {i:2d}. {move}")

    # ── Step 5: Optional POST to API ──────────────────────────────────
    if args.post:
        try:
            import urllib.request, json
            payload = json.dumps({"state": state, "algorithm": "auto"}).encode()
            req = urllib.request.Request(
                f"{args.api}/solve",
                data=payload,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                data = json.loads(resp.read())
            print(f"\n✓ API response: {data['move_count']} moves via {data['algorithm']}")
        except Exception as e:
            print(f"\n⚠ API POST failed: {e}")

    print("\n" + "=" * 50)
    print("  Done! Apply the moves above to your cube.")
    print("=" * 50)


if __name__ == "__main__":
    main()
