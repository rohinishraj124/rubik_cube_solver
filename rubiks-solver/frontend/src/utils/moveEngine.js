/**
 * Local JavaScript Cube Move Engine
 * ===================================
 * Mirrors backend cube.py exactly so animation never needs an API call.
 * Each move updates the cube state instantly — zero latency during playback.
 */

import { cloneState } from './cube';

// ── Helpers ────────────────────────────────────────────────────────────

function rotateFaceCW(state, face) {
  const f = state[face];
  state[face] = [
    f[6], f[3], f[0],
    f[7], f[4], f[1],
    f[8], f[5], f[2],
  ];
}

function rotateFaceCCW(state, face) {
  const f = state[face];
  state[face] = [
    f[2], f[5], f[8],
    f[1], f[4], f[7],
    f[0], f[3], f[6],
  ];
}

/**
 * Cycle: state[cells[last]] → state[cells[0]], each cell gets value of previous.
 * Equivalent to: cells[0]←cells[last], cells[1]←cells[0], cells[2]←cells[1], cells[3]←cells[2]
 */
function cycle(state, cells) {
  const [lastFace, lastIdx] = cells[cells.length - 1];
  const tmp = state[lastFace][lastIdx];
  for (let i = cells.length - 1; i > 0; i--) {
    const [f, idx] = cells[i];
    const [pf, pidx] = cells[i - 1];
    state[f][idx] = state[pf][pidx];
  }
  state[cells[0][0]][cells[0][1]] = tmp;
}

// ── Move implementations ───────────────────────────────────────────────

const moves = {
  U(s) {
    rotateFaceCW(s, 'U');
    for (let i = 0; i < 3; i++) cycle(s, [['F',i],['L',i],['B',i],['R',i]]);
  },
  "U'"(s) {
    rotateFaceCCW(s, 'U');
    for (let i = 0; i < 3; i++) cycle(s, [['F',i],['R',i],['B',i],['L',i]]);
  },
  U2(s) { moves.U(s); moves.U(s); },

  D(s) {
    rotateFaceCW(s, 'D');
    for (let i = 0; i < 3; i++) cycle(s, [['F',6+i],['R',6+i],['B',6+i],['L',6+i]]);
  },
  "D'"(s) {
    rotateFaceCCW(s, 'D');
    for (let i = 0; i < 3; i++) cycle(s, [['F',6+i],['L',6+i],['B',6+i],['R',6+i]]);
  },
  D2(s) { moves.D(s); moves.D(s); },

  R(s) {
    rotateFaceCW(s, 'R');
    for (let i = 0; i < 3; i++) {
      cycle(s, [['F', 2 + i * 3], ['U', 2 + i * 3], ['B', 6 - i * 3], ['D', 2 + i * 3]]);
    }
  },
  "R'"(s) {
    rotateFaceCCW(s, 'R');
    for (let i = 0; i < 3; i++) {
      cycle(s, [['F', 2 + i * 3], ['D', 2 + i * 3], ['B', 6 - i * 3], ['U', 2 + i * 3]]);
    }
  },
  R2(s) { moves.R(s); moves.R(s); },

  L(s) {
    rotateFaceCW(s, 'L');
    for (let i = 0; i < 3; i++) {
      cycle(s, [['F', i * 3], ['D', i * 3], ['B', 8 - i * 3], ['U', i * 3]]);
    }
  },
  "L'"(s) {
    rotateFaceCCW(s, 'L');
    for (let i = 0; i < 3; i++) {
      cycle(s, [['F', i * 3], ['U', i * 3], ['B', 8 - i * 3], ['D', i * 3]]);
    }
  },
  L2(s) { moves.L(s); moves.L(s); },

  F(s) {
    rotateFaceCW(s, 'F');
    const tmp = [s.U[6], s.U[7], s.U[8]];
    s.U[6] = s.L[8]; s.U[7] = s.L[5]; s.U[8] = s.L[2];
    s.L[2] = s.D[0]; s.L[5] = s.D[1]; s.L[8] = s.D[2];
    s.D[0] = s.R[6]; s.D[1] = s.R[3]; s.D[2] = s.R[0];
    s.R[0] = tmp[0]; s.R[3] = tmp[1]; s.R[6] = tmp[2];
  },
  "F'"(s) { moves.F(s); moves.F(s); moves.F(s); },
  F2(s) { moves.F(s); moves.F(s); },

  B(s) {
    rotateFaceCW(s, 'B');
    const tmp = [s.U[0], s.U[1], s.U[2]];
    s.U[0] = s.R[2]; s.U[1] = s.R[5]; s.U[2] = s.R[8];
    s.R[2] = s.D[8]; s.R[5] = s.D[7]; s.R[8] = s.D[6];
    s.D[6] = s.L[0]; s.D[7] = s.L[3]; s.D[8] = s.L[6];
    s.L[0] = tmp[2]; s.L[3] = tmp[1]; s.L[6] = tmp[0];
  },
  "B'"(s) { moves.B(s); moves.B(s); moves.B(s); },
  B2(s) { moves.B(s); moves.B(s); },
};

/**
 * Apply a single move to a cube state, returning a NEW state object.
 * The original state is never mutated.
 */
export function applyMoveLocal(state, move) {
  const fn = moves[move];
  if (!fn) {
    console.warn('Unknown move:', move);
    return state;
  }
  // Deep clone each face array before mutating
  const next = {
    U: [...state.U], D: [...state.D],
    L: [...state.L], R: [...state.R],
    F: [...state.F], B: [...state.B],
  };
  fn(next);
  return next;
}

/**
 * Apply a sequence of moves to a state, returning the final state.
 */
export function applyMovesLocal(state, moveList) {
  return moveList.reduce((s, m) => applyMoveLocal(s, m), state);
}
