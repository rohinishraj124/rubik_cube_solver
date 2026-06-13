<p align="center">
  <h1 align="center">🟧 Rubik's Cube Solver</h1>
  <p align="center">
    Vision-based 3×3 Rubik's Cube solver with webcam scanning, dual algorithms, and an interactive React frontend.
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white" />
    <img src="https://img.shields.io/badge/FastAPI-0.100+-009688?style=flat&logo=fastapi&logoColor=white" />
    <img src="https://img.shields.io/badge/React-18+-61DAFB?style=flat&logo=react&logoColor=black" />
    <img src="https://img.shields.io/badge/OpenCV-4.x-5C3EE8?style=flat&logo=opencv&logoColor=white" />
    <img src="https://img.shields.io/badge/Docker-ready-2496ED?style=flat&logo=docker&logoColor=white" />
    <a href="https://rubik-cube-solver-glbd.onrender.com/">
      <img src="https://img.shields.io/badge/Live%20Demo-Render-46E3B7?style=flat&logo=render&logoColor=white" />
    </a>
  </p>
  <p align="center">
    <a href="https://rubik-cube-solver-glbd.onrender.com/">🚀 Try it live → rubik-cube-solver-glbd.onrender.com</a>
  </p>
</p>

---

## What It Does

Point your webcam at each face of a scrambled Rubik's Cube, and this app will detect the colors, validate the cube state, compute an optimal solution, and play back the moves step by step in an interactive UI.

- **Webcam face scanning** — live HSV color detection with OpenCV, one face at a time
- **Two solving algorithms** — IDA\* for short scrambles, Kociemba two-phase for deep ones (auto-routed)
- **Physical validation** — corner and edge parity checks before solving
- **REST API** — FastAPI backend with Swagger docs
- **Interactive frontend** — React cube net visualization with animated solution playback
- **Docker support** — single container deployment

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Python, FastAPI, OpenCV, IDA\*, Kociemba |
| Frontend | React 18, Vite, CSS |
| Deployment | Docker, Render |

---

## Project Structure

```
rubiks-solver/
├── backend/
│   ├── cube/
│   │   ├── cube.py               # Cube state representation + all 18 moves
│   │   └── validator.py          # Corner/edge parity validation
│   ├── solver/
│   │   ├── ida_star.py           # IDA* search from scratch
│   │   ├── kociemba_solver.py    # Kociemba two-phase wrapper
│   │   └── solver.py             # Auto-router: picks best algorithm
│   ├── vision/
│   │   └── color_detector.py     # Webcam capture + HSV color classification
│   ├── api/
│   │   └── main.py               # FastAPI endpoints
│   ├── tests/
│   │   └── test_cube.py          # Unit tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx               # Main UI orchestrator
│   │   ├── components/
│   │   │   ├── CubeFace.jsx      # Single 3×3 face grid
│   │   │   ├── CubeNet.jsx       # Unfolded cube cross view
│   │   │   ├── SolutionViewer.jsx# Animated step-by-step playback
│   │   │   └── ManualInput.jsx   # Paint-by-click input
│   │   └── utils/
│   │       ├── api.js            # API client
│   │       └── cube.js           # Cube state utilities
│   ├── index.html
│   └── package.json
├── Dockerfile
└── .dockerignore
```

---

## Getting Started

### Option A — Docker (recommended)

```bash
docker build -t rubiks-solver .
docker run -p 8000:8000 -p 3000:3000 rubiks-solver
```

Open: http://localhost:3000

### Option B — Local Dev

**Backend**

```bash
cd rubiks-solver/backend

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
uvicorn api.main:app --reload --port 8000
```

Interactive API docs: http://localhost:8000/docs

**Frontend**

```bash
cd rubiks-solver/frontend
npm install
npm run dev
```

Open: http://localhost:3000

**Run Tests**

```bash
cd rubiks-solver/backend
python -m pytest tests/ -v
```

---

## Webcam Scanning

With a physical cube and a webcam connected:

```bash
cd rubiks-solver/backend
python -c "
from vision.color_detector import scan_all_faces
from solver.solver import solve
from cube.cube import Cube

state = scan_all_faces()   # Follow on-screen prompts for each face
if state:
    result = solve(Cube(state))
    print('Solution:', ' '.join(result['moves']))
"
```

Follow the terminal prompts — hold each face up to the camera and press Enter to capture. Scan in this order: **U → D → F → B → L → R**.

---

## API Reference

Base URL: `http://localhost:8000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/solve` | Solve a cube state |
| `POST` | `/scramble` | Generate a random scramble |
| `POST` | `/validate` | Check physical validity of a state |
| `POST` | `/apply-moves` | Apply move sequence to a state |
| `POST` | `/manual-input` | Parse 9-char color strings per face |
| `GET`  | `/solved-state` | Return the solved cube state |

### Example — Solve a cube

```bash
curl -X POST http://localhost:8000/solve \
  -H "Content-Type: application/json" \
  -d '{
    "state": {
      "U": ["W","W","W","W","W","W","W","W","W"],
      "D": ["Y","Y","Y","Y","Y","Y","Y","Y","Y"],
      "F": ["G","G","G","G","G","G","G","G","G"],
      "B": ["B","B","B","B","B","B","B","B","B"],
      "L": ["O","O","O","O","O","O","O","O","O"],
      "R": ["R","R","R","R","R","R","R","R","R"]
    },
    "algorithm": "auto"
  }'
```

**Response**

```json
{
  "moves": ["R", "U", "R'", "F", "U2", "L'"],
  "move_count": 6,
  "algorithm": "ida_star",
  "time_ms": 42
}
```

---

## Algorithms

### IDA\* (Iterative Deepening A\*)

Implemented from scratch in `solver/ida_star.py`.

- **Heuristic:** misplaced stickers ÷ 8 (admissible, never overestimates)
- **Pruning:** no same-face back-to-back moves, no redundant opposite-face pairs
- **Best for:** scrambles ≤ 8 moves deep
- **Complexity:** Space O(d) · Time O(b^d)

### Kociemba Two-Phase

Wraps the `kociemba` library.

- **Phase 1:** Reduce cube into subgroup G1 = ⟨U, D, R², L², F², B²⟩
- **Phase 2:** Solve within G1
- **Output:** 18–22 move solutions in under 1 second
- **Best for:** deeply scrambled cubes

### Auto-Router

`solver/solver.py` measures scramble depth and picks the right algorithm automatically. You can also pass `"algorithm": "ida_star"` or `"algorithm": "kociemba"` explicitly.

---

## Notation

### Colors

| Code | Color | Face |
|------|-------|------|
| `W` | White | Up (U) |
| `Y` | Yellow | Down (D) |
| `G` | Green | Front (F) |
| `B` | Blue | Back (B) |
| `R` | Red | Right (R) |
| `O` | Orange | Left (L) |

### Moves

| Move | Effect |
|------|--------|
| `R` | Right face 90° clockwise |
| `R'` | Right face 90° counter-clockwise |
| `R2` | Right face 180° |
| `U`, `D`, `F`, `B`, `L` | Same pattern per face |
