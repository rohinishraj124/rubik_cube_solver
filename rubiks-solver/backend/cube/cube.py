import copy
from typing import List, Dict

FACES = ["U", "D", "L", "R", "F", "B"]
COLORS = ["W", "Y", "G", "B", "R", "O"]

# Solved state: each face is filled with its center color
SOLVED_STATE = {
    "U": ["W"] * 9,
    "D": ["Y"] * 9,
    "L": ["O"] * 9,
    "R": ["R"] * 9,
    "F": ["G"] * 9,
    "B": ["B"] * 9,
}

COLOR_MAP = {
    "W": "white",
    "Y": "yellow",
    "G": "green",
    "B": "blue",
    "R": "red",
    "O": "orange",
}


class Cube:
    def __init__(self, state: Dict[str, List[str]] = None):
        if state is None:
            self.state = copy.deepcopy(SOLVED_STATE)
        else:
            self.state = copy.deepcopy(state)

    def clone(self) -> "Cube":
        return Cube(self.state)

    def is_solved(self) -> bool:
        for face in FACES:
            center = self.state[face][4]
            if not all(c == center for c in self.state[face]):
                return False
        return True

    def to_string(self) -> str:
        """Encode cube state as a 54-char string (UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB)"""
        order = ["U", "R", "F", "D", "L", "B"]
        return "".join("".join(self.state[f]) for f in order)

    @classmethod
    def from_string(cls, s: str) -> "Cube":
        order = ["U", "R", "F", "D", "L", "B"]
        state = {}
        for i, face in enumerate(order):
            state[face] = list(s[i * 9:(i + 1) * 9])
        return cls(state)

    def __eq__(self, other):
        return self.state == other.state

    def __hash__(self):
        return hash(self.to_string())

    def __repr__(self):
        lines = []
        # Top face
        for r in range(3):
            lines.append("      " + " ".join(self.state["U"][r * 3:(r + 1) * 3]))
        lines.append("")
        # Middle row: L F R B
        for r in range(3):
            row = []
            for face in ["L", "F", "R", "B"]:
                row.extend(self.state[face][r * 3:(r + 1) * 3])
                row.append(" ")
            lines.append(" ".join(row))
        lines.append("")
        # Bottom face
        for r in range(3):
            lines.append("      " + " ".join(self.state["D"][r * 3:(r + 1) * 3]))
        return "\n".join(lines)

    # ─── Move helpers ───────────────────────────────────────────────

    def _rotate_face_cw(self, face: str):
        """Rotate a face 90° clockwise."""
        f = self.state[face]
        self.state[face] = [
            f[6], f[3], f[0],
            f[7], f[4], f[1],
            f[8], f[5], f[2],
        ]

    def _rotate_face_ccw(self, face: str):
        """Rotate a face 90° counter-clockwise."""
        f = self.state[face]
        self.state[face] = [
            f[2], f[5], f[8],
            f[1], f[4], f[7],
            f[0], f[3], f[6],
        ]

    def _rotate_face_180(self, face: str):
        self._rotate_face_cw(face)
        self._rotate_face_cw(face)

    def _cycle(self, cells: List[tuple], reverse: bool = False):
        """
        Cycle sticker values through a list of (face, index) tuples.
        cells = [(face1, idx1), (face2, idx2), (face3, idx3), (face4, idx4)]
        """
        if reverse:
            cells = cells[::-1]
        tmp = self.state[cells[-1][0]][cells[-1][1]]
        for i in range(len(cells) - 1, 0, -1):
            self.state[cells[i][0]][cells[i][1]] = self.state[cells[i - 1][0]][cells[i - 1][1]]
        self.state[cells[0][0]][cells[0][1]] = tmp

    # ─── The 18 Standard Moves ──────────────────────────────────────

    def move_U(self):
        self._rotate_face_cw("U")
        # Cycle: F top row → L top → B top → R top
        for i in range(3):
            self._cycle([("F", i), ("L", i), ("B", i), ("R", i)])

    def move_U_prime(self):
        self._rotate_face_ccw("U")
        for i in range(3):
            self._cycle([("F", i), ("R", i), ("B", i), ("L", i)])

    def move_U2(self):
        self.move_U(); self.move_U()

    def move_D(self):
        self._rotate_face_cw("D")
        for i in range(3):
            self._cycle([("F", 6 + i), ("R", 6 + i), ("B", 6 + i), ("L", 6 + i)])

    def move_D_prime(self):
        self._rotate_face_ccw("D")
        for i in range(3):
            self._cycle([("F", 6 + i), ("L", 6 + i), ("B", 6 + i), ("R", 6 + i)])


    def move_D2(self):
        self.move_D(); self.move_D()

    def move_R(self):
        self._rotate_face_cw("R")
        # Cycle: F right col -> U right col -> B left col (reversed) -> D right col
        # Standard Boy's Color Scheme adjacency:
        # F[2,5,8] -> U[2,5,8] -> B[6,3,0] -> D[2,5,8]
        for i in range(3):
            self._cycle([
                ("F", 2 + i * 3),
                ("U", 2 + i * 3),
                ("B", 6 - i * 3),
                ("D", 2 + i * 3),
            ])

    def move_R_prime(self):
        self._rotate_face_ccw("R")
        for i in range(3):
            self._cycle([
                ("F", 2 + i * 3),
                ("D", 2 + i * 3),
                ("B", 6 - i * 3),
                ("U", 2 + i * 3),
            ])

    def move_R2(self):
        self.move_R(); self.move_R()

    def move_L(self):
        self._rotate_face_cw("L")
        # Cycle: F left col -> D left col -> B right col (reversed) -> U left col
        for i in range(3):
            self._cycle([
                ("F", i * 3),
                ("D", i * 3),
                ("B", 8 - i * 3),
                ("U", i * 3),
            ])

    def move_L_prime(self):
        self._rotate_face_ccw("L")
        for i in range(3):
            self._cycle([
                ("F", i * 3),
                ("U", i * 3),
                ("B", 8 - i * 3),
                ("D", i * 3),
            ])

    def move_L2(self):
        self.move_L(); self.move_L()

    def move_F(self):
        self._rotate_face_cw("F")
        # U bottom -> R left col -> D top (reversed) -> L right col (reversed)
        tmp = [self.state["U"][6], self.state["U"][7], self.state["U"][8]]
        self.state["U"][6] = self.state["L"][8]
        self.state["U"][7] = self.state["L"][5]
        self.state["U"][8] = self.state["L"][2]
        self.state["L"][2] = self.state["D"][0]
        self.state["L"][5] = self.state["D"][1]
        self.state["L"][8] = self.state["D"][2]
        self.state["D"][0] = self.state["R"][6]
        self.state["D"][1] = self.state["R"][3]
        self.state["D"][2] = self.state["R"][0]
        self.state["R"][0] = tmp[0]
        self.state["R"][3] = tmp[1]
        self.state["R"][6] = tmp[2]

    def move_F_prime(self):
        self.move_F(); self.move_F(); self.move_F()

    def move_F2(self):
        self.move_F(); self.move_F()

    def move_B(self):
        self._rotate_face_cw("B")
        tmp = [self.state["U"][0], self.state["U"][1], self.state["U"][2]]
        self.state["U"][0] = self.state["R"][2]
        self.state["U"][1] = self.state["R"][5]
        self.state["U"][2] = self.state["R"][8]
        self.state["R"][2] = self.state["D"][8]
        self.state["R"][5] = self.state["D"][7]
        self.state["R"][8] = self.state["D"][6]
        self.state["D"][6] = self.state["L"][0]
        self.state["D"][7] = self.state["L"][3]
        self.state["D"][8] = self.state["L"][6]
        self.state["L"][0] = tmp[2]
        self.state["L"][3] = tmp[1]
        self.state["L"][6] = tmp[0]

    def move_B_prime(self):
        self.move_B(); self.move_B(); self.move_B()

    def move_B2(self):
        self.move_B(); self.move_B()

    # ─── Move dispatcher ────────────────────────────────────────────

    MOVE_MAP = {
        "U": "move_U", "U'": "move_U_prime", "U2": "move_U2",
        "D": "move_D", "D'": "move_D_prime", "D2": "move_D2",
        "R": "move_R", "R'": "move_R_prime", "R2": "move_R2",
        "L": "move_L", "L'": "move_L_prime", "L2": "move_L2",
        "F": "move_F", "F'": "move_F_prime", "F2": "move_F2",
        "B": "move_B", "B'": "move_B_prime", "B2": "move_B2",
    }

    def apply_move(self, move: str):
        method = self.MOVE_MAP.get(move)
        if method is None:
            raise ValueError(f"Unknown move: {move}")
        getattr(self, method)()

    def apply_moves(self, moves: List[str]):
        for m in moves:
            self.apply_move(m)

    def apply_scramble(self, scramble: str):
        self.apply_moves(scramble.strip().split())
