import React, { useState } from 'react';
import { SOLVED_STATE, COLOR_HEX, FACES, cloneState } from '../utils/cube';

export default function ManualInput({ onStateChange }) {
  const [state, setState] = useState(cloneState(SOLVED_STATE));
  const [selectedColor, setSelectedColor] = useState('R');

  const handleClick = (face, idx) => {
    if (idx === 4) return; // Don't change center
    const next = cloneState(state);
    next[face][idx] = selectedColor;
    setState(next);
    onStateChange(next);
  };

  return (
    <div>
      {/* Color palette */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>SELECT COLOR TO PAINT</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {Object.entries(COLOR_HEX).map(([c, hex]) => (
            <button
              key={c}
              onClick={() => setSelectedColor(c)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: hex,
                border: selectedColor === c ? '3px solid white' : '2px solid transparent',
                transform: selectedColor === c ? 'scale(1.15)' : 'none',
                boxShadow: selectedColor === c ? `0 0 0 2px ${hex}66` : 'none',
              }}
              title={c}
            />
          ))}
        </div>
      </div>

      {/* Mini cube net */}
      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
        CLICK STICKERS TO PAINT · CENTER STICKERS ARE FIXED
      </div>

      <div style={{
        display: 'grid',
        gridTemplateRows: 'auto auto auto',
        gridTemplateColumns: 'repeat(4, auto)',
        gap: 6,
      }}>
        <div style={{ gridRow: 1, gridColumn: 2 }}>
          <MiniGrid face="U" state={state} onCell={handleClick} selectedColor={selectedColor} />
        </div>
        {[['L', 1], ['F', 2], ['R', 3], ['B', 4]].map(([face, col]) => (
          <div key={face} style={{ gridRow: 2, gridColumn: col }}>
            <MiniGrid face={face} state={state} onCell={handleClick} selectedColor={selectedColor} />
          </div>
        ))}
        <div style={{ gridRow: 3, gridColumn: 2 }}>
          <MiniGrid face="D" state={state} onCell={handleClick} selectedColor={selectedColor} />
        </div>
      </div>
    </div>
  );
}

function MiniGrid({ face, state, onCell, selectedColor }) {
  return (
    <div>
      <div style={{ textAlign: 'center', fontSize: 10, color: '#6b7280', marginBottom: 3, fontFamily: 'monospace' }}>
        {face}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 28px)',
        gap: 2,
        background: '#1a1d25',
        padding: 3,
        borderRadius: 5,
        border: '1px solid #252830',
      }}>
        {state[face].map((color, i) => (
          <div
            key={i}
            onClick={() => onCell(face, i)}
            style={{
              width: 28,
              height: 28,
              background: COLOR_HEX[color],
              borderRadius: 3,
              cursor: i === 4 ? 'default' : 'crosshair',
              border: i === 4 ? '2px solid rgba(255,255,255,0.3)' : '1px solid rgba(0,0,0,0.2)',
              transition: 'filter 0.1s',
            }}
            onMouseEnter={e => { if (i !== 4) e.target.style.filter = 'brightness(1.3)'; }}
            onMouseLeave={e => { e.target.style.filter = ''; }}
          />
        ))}
      </div>
    </div>
  );
}
