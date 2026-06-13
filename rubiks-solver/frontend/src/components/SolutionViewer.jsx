import React, { useState, useEffect, useRef } from 'react';

const MOVE_COLORS = {
  U: '#f9e24b', D: '#f9e24b',
  R: '#ef4444', L: '#f97316',
  F: '#48c774', B: '#3b82f6',
};

export default function SolutionViewer({ result, onStepApply, onJumpTo }) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [playing, setPlaying]         = useState(false);
  const [speed, setSpeed]             = useState(700); // ms per step
  const intervalRef = useRef(null);

  const moves      = result?.moves || [];
  const startState = result?.startState;
  const total      = moves.length;

  // Reset when a new solution arrives
  useEffect(() => {
    setCurrentStep(-1);
    setPlaying(false);
  }, [result]);

  // Playback loop
  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!playing) return;

    intervalRef.current = setInterval(() => {
      setCurrentStep(prev => {
        const next = prev + 1;
        if (next >= total) {
          setPlaying(false);
          return total - 1;
        }
        onStepApply(moves[next]);   // apply move to live cube display
        return next;
      });
    }, speed);

    return () => clearInterval(intervalRef.current);
  }, [playing, speed, total, moves, onStepApply]);

  const handlePlay = () => {
    if (currentStep >= total - 1) {
      // restart from beginning
      if (startState && onJumpTo) onJumpTo(-1, moves, startState); // reset to startState
      setCurrentStep(-1);
    }
    setPlaying(true);
  };

  const handlePause = () => setPlaying(false);

  const handleReset = () => {
    setPlaying(false);
    setCurrentStep(-1);
    if (startState && onJumpTo) onJumpTo(-1, moves, startState);
  };

  const handleClickStep = (i) => {
    setPlaying(false);
    setCurrentStep(i);
    if (startState && onJumpTo) onJumpTo(i, moves, startState);
  };

  const handleStepForward = () => {
    if (currentStep >= total - 1) return;
    const next = currentStep + 1;
    setCurrentStep(next);
    onStepApply(moves[next]);
  };

  const handleStepBack = () => {
    if (currentStep < 0) return;
    const prev = currentStep - 1;
    setCurrentStep(prev);
    if (startState && onJumpTo) onJumpTo(prev, moves, startState);
  };

  if (!result) return null;

  const pct = total > 0 ? ((currentStep + 1) / total) * 100 : 0;

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Badge label={`${total} moves`}      color="var(--accent)" />
        <Badge label={result.algorithm}      color="#818cf8" />
        <Badge label={`${result.time_seconds}s`} color="var(--muted)" />
      </div>

      {/* Progress bar */}
      <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 10, height: 6, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: 'linear-gradient(90deg, #6ee7b7, #34d399)',
          boxShadow: '0 0 10px rgba(110, 231, 183, 0.5)',
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <CtrlBtn onClick={handleReset}       title="Restart">⏮</CtrlBtn>
          <CtrlBtn onClick={handleStepBack}    title="Step back" disabled={currentStep < 0}>◀</CtrlBtn>
          {playing
            ? <CtrlBtn onClick={handlePause} title="Pause" active>⏸</CtrlBtn>
            : <CtrlBtn onClick={handlePlay}  title="Play"  active={currentStep < total - 1}>▶</CtrlBtn>
          }
          <CtrlBtn onClick={handleStepForward} title="Step forward" disabled={currentStep >= total - 1}>▶|</CtrlBtn>
        </div>

        {/* Speed */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="label-mono" style={{ marginBottom: 0 }}>SPEED</span>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', padding: 3, borderRadius: 8, border: '1px solid var(--border)' }}>
            {[['S', 1200], ['M', 700], ['F', 350], ['T', 120]].map(([label, ms]) => (
              <button key={ms} onClick={() => setSpeed(ms)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11,
                fontFamily: 'var(--font-mono)',
                background: speed === ms ? 'rgba(110, 231, 183, 0.2)' : 'transparent',
                color: speed === ms ? 'var(--accent)' : 'var(--muted)',
                fontWeight: speed === ms ? 700 : 400,
              }}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Step counter */}
      <div style={{
        padding: '12px 16px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid var(--border)',
        fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--muted)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>
          {currentStep === -1
            ? 'Press ▶ to animate'
            : currentStep >= total - 1
            ? '✓ Cube solved!'
            : `Step ${currentStep + 1} / ${total} → ${moves[currentStep]}`}
        </span>
        {currentStep >= 0 && (
          <span style={{ color: 'var(--accent)', opacity: 0.8, fontWeight: 600 }}>
            {total - currentStep - 1} left
          </span>
        )}
      </div>

      {/* Move chips */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8,
        maxHeight: 250, overflowY: 'auto', padding: '4px',
      }}>
        {moves.map((move, i) => (
          <MoveChip
            key={i}
            move={move}
            index={i}
            isCurrent={i === currentStep}
            isDone={i < currentStep}
            onClick={() => handleClickStep(i)}
          />
        ))}
      </div>
    </div>
  );
}

function MoveChip({ move, index, isCurrent, isDone, onClick }) {
  const face = move[0];
  const color = MOVE_COLORS[face] || '#6b7280';
  return (
    <button onClick={onClick} style={{
      position: 'relative',
      padding: '6px 14px',
      borderRadius: 10,
      background: isCurrent ? color : isDone ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
      color: isCurrent ? '#030407' : isDone ? 'rgba(255,255,255,0.2)' : 'var(--text)',
      fontSize: 14, fontFamily: 'var(--font-mono)',
      fontWeight: isCurrent ? 700 : 500,
      border: isCurrent ? `2px solid rgba(255,255,255,0.5)` : '1px solid var(--border)',
      transform: isCurrent ? 'scale(1.1) translateY(-2px)' : 'scale(1)',
      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: isCurrent ? `0 8px 16px ${color}44` : 'none',
    }}>
      {move}
      <span style={{
        position: 'absolute', top: -6, right: -4,
        fontSize: 9, color: isCurrent ? '#030407' : 'var(--muted)',
        fontFamily: 'var(--font-mono)', opacity: 0.7
      }}>{index + 1}</span>
    </button>
  );
}

function Badge({ label, color }) {
  return (
    <span style={{
      padding: '4px 12px', borderRadius: 8,
      background: color + '11', color,
      fontSize: 11, fontFamily: 'var(--font-mono)',
      fontWeight: 700,
      border: `1px solid ${color}33`,
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}>
      {label}
    </span>
  );
}

function CtrlBtn({ onClick, children, title, active, disabled }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      width: 42, height: 42, borderRadius: 12,
      background: active ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
      color: active ? '#030407' : disabled ? 'rgba(255,255,255,0.1)' : 'var(--text)',
      fontSize: 16, border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: active ? '0 4px 12px var(--accent-glow)' : 'none'
    }}>
      {children}
    </button>
  );
}
