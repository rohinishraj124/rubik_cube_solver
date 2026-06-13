from collections import Counter
from typing import Dict, List, Tuple

COLORS = ["W", "Y", "G", "B", "R", "O"]
FACES  = ["U", "D", "L", "R", "F", "B"]

CORNERS = [
    [("U", 8), ("F", 2), ("R", 0)],
    [("U", 6), ("L", 2), ("F", 0)],
    [("U", 2), ("R", 2), ("B", 0)],
    [("U", 0), ("B", 2), ("L", 0)],
    [("D", 2), ("R", 6), ("F", 8)],
    [("D", 0), ("F", 6), ("L", 8)],
    [("D", 8), ("B", 6), ("R", 8)],
    [("D", 6), ("L", 6), ("B", 8)],
]

EDGES = [
    [("U", 7), ("F", 1)],
    [("U", 5), ("R", 1)],
    [("U", 1), ("B", 1)],
    [("U", 3), ("L", 1)],
    [("F", 5), ("R", 3)],
    [("F", 3), ("L", 5)],
    [("B", 5), ("L", 3)],
    [("B", 3), ("R", 5)],
    [("D", 1), ("F", 7)],
    [("D", 5), ("R", 7)],
    [("D", 7), ("B", 7)],
    [("D", 3), ("L", 7)],
]


def validate_cube(state: Dict[str, List[str]]) -> Tuple[bool, str]:
    # ── Check 1: All faces present with correct sticker count ────────
    for face in FACES:
        if face not in state:
            return False, f"Missing face: {face}"
        if len(state[face]) != 9:
            return False, f"Face {face} has {len(state[face])} stickers, expected 9"

    # ── Check 2: Color counts — exactly 9 of each ────────────────────
    all_stickers = []
    for face in FACES:
        all_stickers.extend(state[face])

    unknown = set(all_stickers) - set(COLORS)
    if unknown:
        return False, f"Unknown color(s): {unknown}"

    counts = Counter(all_stickers)
    for color in COLORS:
        if counts[color] != 9:
            return False, f"Color {color} appears {counts[color]} times, expected 9"

    # ── Check 3: Center stickers are all different ───────────────────
    centers = {face: state[face][4] for face in FACES}
    if len(set(centers.values())) != 6:
        return False, "Center stickers are not all unique — each face center must be a different color"

    return True, ""
