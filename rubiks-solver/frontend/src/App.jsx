import React, { useState, useRef, useCallback, useEffect } from 'react';
import CubeNet from './components/CubeNet';
import SolutionViewer from './components/SolutionViewer';
import WebcamScanner from './components/WebcamScanner';
import { SOLVED_STATE, cloneState, isSolved } from './utils/cube';
import { api, pollScannedState } from './utils/api';
import { applyMoveLocal } from './utils/moveEngine';

const TABS = ['Scramble', 'Scan + Edit', 'Solution'];

export default function App() {
  const [cubeState, setCubeState] = useState(cloneState(SOLVED_STATE));
  // cubeStateRef keeps a live reference so animation always reads the latest state
  const cubeStateRef = useRef(cloneState(SOLVED_STATE));
  const [activeTab, setActiveTab] = useState('Scramble');
  const [solution, setSolution] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [algorithm, setAlgorithm] = useState('auto');
  const [scrambleMoves, setScrambleMoves] = useState([]);
  const [numMoves, setNumMoves] = useState(8);
  const [status, setStatus] = useState('idle');
  const pollVersionRef = useRef(0);

  // Poll for state pushed by Python OpenCV scanner
  useEffect(() => {
    let timer;
    const poll = async () => {
      try {
        const res = await pollScannedState(pollVersionRef.current);
        if (res.has_update && res.state) {
          pollVersionRef.current = res.version;
          updateCubeState(res.state);
          setSolution(null);
          setStatus('scrambled');
          setActiveTab('Scramble');
        }
      } catch (_) {}
      timer = setTimeout(poll, 1500);
    };
    poll();
    return () => clearTimeout(timer);
  }, []);

  // Keep ref in sync whenever state changes
  const updateCubeState = (newState) => {
    cubeStateRef.current = newState;
    setCubeState(newState);
  };

  const clearError = () => setError('');

  // ── Scramble ───────────────────────────────────────────────────────
  const handleScramble = async () => {
    setLoading(true);
    clearError();
    setSolution(null);
    try {
      const res = await api.scramble(numMoves);
      updateCubeState(res.state);
      setScrambleMoves(res.scramble_moves);
      setStatus('scrambled');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  // ── Reset ──────────────────────────────────────────────────────────
  const handleReset = () => {
    updateCubeState(cloneState(SOLVED_STATE));
    setSolution(null);
    setScrambleMoves([]);
    setStatus('idle');
    clearError();
  };

  // ── Solve ──────────────────────────────────────────────────────────
  const handleSolve = async () => {
    setLoading(true);
    clearError();
    try {
      const res = await api.solve(cubeState, algorithm);
      setSolution({ ...res, startState: cloneState(cubeState) });
      setActiveTab('Solution');
      setStatus('solved');
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  // ── Apply one step (animation) ─────────────────────────────────────
  // Uses local move engine — instant, no API call, no stale closure bug
  const handleStepApply = useCallback((move) => {
    const next = applyMoveLocal(cubeStateRef.current, move);
    updateCubeState(next);
  }, []); // no deps needed — always reads from ref

  // ── Jump to step N (click a move chip) ────────────────────────────
  const handleJumpTo = useCallback((stepIndex, moves, startState) => {
    let state = cloneState(startState);
    for (let i = 0; i <= stepIndex; i++) {
      state = applyMoveLocal(state, moves[i]);
    }
    updateCubeState(state);
  }, []);

  // ── Camera scan result ─────────────────────────────────────────────
  const handleScanComplete = (scannedState) => {
    // Flatten any Array prototype artifacts from FaceGrid
    const clean = {};
    for (const face of ['U','R','F','D','L','B']) {
      clean[face] = Array.from({ length: 9 }, (_, i) => scannedState[face][i] || 'W');
    }
    updateCubeState(clean);
    setSolution(null);
    setStatus('scrambled');
    setActiveTab('Scramble'); // switch so user sees cube + Solve button
  };

  // ── Manual input ───────────────────────────────────────────────────
  const handleManualChange = (newState) => {
    updateCubeState(newState);
    setSolution(null);
    setStatus('scrambled');
  };

  const solved = isSolved(cubeState);

  return (
    <div className="app-container" style={{ overflowX: 'hidden' }}>
      {/* Header */}
      <header className="app-header">
        <div className="header-logo-section">
          <CubeLogo />
          <div>
            <div className="title-main">RUBIK'S SOLVER</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, fontFamily: 'var(--font-mono)', textAlign: 'inherit', maxWidth: '100%', wordBreak: 'break-word' }}>
              IDA* · OpenCV · FastAPI · React
            </div>
          </div>
        </div>
        <div className="header-actions">
          <StatusPill status={status} />
          <button onClick={handleReset} className="btn-secondary" style={{ padding: '6px 16px', fontSize: 13 }}>Reset</button>
        </div>
      </header>

      {/* Main */}
      <main className="main-layout" style={{ width: '100%', maxWidth: '100vw' }}>
        {/* Left: Cube */}
        <div className="fade-in" style={{ width: '100%', minWidth: 0 }}>
          <div className="glass-card" style={{ width: '100%', overflowX: 'hidden' }}>
            <div className="label-mono">LIVE CUBE STATE</div>
            <div className="cube-container" style={{ width: '100%' }}>
              <CubeNet state={cubeState} faceSize={60} />
            </div>

            {scrambleMoves.length > 0 && status === 'scrambled' && (
              <div style={{ marginTop: 20, padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div className="label-mono" style={{ fontSize: 10 }}>SCRAMBLE SEQUENCE</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {scrambleMoves.map((m, i) => (
                    <span key={i} className="scramble-chip">{m}</span>
                  ))}
                </div>
              </div>
            )}

            {solved && status !== 'idle' && (
              <div style={{
                marginTop: 20, padding: '12px',
                background: 'rgba(110, 231, 183, 0.1)', borderRadius: 12,
                border: '1px solid rgba(110, 231, 183, 0.2)',
                fontSize: 14, color: 'var(--accent)',
                fontFamily: 'var(--font-mono)', textAlign: 'center',
                fontWeight: 600
              }}>
                ✓ CUBE SOLVED
              </div>
            )}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="fade-in" style={{ animationDelay: '0.1s', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)',
              borderRadius: 12, padding: '12px 16px',
              color: '#f87171', fontSize: 14,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <span>⚠ {error}</span>
              <button onClick={clearError} style={{ background: 'none', color: '#f87171', fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs-container">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} 
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}>
                {tab === 'Scan + Edit' ? '📷 Scan + Edit' : tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="glass-card" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {activeTab === 'Scramble' && (
              <ScrambleTab numMoves={numMoves} onNumMovesChange={setNumMoves}
                onScramble={handleScramble} loading={loading} />
            )}
            {activeTab === 'Scan + Edit' && (
              <WebcamScanner onScanComplete={handleScanComplete} />
            )}
            {activeTab === 'Solution' && (
              solution
                ? <SolutionViewer
                    result={solution}
                    onStepApply={handleStepApply}
                    onJumpTo={handleJumpTo}
                  />
                : <Empty text="Scramble or scan the cube first, then hit Solve below" />
            )}
          </div>

          {/* Solve bar */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', width: '100%' }}>
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <div className="label-mono">SOLVER ALGORITHM</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {['auto', 'ida_star', 'kociemba'].map(alg => (
                  <button key={alg} onClick={() => setAlgorithm(alg)} style={{
                    padding: '6px 14px', borderRadius: 8,
                    background: algorithm === alg ? 'rgba(110, 231, 183, 0.15)' : 'rgba(255,255,255,0.05)',
                    color: algorithm === alg ? 'var(--accent)' : 'var(--muted)',
                    fontSize: 12, fontFamily: 'var(--font-mono)',
                    border: algorithm === alg ? '1px solid var(--accent)' : '1px solid var(--border)',
                  }}>
                    {alg === 'auto' ? 'Auto' : alg === 'ida_star' ? 'IDA*' : 'Kociemba'}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleSolve} className="btn-primary" disabled={solved || loading} style={{ flex: '1 1 120px', minWidth: 0 }}>
              {loading ? 'Solving...' : solved ? '✓ Solved' : 'Solve Cube'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────

function ScrambleTab({ numMoves, onNumMovesChange, onScramble, loading }) {
  return (
    <div className="fade-in">
      <div style={{ fontSize: 16, color: 'var(--text)', marginBottom: 8, fontWeight: 600 }}>
        Random Scramble Generator
      </div>
      <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
        Generates a random sequence of moves to scramble the cube. IDA* works best for depth ≤ 8.
      </div>
      <div style={{ marginBottom: 32 }}>
        <div className="label-mono">SCRAMBLE DEPTH</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <input type="range" min={1} max={20} value={numMoves}
            onChange={e => onNumMovesChange(Number(e.target.value))} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 24, color: numMoves <= 8 ? 'var(--accent)' : 'var(--warn)', minWidth: 40, textAlign: 'right', fontWeight: 700 }}>
            {numMoves}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          <span style={{ color: 'var(--accent)' }}>IDA* Optimal (≤8)</span>
          <span style={{ color: 'var(--warn)' }}>Kociemba ({'>'}8)</span>
        </div>
      </div>
      <button onClick={onScramble} className="btn-primary" disabled={loading} style={{ width: '100%' }}>
        {loading ? 'Generating...' : 'Generate Scramble'}
      </button>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flex: 1, minHeight: 200, color: 'var(--muted)', fontSize: 15, textAlign: 'center', lineHeight: 1.6,
      opacity: 0.6
    }}>
      {text}
    </div>
  );
}

function Btn({ children, onClick, loading, disabled, secondary, small }) {
  // Keeping this for reference but moving to classes in App
  return (
    <button onClick={onClick} disabled={disabled || loading} className={secondary ? 'btn-secondary' : 'btn-primary'} style={{
      padding: small ? '7px 14px' : undefined,
      fontSize: small ? 13 : undefined,
    }}>
      {children}
    </button>
  );
}

function StatusPill({ status }) {
  const cfg = {
    idle:      { color: 'var(--muted)', bg: 'rgba(255,255,255,0.05)', label: 'Solved' },
    scrambled: { color: 'var(--warn)',  bg: 'rgba(251, 191, 36, 0.1)',  label: 'Scrambled' },
    solved:    { color: 'var(--accent)', bg: 'rgba(110, 231, 183, 0.1)',  label: 'Solution Ready' },
  }[status] || { color: 'var(--muted)', bg: 'rgba(255,255,255,0.05)', label: status };
  
  return (
    <div style={{
      padding: '6px 14px', borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      fontSize: 11, fontFamily: 'var(--font-mono)',
      border: `1px solid ${cfg.color}33`,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em'
    }}>
      {cfg.label}
    </div>
  );
}

function CubeLogo() {
  const colors = ['#ef4444','#f97316','#f9e24b','#48c774','#3b82f6','#f5f5f0'];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(3, 10px)',
      gap: 2, padding: 3, background: '#1a1d25', borderRadius: 6,
    }}>
      {colors.map((c, i) => (
        <div key={i} style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />
      ))}
    </div>
  );
}
