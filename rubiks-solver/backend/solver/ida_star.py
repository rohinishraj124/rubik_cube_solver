import time
from typing import List, Optional, Tuple
from cube.cube import Cube

ALL_MOVES = [
    "U", "U'", "U2",
    "D", "D'", "D2",
    "R", "R'", "R2",
    "L", "L'", "L2",
    "F", "F'", "F2",
    "B", "B'", "B2",
]

# Map move → face letter for pruning
MOVE_FACE = {m: m[0] for m in ALL_MOVES}

# Opposite face pairs (applying both back-to-back can be pruned in certain orders)
OPPOSITE_FACES = {"U": "D", "D": "U", "R": "L", "L": "R", "F": "B", "B": "F"}

INF = float("inf")


def heuristic(cube: Cube) -> int:
    if cube.is_solved():
        return 0

    face_colors = {face: cube.state[face][4] for face in ["U", "D", "L", "R", "F", "B"]}
    misplaced = 0
    for face, stickers in cube.state.items():
        home_color = face_colors[face]
        for s in stickers:
            if s != home_color:
                misplaced += 1

    # Each move fixes at most 8 stickers → divide and ceil
    return max(1, misplaced // 8)


def _search(cube: Cube, path: List[str], g: int, threshold: int,
            last_face: Optional[str], second_last_face: Optional[str]) -> Tuple[int, List[str]]:
    h = heuristic(cube)
    f = g + h

    if f > threshold:
        return f, []

    if cube.is_solved():
        return -1, path[:]  # -1 signals "found"

    minimum = INF

    for move in ALL_MOVES:
        face = MOVE_FACE[move]

        # Pruning 1: Don't repeat same face
        if face == last_face:
            continue

        # Pruning 2: Skip redundant opposite face sequences
        if (last_face is not None and
                face == OPPOSITE_FACES.get(last_face) and
                face == second_last_face):
            continue

        # Apply move
        new_cube = cube.clone()
        new_cube.apply_move(move)
        path.append(move)

        result, sol = _search(new_cube, path, g + 1, threshold, face, last_face)

        if result == -1:
            return -1, sol

        if result < minimum:
            minimum = result

        path.pop()

    return minimum, []


def solve_ida_star(cube: Cube, max_depth: int = 20, time_limit: float = 30.0) -> Optional[List[str]]:
    if cube.is_solved():
        return []

    start_time = time.time()
    threshold = heuristic(cube)

    while threshold <= max_depth:
        if time.time() - start_time > time_limit:
            return None  # Timeout

        result, solution = _search(cube, [], 0, threshold, None, None)

        if result == -1:
            return solution

        if result == INF:
            return None  # No solution exists at any depth

        threshold = result  # Jump to next minimum f-value

    return None
