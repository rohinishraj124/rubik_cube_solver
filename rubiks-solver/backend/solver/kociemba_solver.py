
import sys
import os
from typing import Optional, List
from cube.cube import Cube

# Make pykociemba importable regardless of working directory
_SOLVER_DIR = os.path.dirname(os.path.abspath(__file__))
if _SOLVER_DIR not in sys.path:
    sys.path.insert(0, _SOLVER_DIR)


def cube_to_kociemba_string(cube: Cube) -> str:
 
    color_to_face = {}
    for face in ["U", "R", "F", "D", "L", "B"]:
        center_color = cube.state[face][4]
        color_to_face[center_color] = face

    order = ["U", "R", "F", "D", "L", "B"]
    result = ""
    for face in order:
        for color in cube.state[face]:
            result += color_to_face.get(color, "U")
    return result


def solve_kociemba(cube: Cube) -> Optional[List[str]]:
   
    if cube.is_solved():
        return []

    try:
        from pykociemba.search import Search
    except ImportError:
        return None  # pykociemba folder missing — fallback to IDA*

    try:
        cube_string = cube_to_kociemba_string(cube)
        searcher = Search()
        # args: cube_string, max_length, timeout_seconds, use_cache
        solution_str = searcher.solution(cube_string, 24, 5, 0).strip()

        if not solution_str or solution_str.startswith("Error"):
            return None

        moves = solution_str.split()
        # Normalize: pykociemba uses "3" suffix for counter-clockwise, we use "'"
        normalized = []
        for m in moves:
            if m.endswith("3"):
                normalized.append(m[0] + "'")
            else:
                normalized.append(m)
        return normalized

    except Exception as e:
        return None


def is_kociemba_available() -> bool:
    try:
        from pykociemba.search import Search
        return True
    except ImportError:
        return False
