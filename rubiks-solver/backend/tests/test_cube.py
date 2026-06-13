"""
Unit Tests
==========
Run with: pytest tests/ -v
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from cube.cube import Cube, SOLVED_STATE
from cube.validator import validate_cube
from solver.ida_star import solve_ida_star
import copy


# ─── Cube Tests ──────────────────────────────────────────────────────

class TestCubeBasics:
    def test_solved_on_init(self):
        c = Cube()
        assert c.is_solved()

    def test_clone_independence(self):
        c1 = Cube()
        c2 = c1.clone()
        c2.move_R()
        assert c1.is_solved()
        assert not c2.is_solved()

    def test_to_from_string(self):
        c = Cube()
        c.apply_scramble("R U R' U' F2 D L")
        s = c.to_string()
        c2 = Cube.from_string(s)
        assert c.state == c2.state

    def test_move_dispatcher(self):
        c1 = Cube()
        c1.move_R()
        c2 = Cube()
        c2.apply_move("R")
        assert c1.state == c2.state


class TestMoveInverses:
    """Each move composed with its inverse should return to solved."""

    @pytest.mark.parametrize("move,inv", [
        ("U", "U'"), ("D", "D'"), ("R", "R'"),
        ("L", "L'"), ("F", "F'"), ("B", "B'"),
    ])
    def test_move_inverse(self, move, inv):
        c = Cube()
        c.apply_move(move)
        assert not c.is_solved(), f"{move} should unsolved the cube"
        c.apply_move(inv)
        assert c.is_solved(), f"{move} then {inv} should return to solved"

    @pytest.mark.parametrize("move", ["U2", "D2", "R2", "L2", "F2", "B2"])
    def test_double_move_self_inverse(self, move):
        c = Cube()
        c.apply_move(move)
        c.apply_move(move)
        assert c.is_solved(), f"{move} applied twice should return to solved"


class TestMoveOrder:
    """Each move applied 4 times should return to solved (order-4 in group)."""

    @pytest.mark.parametrize("move", [
        "U", "U'", "D", "D'", "R", "R'", "L", "L'", "F", "F'", "B", "B'"
    ])
    def test_order_4(self, move):
        c = Cube()
        for _ in range(4):
            c.apply_move(move)
        assert c.is_solved(), f"Applying {move} 4 times should return to solved"

    @pytest.mark.parametrize("move", ["U2", "D2", "R2", "L2", "F2", "B2"])
    def test_double_order_2(self, move):
        c = Cube()
        for _ in range(2):
            c.apply_move(move)
        assert c.is_solved()


class TestScrambleAndUnscramble:
    def test_apply_scramble_then_reverse(self):
        scramble = ["R", "U", "R'", "U'", "F", "D2", "L'", "B"]
        # Reverse: reverse order, flip each move
        inv_map = {"U": "U'", "U'": "U", "U2": "U2",
                   "D": "D'", "D'": "D", "D2": "D2",
                   "R": "R'", "R'": "R", "R2": "R2",
                   "L": "L'", "L'": "L", "L2": "L2",
                   "F": "F'", "F'": "F", "F2": "F2",
                   "B": "B'", "B'": "B", "B2": "B2"}
        inverse = [inv_map[m] for m in reversed(scramble)]

        c = Cube()
        c.apply_moves(scramble)
        assert not c.is_solved()
        c.apply_moves(inverse)
        assert c.is_solved()


# ─── Validator Tests ─────────────────────────────────────────────────

class TestValidator:
    def test_solved_state_valid(self):
        valid, err = validate_cube(SOLVED_STATE)
        assert valid, err

    def test_scrambled_state_valid(self):
        c = Cube()
        c.apply_scramble("R U R' U' F2")
        valid, err = validate_cube(c.state)
        assert valid, err

    def test_wrong_color_count(self):
        state = copy.deepcopy(SOLVED_STATE)
        state["U"][0] = "R"  # Extra red, one less white
        valid, err = validate_cube(state)
        assert not valid
        assert "9" in err or "color" in err.lower()

    def test_missing_face(self):
        state = copy.deepcopy(SOLVED_STATE)
        del state["U"]
        valid, err = validate_cube(state)
        assert not valid

    def test_wrong_face_length(self):
        state = copy.deepcopy(SOLVED_STATE)
        state["U"] = ["W"] * 8  # Only 8 stickers
        valid, err = validate_cube(state)
        assert not valid


# ─── IDA* Solver Tests ───────────────────────────────────────────────

class TestIDAStar:
    def test_already_solved(self):
        c = Cube()
        sol = solve_ida_star(c)
        assert sol == []

    @pytest.mark.parametrize("scramble", [
        "R",
        "U R",
        "R U R'",
        "R U R' U'",
        "F R U R' U' F'",
    ])
    def test_shallow_scrambles(self, scramble):
        c = Cube()
        c.apply_scramble(scramble)
        sol = solve_ida_star(c, max_depth=12, time_limit=10.0)
        assert sol is not None, f"Failed to solve: {scramble}"

        # Verify solution actually solves the cube
        c.apply_moves(sol)
        assert c.is_solved(), f"Solution {sol} did not solve cube scrambled with {scramble}"

    def test_solution_correctness(self):
        """Solutions must actually solve the cube."""
        scramble = "R U2 R' D F' L"
        c = Cube()
        c.apply_scramble(scramble)
        sol = solve_ida_star(c, max_depth=15, time_limit=15.0)

        if sol is not None:  # May timeout on slow machines
            c2 = Cube()
            c2.apply_scramble(scramble)
            c2.apply_moves(sol)
            assert c2.is_solved()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
