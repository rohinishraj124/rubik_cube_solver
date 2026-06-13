"""
FastAPI Backend
===============
REST endpoints + WebSocket for browser-based webcam scanning.
"""

import sys
import os
import random
import base64

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional, Any

from cube.cube import Cube, SOLVED_STATE, FACES
from cube.validator import validate_cube
from solver.solver import solve

app = FastAPI(title="Rubik's Cube Solver API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALL_MOVES = [
    "U", "U'", "U2", "D", "D'", "D2",
    "R", "R'", "R2", "L", "L'", "L2",
    "F", "F'", "F2", "B", "B'", "B2",
]

FACE_SCAN_ORDER = ["U", "R", "F", "D", "L", "B"]


# ─── Pydantic Models ────────────────────────────────────────────────

class CubeState(BaseModel):
    state: Dict[str, List[str]]
    algorithm: Optional[str] = "auto"

class ScrambleRequest(BaseModel):
    num_moves: int = 20

class ApplyMovesRequest(BaseModel):
    state: Dict[str, List[str]]
    moves: List[str]


# ─── REST Endpoints ─────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "Rubik's Cube Solver API v2", "endpoints": [
        "POST /solve", "POST /scramble", "POST /validate",
        "POST /apply-moves", "GET /solved-state",
        "WS  /ws/scan  (browser webcam)"
    ]}


@app.post("/validate")
def validate(body: CubeState):
    valid, error = validate_cube(body.state)
    return {"valid": valid, "error": error}


@app.post("/solve")
def solve_cube(body: CubeState):
    valid, error = validate_cube(body.state)
    if not valid:
        raise HTTPException(400, f"Invalid cube state: {error}")
    cube = Cube(body.state)
    result = solve(cube, prefer=body.algorithm or "auto")
    if not result["success"]:
        raise HTTPException(422, result.get("error", "Solver failed"))
    return result


@app.post("/scramble")
def scramble(body: ScrambleRequest):
    cube = Cube()
    moves, last_face = [], None
    for _ in range(body.num_moves):
        candidates = [m for m in ALL_MOVES if m[0] != last_face]
        move = random.choice(candidates)
        cube.apply_move(move)
        moves.append(move)
        last_face = move[0]
    return {"state": cube.state, "scramble_moves": moves, "scramble_string": " ".join(moves)}


@app.post("/apply-moves")
def apply_moves(body: ApplyMovesRequest):
    try:
        cube = Cube(body.state)
        cube.apply_moves(body.moves)
    except ValueError as e:
        raise HTTPException(400, str(e))
    return {"state": cube.state, "is_solved": cube.is_solved()}


@app.get("/solved-state")
def get_solved_state():
    return {"state": SOLVED_STATE}


# ─── Python Script → Frontend Bridge ────────────────────────────────
_pending_scanned_state: dict = {"state": None, "version": 0}

@app.post("/set-scanned-state")
def set_scanned_state(body: CubeState):
    valid, error = validate_cube(body.state)
    if not valid:
        raise HTTPException(400, f"Invalid cube state: {error}")
    _pending_scanned_state["state"] = body.state
    _pending_scanned_state["version"] += 1
    return {"ok": True, "version": _pending_scanned_state["version"]}

@app.get("/poll-scanned-state")
def poll_scanned_state(since: int = 0):
    if _pending_scanned_state["version"] > since:
        return {"has_update": True, "state": _pending_scanned_state["state"], "version": _pending_scanned_state["version"]}
    return {"has_update": False, "version": _pending_scanned_state["version"]}


# ─── WebSocket — Browser Webcam Scanning ────────────────────────────

@app.websocket("/ws/scan")
async def websocket_scan(websocket: WebSocket):
    """
    Protocol:
      Client → Server:  {"type": "frame", "data": "<base64-jpeg>", "face": "U"}
      Server → Client:  {"type": "colors", "colors": ["W","R",...], "face": "U"}

      Client → Server:  {"type": "confirm", "face": "U", "colors": ["W","R",...]}
      Server → Client:  {"type": "confirmed", "face": "U", "progress": 1}

      Client → Server:  {"type": "solve", "state": {...}}
      Server → Client:  {"type": "solution", ...result...}
                   OR:  {"type": "error", "message": "..."}
    """
    await websocket.accept()

    # Try to import OpenCV for server-side detection
    try:
        from vision.color_detector import detect_from_base64
        has_cv2 = True
    except ImportError:
        has_cv2 = False

    try:
        while True:
            msg = await websocket.receive_json()
            msg_type = msg.get("type")

            # ── Frame: detect colors server-side ──────────────────────
            if msg_type == "frame":
                if not has_cv2:
                    await websocket.send_json({
                        "type": "error",
                        "message": "OpenCV not available on server — use client-side detection"
                    })
                    continue

                b64 = msg.get("data", "")
                face = msg.get("face", "U")
                try:
                    colors = detect_from_base64(b64)
                    await websocket.send_json({
                        "type": "colors",
                        "face": face,
                        "colors": colors
                    })
                except Exception as e:
                    await websocket.send_json({"type": "error", "message": str(e)})

            # ── Confirm: client locks in a face ───────────────────────
            elif msg_type == "confirm":
                face = msg.get("face")
                colors = msg.get("colors", [])
                progress = FACE_SCAN_ORDER.index(face) + 1 if face in FACE_SCAN_ORDER else 0
                await websocket.send_json({
                    "type": "confirmed",
                    "face": face,
                    "progress": progress
                })

            # ── Solve: client sends complete state ────────────────────
            elif msg_type == "solve":
                state = msg.get("state", {})
                algorithm = msg.get("algorithm", "auto")
                valid, err = validate_cube(state)
                if not valid:
                    await websocket.send_json({"type": "error", "message": f"Invalid: {err}"})
                    continue
                cube = Cube(state)
                result = solve(cube, prefer=algorithm)
                await websocket.send_json({"type": "solution", **result})

            else:
                await websocket.send_json({"type": "error", "message": f"Unknown message type: {msg_type}"})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except:
            pass
