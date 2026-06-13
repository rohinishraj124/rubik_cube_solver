
import time
from typing import Optional, List, Dict, Any
from cube.cube import Cube
from solver.ida_star import solve_ida_star
from solver.kociemba_solver import solve_kociemba, is_kociemba_available


def solve(cube: Cube, prefer: str = "auto") -> Dict[str, Any]:
    
    if cube.is_solved():
        return {"success": True, "moves": [], "move_count": 0,
                "algorithm": "none", "time_seconds": 0.0}

    result = {"success": False, "moves": [], "move_count": 0,
              "algorithm": "", "time_seconds": 0.0, "error": ""}

    start = time.time()

    # ── Try Kociemba first if preferred ─────────────────────────────
    if prefer == "kociemba":
        if is_kociemba_available():
            solution = solve_kociemba(cube)
            if solution is not None:
                elapsed = time.time() - start
                return {"success": True, "moves": solution,
                        "move_count": len(solution), "algorithm": "Kociemba",
                        "time_seconds": round(elapsed, 3)}
        else:
            result["error"] = (
                "kociemba not installed. On Windows, install C++ Build Tools first: "
                "https://visualstudio.microsoft.com/visual-cpp-build-tools/ "
                "then run: pip install kociemba"
            )
        # Fall through to IDA*

    # ── IDA* (shallow) ───────────────────────────────────────────────
    if prefer in ("ida_star", "auto"):
        depth = 8 if prefer == "auto" else 20
        solution = solve_ida_star(cube, max_depth=depth, time_limit=8.0)
        if solution is not None:
            elapsed = time.time() - start
            return {"success": True, "moves": solution,
                    "move_count": len(solution), "algorithm": "IDA*",
                    "time_seconds": round(elapsed, 3)}

    # ── Try Kociemba (auto fallback) ─────────────────────────────────
    if prefer == "auto" and is_kociemba_available():
        solution = solve_kociemba(cube)
        if solution is not None:
            elapsed = time.time() - start
            return {"success": True, "moves": solution,
                    "move_count": len(solution), "algorithm": "Kociemba",
                    "time_seconds": round(elapsed, 3)}

    # ── Deep IDA* fallback (no kociemba) ────────────────────────────
    # Slower but works without any C compiler
    print("[solver] Kociemba unavailable, running deep IDA* (may take 10-30s)...")
    solution = solve_ida_star(cube, max_depth=14, time_limit=30.0)
    elapsed = time.time() - start

    if solution is not None:
        return {"success": True, "moves": solution,
                "move_count": len(solution),
                "algorithm": "IDA* (deep — install kociemba for faster solves)",
                "time_seconds": round(elapsed, 3)}

    result["error"] = (
        "Could not solve within time limit. "
        "Install kociemba for deep scrambles: pip install kociemba "
        "(requires C++ Build Tools on Windows)."
    )
    return result
