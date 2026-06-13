import React from 'react';
import { COLOR_HEX, FACE_LABEL } from '../utils/cube';

const COLORS = ['W', 'Y', 'G', 'B', 'R', 'O'];

export default function CubeFace({ face, stickers, editable, onEdit, size = 90 }) {
  const cellSize = size / 3;

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="label-mono" style={{ marginBottom: 6, fontSize: 10 }}>
        {face}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(3, ${cellSize}px)`,
        gridTemplateRows: `repeat(3, ${cellSize}px)`,
        gap: 3,
        background: 'rgba(255, 255, 255, 0.05)',
        padding: 4,
        borderRadius: 10,
        border: '1px solid var(--border)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      }}>
        {stickers.map((color, i) => (
          <Cell
            key={i}
            color={color}
            isCenter={i === 4}
            editable={editable}
            size={cellSize - 3}
            onCycle={editable ? () => onEdit(face, i, cycleColor(color)) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function Cell({ color, isCenter, editable, size, onCycle }) {
  return (
    <div
      onClick={onCycle}
      title={editable && !isCenter ? 'Click to change color' : undefined}
      style={{
        width: size,
        height: size,
        background: COLOR_HEX[color] || '#333',
        borderRadius: size > 20 ? 6 : 3,
        border: isCenter ? '2.5px solid rgba(255,255,255,0.4)' : '1px solid rgba(0,0,0,0.15)',
        cursor: editable && !isCenter ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        boxShadow: `
          inset 0 2px 4px rgba(255,255,255,0.2), 
          inset 0 -2px 4px rgba(0,0,0,0.2),
          0 2px 4px rgba(0,0,0,0.1)
        `,
        position: 'relative',
        overflow: 'hidden'
      }}
      onMouseEnter={e => { 
        if (editable && !isCenter) {
          e.currentTarget.style.filter = 'brightness(1.15) saturate(1.1)';
          e.currentTarget.style.transform = 'scale(1.05)';
          e.currentTarget.style.zIndex = '10';
        }
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.filter = ''; 
        e.currentTarget.style.transform = '';
        e.currentTarget.style.zIndex = '';
      }}
    >
      {/* Shine effect */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        background: 'linear-gradient(45deg, transparent, rgba(255,255,255,0.1), transparent)',
        transform: 'rotate(45deg)',
        pointerEvents: 'none'
      }} />
    </div>
  );
}

function cycleColor(current) {
  const idx = COLORS.indexOf(current);
  return COLORS[(idx + 1) % COLORS.length];
}
