import React from 'react';
import CubeFace from './CubeFace';

/**
 * Renders the cube as an unfolded net:
 *
 *       [U]
 *  [L] [F] [R] [B]
 *       [D]
 */
export default function CubeNet({ state, editable = false, onEdit, faceSize = 100 }) {
  const gap = 6;

  const faceAt = (face, row, col) => (
    <div style={{ gridRow: row, gridColumn: col }}>
      <CubeFace
        face={face}
        stickers={state[face]}
        editable={editable}
        onEdit={onEdit}
        size={faceSize}
      />
    </div>
  );

  return (
    <div style={{
      display: 'grid',
      gridTemplateRows: `repeat(3, auto)`,
      gridTemplateColumns: `repeat(4, auto)`,
      gap,
      justifyContent: 'center',
      alignItems: 'center',
    }}>
      {/* Row 1: U centered in col 2 */}
      <div style={{ gridRow: 1, gridColumn: 2 }}>
        <CubeFace face="U" stickers={state.U} editable={editable} onEdit={onEdit} size={faceSize} />
      </div>

      {/* Row 2: L F R B */}
      {[['L', 1], ['F', 2], ['R', 3], ['B', 4]].map(([face, col]) => (
        <div key={face} style={{ gridRow: 2, gridColumn: col }}>
          <CubeFace face={face} stickers={state[face]} editable={editable} onEdit={onEdit} size={faceSize} />
        </div>
      ))}

      {/* Row 3: D centered in col 2 */}
      <div style={{ gridRow: 3, gridColumn: 2 }}>
        <CubeFace face="D" stickers={state.D} editable={editable} onEdit={onEdit} size={faceSize} />
      </div>
    </div>
  );
}
