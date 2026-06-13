"""
IDA* Solver (from scratch)
===========================
IDA* = Iterative Deepening A* search.

Key ideas:
  - Like DFS but with a cost threshold that increases each iteration
  - Threshold starts at h(start) and grows to the next minimum f-value seen
  - Admissible heuristic: never overestimates true distance to goal
  - Our heuristic: count of misplaced corner + edge stickers (Manhattan-style)

Complexity:
  - Time: O(b^d) in worst case (b=branching factor≈15, d=solution depth)
  - Space: O(d) — only stores current path (unlike BFS which stores all nodes)
  - With good pruning tables, IDA* is used in production solvers

Pruning:
  - Don't apply the same face twice in a row  (R then R = R2, not 2 separate moves)
  - Don't apply opposite faces back-to-back in a bad order (R then L is ok, L then R redundant)
"""

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
    """
    Lower-bound estimate of moves needed to solve.
    Uses 'number of stickers not on their home face' divided by 8
    (each move affects at most 8 stickers on adjacent faces).

    This is admissible (never overestimates) and consistent.
    """
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
    """
    Recursive IDA* search.
    Returns (new_threshold_or_FOUND, solution_path).
    """
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
    """
    Solve the cube using IDA*.

    Args:
        cube: The scrambled cube
        max_depth: Maximum search depth (IDA* stops if no solution found within this)
        time_limit: Time limit in seconds

    Returns:
        List of moves (solution) or None if not found
    """
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
