const BASE = 'http://localhost:8000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'API Error');
  return data;
}

export const api = {
  scramble: (numMoves = 20) =>
    request('/scramble', {
      method: 'POST',
      body: JSON.stringify({ num_moves: numMoves }),
    }),

  solve: (state, algorithm = 'auto') =>
    request('/solve', {
      method: 'POST',
      body: JSON.stringify({ state, algorithm }),
    }),

  validate: (state) =>
    request('/validate', {
      method: 'POST',
      body: JSON.stringify({ state }),
    }),

  applyMoves: (state, moves) =>
    request('/apply-moves', {
      method: 'POST',
      body: JSON.stringify({ state, moves }),
    }),

  solvedState: () => request('/solved-state'),

  setScannedState: (state) =>
    request('/set-scanned-state', {
      method: 'POST',
      body: JSON.stringify({ state, algorithm: 'auto' }),
    }),
};

export const pollScannedState = (sinceVersion) =>
  request(`/poll-scanned-state?since=${sinceVersion}`);
