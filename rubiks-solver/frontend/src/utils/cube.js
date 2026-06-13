export const FACES = ['U', 'D', 'L', 'R', 'F', 'B'];

export const COLOR_HEX = {
  W: '#f5f5f0',
  Y: '#f9e24b',
  G: '#48c774',
  B: '#3b82f6',
  R: '#ef4444',
  O: '#f97316',
};

export const COLOR_NAME = {
  W: 'White',
  Y: 'Yellow',
  G: 'Green',
  B: 'Blue',
  R: 'Red',
  O: 'Orange',
};

export const FACE_LABEL = {
  U: 'Up (Top)',
  D: 'Down (Bottom)',
  L: 'Left',
  R: 'Right',
  F: 'Front',
  B: 'Back',
};

export const SOLVED_STATE = {
  U: Array(9).fill('W'),
  D: Array(9).fill('Y'),
  L: Array(9).fill('O'),
  R: Array(9).fill('R'),
  F: Array(9).fill('G'),
  B: Array(9).fill('B'),
};

export const cloneState = (state) =>
  Object.fromEntries(Object.entries(state).map(([k, v]) => [k, [...v]]));

export const isSolved = (state) =>
  FACES.every((f) => state[f].every((c) => c === state[f][4]));
