import React, { useRef, useState, useEffect, useCallback } from 'react';
import { COLOR_HEX, SOLVED_STATE, cloneState } from '../utils/cube';
import { api } from '../utils/api';

const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
const ALL_COLORS = ['W', 'Y', 'G', 'B', 'R', 'O'];

const FACE_LABELS = {
  U: 'TOP — White center UP',
  R: 'RIGHT — Red center facing you',
  F: 'FRONT — Green center facing you',
  D: 'BOTTOM — Yellow center UP',
  L: 'LEFT — Orange center facing you',
  B: 'BACK — Blue center facing you',
};

// Center color for each face (never changes — used to lock center sticker)
const FACE_CENTER_COLOR = { U:'W', R:'R', F:'G', D:'Y', L:'O', B:'B' };

// ─── Accurate HSV color classifier ──────────────────────────────────────────
function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const v = max;
  const s = max === 0 ? 0 : (max - min) / max;
  let h = 0;
  if (max !== min) {
    const d = max - min;
    if      (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, v];
}

function classifyColor(r, g, b) {
  const [h, s, v] = rgbToHsv(r, g, b);

  if (s < 0.18 && v > 0.72) return 'W';
  if (s < 0.25 || v < 0.18) return 'W';

  if (h < 15 || h > 345) return 'R';
  if (h >= 15 && h < 38) return 'O';
  if (h >= 38 && h < 75 && v > 0.45) return 'Y';
  if (h >= 75 && h < 165) return 'G';
  if (h >= 165 && h < 270) return 'B';
  if (h >= 270) return 'R';

  return 'W';
}

function samplePatch(imageData, cx, cy, patchR) {
  const { data, width, height } = imageData;
  const reds = [], greens = [], blues = [];
  for (let dy = -patchR; dy <= patchR; dy++) {
    for (let dx = -patchR; dx <= patchR; dx++) {
      const x = Math.round(cx + dx), y = Math.round(cy + dy);
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const i = (y * width + x) * 4;
      reds.push(data[i]); greens.push(data[i+1]); blues.push(data[i+2]);
    }
  }
  if (!reds.length) return [200, 200, 200];
  const trim = (arr) => {
    const sorted = [...arr].sort((a,b) => a-b);
    const cut = Math.max(1, Math.floor(sorted.length * 0.15));
    const trimmed = sorted.slice(cut, sorted.length - cut);
    return trimmed.reduce((a,b) => a+b, 0) / trimmed.length;
  };
  return [trim(reds), trim(greens), trim(blues)];
}

function detectFaceColors(canvas) {
  const ctx = canvas.getContext('2d');
  const { width: W, height: H } = canvas;
  const gridSize = Math.round(Math.min(W, H) * 0.52);
  const gx = Math.round((W - gridSize) / 2);
  const gy = Math.round((H - gridSize) / 2);
  const cell = gridSize / 3;
  const patchR = Math.max(6, Math.round(cell * 0.18));

  const imageData = ctx.getImageData(0, 0, W, H);
  const colors = [];
  const centers = [];

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const cx = gx + col * cell + cell / 2;
      const cy = gy + row * cell + cell / 2;
      const [r, g, b] = samplePatch(imageData, cx, cy, patchR);
      colors.push(classifyColor(r, g, b));
      centers.push({ x: cx, y: cy });
    }
  }
  return { colors, gridSize, gx, gy, cell, centers };
}

function drawOverlay(canvas, gridSize, gx, gy, cell, colors) {
  const ctx = canvas.getContext('2d');

  ctx.strokeStyle = '#6ee7b7';
  ctx.lineWidth = 3;
  ctx.strokeRect(gx, gy, gridSize, gridSize);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const x = gx + col * cell;
      const y = gy + row * cell;
      const idx = row * 3 + col;
      const color = colors[idx];
      const hex = COLOR_HEX[color] || '#888';
      const isCenter = idx === 4;

      ctx.globalAlpha = isCenter ? 0.9 : 0.75;
      ctx.fillStyle = hex;
      ctx.fillRect(x + 5, y + 5, cell - 10, cell - 10);
      ctx.globalAlpha = 1;

      ctx.strokeStyle = isCenter ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = isCenter ? 2 : 1;
      ctx.strokeRect(x + 5, y + 5, cell - 10, cell - 10);

      ctx.font = `bold ${Math.round(cell * 0.28)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = (color === 'W' || color === 'Y') ? '#222' : '#fff';
      ctx.fillText(color, x + cell / 2, y + cell / 2);
    }
  }
}

function drawFlatPreview(canvas, colors) {
  const ctx = canvas.getContext('2d');
  const S = canvas.width;
  const PAD = 6;
  const cell = (S - PAD * 2) / 3;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#0a0b0f';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 9; i++) {
    const r = Math.floor(i / 3), c = i % 3;
    const x = PAD + c * cell;
    const y = PAD + r * cell;
    const col = COLOR_HEX[colors[i]] || '#333';
    ctx.fillStyle = col;
    ctx.fillRect(x + 2, y + 2, cell - 4, cell - 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
    ctx.font = `bold ${Math.round(cell * 0.32)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = (colors[i] === 'W' || colors[i] === 'Y') ? '#111' : '#fff';
    ctx.fillText(colors[i], x + cell / 2, y + cell / 2);
  }
}

function classifyAlignment(centers) {
  if (!centers || centers.length !== 9) return 'lost';
  const tl = centers[0], tr = centers[2], bl = centers[6], br = centers[8];
  const topW   = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const botW   = Math.hypot(br.x - bl.x, br.y - bl.y);
  const leftH  = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const rightH = Math.hypot(br.x - tr.x, br.y - tr.y);
  if (topW < 30 || leftH < 30) return 'lost';
  const aspect = Math.max(topW, botW, leftH, rightH) /
                 Math.min(topW, botW, leftH, rightH);
  if (aspect > 1.45) return 'lost';
  const vRatio = topW / botW;
  const hRatio = leftH / rightH;
  if (vRatio < 0.78) return 'tilt_v';
  if (hRatio < 0.78) return 'tilt_h';
  if (vRatio > 1.22) return 'tilt_v';
  if (hRatio > 1.22) return 'tilt_h';
  return 'good';
}

// ─── FaceGrid: editable 3×3 grid for one face (camera mode) ─────────────────
function FaceGrid({ face, colors, onChange, selectedColor, onSelectColor }) {
  return (
    <div className="fade-in">
      {/* Color palette */}
      <div style={{ marginBottom: 12 }}>
        <div className="label-mono" style={{ fontSize: 9 }}>PAINT COLOR</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {ALL_COLORS.map(c => (
            <button key={c} onClick={() => onSelectColor(c)} style={{
              width: 32, height: 32, borderRadius: 8,
              background: COLOR_HEX[c],
              border: selectedColor === c ? '3px solid white' : '2px solid rgba(0,0,0,0.2)',
              transform: selectedColor === c ? 'scale(1.15)' : 'scale(1)',
              boxShadow: selectedColor === c ? `0 0 12px ${COLOR_HEX[c]}88` : 'none',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              cursor: 'pointer',
            }} title={c} />
          ))}
        </div>
      </div>

      {/* 3×3 editable grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 4,
        background: 'rgba(0,0,0,0.3)',
        padding: 6,
        borderRadius: 12,
        border: '1px solid var(--border)',
        maxWidth: 200,
      }}>
        {colors.map((color, i) => {
          const isCenter = i === 4;
          return (
            <div
              key={i}
              onClick={() => !isCenter && onChange(i, selectedColor)}
              style={{
                aspectRatio: '1/1',
                background: COLOR_HEX[color] || '#333',
                borderRadius: 6,
                border: isCenter
                  ? '3px solid rgba(255,255,255,0.6)'
                  : '1px solid rgba(0,0,0,0.2)',
                cursor: isCenter ? 'default' : 'crosshair',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: (color === 'W' || color === 'Y') ? '#111' : '#fff',
                transition: 'all 0.15s',
                boxShadow: isCenter ? 'inset 0 0 0 2px rgba(255,255,255,0.2)' : 'none',
              }}
              onMouseEnter={e => { if (!isCenter) e.currentTarget.style.filter = 'brightness(1.2) saturate(1.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
            >
              {color}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Full cube net (6 faces at once) for manual mode ────────────────────────
function FullCubeNet({ state, onChange, selectedColor, onSelectColor }) {
  return (
    <div className="fade-in">
      {/* Color palette */}
      <div style={{ marginBottom: 20 }}>
        <div className="label-mono">SELECT PAINT COLOR</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ALL_COLORS.map(c => (
            <button key={c} onClick={() => onSelectColor(c)} style={{
              width: 36, height: 36, borderRadius: 10,
              background: COLOR_HEX[c],
              border: selectedColor === c ? '3px solid white' : '2px solid rgba(0,0,0,0.2)',
              transform: selectedColor === c ? 'scale(1.2)' : 'scale(1)',
              boxShadow: selectedColor === c ? `0 0 15px ${COLOR_HEX[c]}aa` : 'none',
              transition: 'all 0.2s',
              cursor: 'pointer',
            }} title={c} />
          ))}
        </div>
      </div>

      <div className="label-mono" style={{ fontSize: 10, marginBottom: 12 }}>
        CLICK STICKERS TO PAINT · CENTER STICKERS ARE FIXED
      </div>

      {/* Cube net layout */}
      <div className="cube-container" style={{ display: 'block' }}>
        <div style={{
          display: 'grid',
          gridTemplateRows: 'auto auto auto',
          gridTemplateColumns: 'repeat(4, minmax(60px, 1fr))',
          gap: 10,
          maxWidth: 450,
          margin: '0 auto'
        }}>
          <div style={{ gridRow: 1, gridColumn: 2 }}>
            <FaceLabel3x3 face="U" colors={state.U} onChange={(i, c) => onChange('U', i, c)} selectedColor={selectedColor} />
          </div>
          {[['L', 1], ['F', 2], ['R', 3], ['B', 4]].map(([face, col]) => (
            <div key={face} style={{ gridRow: 2, gridColumn: col }}>
              <FaceLabel3x3 face={face} colors={state[face]} onChange={(i, c) => onChange(face, i, c)} selectedColor={selectedColor} />
            </div>
          ))}
          <div style={{ gridRow: 3, gridColumn: 2 }}>
            <FaceLabel3x3 face="D" colors={state.D} onChange={(i, c) => onChange('D', i, c)} selectedColor={selectedColor} />
          </div>
        </div>
      </div>
    </div>
  );
}

function FaceLabel3x3({ face, colors, onChange, selectedColor }) {
  return (
    <div>
      <div style={{
        textAlign: 'center', fontSize: 10, color: 'var(--muted)',
        marginBottom: 4, fontFamily: 'var(--font-mono)', fontWeight: 700
      }}>
        {face}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 2,
        background: 'rgba(255,255,255,0.05)',
        padding: 3,
        borderRadius: 8,
        border: '1px solid var(--border)',
      }}>
        {colors.map((color, i) => {
          const isCenter = i === 4;
          return (
            <div
              key={i}
              onClick={() => !isCenter && onChange(i, selectedColor)}
              style={{
                aspectRatio: '1/1',
                background: COLOR_HEX[color] || '#333',
                borderRadius: 4,
                border: isCenter
                  ? '2px solid rgba(255,255,255,0.4)'
                  : '1px solid rgba(0,0,0,0.1)',
                cursor: isCenter ? 'default' : 'crosshair',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: (color === 'W' || color === 'Y') ? '#111' : '#fff',
                transition: 'all 0.1s',
              }}
              onMouseEnter={e => { if (!isCenter) e.currentTarget.style.filter = 'brightness(1.25)'; }}
              onMouseLeave={e => { e.currentTarget.style.filter = ''; }}
            >
              {face === 'F' && i === 4 ? 'F' : ''}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Alignment hint ──────────────────────────────────────────────────────────
const ALIGNMENT_MSG = {
  idle:   { text: 'Waiting for camera…',                                 color: '#6b7280' },
  lost:   { text: '✗ No cube detected — hold it inside the green grid',  color: '#ef4444' },
  tilt_v: { text: '⚠ Tilt the cube forward / back',                      color: '#fbbf24' },
  tilt_h: { text: '⚠ Rotate the cube slightly left / right',             color: '#fbbf24' },
  good:   { text: '✓ Hold steady — face looks flat',                     color: '#6ee7b7' },
};

function AlignmentHint({ status }) {
  const m = ALIGNMENT_MSG[status] || ALIGNMENT_MSG.idle;
  return (
    <div style={{
      marginTop: 10, padding: '8px 12px',
      background: `${m.color}11`,
      border: `1px solid ${m.color}55`,
      borderRadius: 10,
      fontSize: 12, color: m.color, fontFamily: 'var(--font-mono)',
      textAlign: 'center', width: '100%',
    }}>
      {m.text}
    </div>
  );
}

// ─── Main WebcamScanner component ───────────────────────────────────────────
export default function WebcamScanner({ onScanComplete }) {
  const [mode, setMode] = useState('choose'); // 'choose' | 'camera' | 'manual'

  const videoRef         = useRef(null);
  const canvasRef        = useRef(null);
  const previewCanvasRef = useRef(null);
  const rafRef           = useRef(null);
  const [stream, setStream] = useState(null);

  const [camError,      setCamError]      = useState('');
  const [faceIdx,       setFaceIdx]       = useState(0);
  const [editColors,    setEditColors]    = useState(Array(9).fill('W'));
  const [scanned,       setScanned]       = useState({});
  const [selectedColor, setSelectedColor] = useState('R');
  const [userEdited,    setUserEdited]    = useState(false);
  const [frozen,        setFrozen]        = useState(false);
  const [alignment,     setAlignment]     = useState('idle');

  const [manualState, setManualState] = useState(() => {
    const s = cloneState(SOLVED_STATE);
    s.U[4] = FACE_CENTER_COLOR.U;
    s.R[4] = FACE_CENTER_COLOR.R;
    s.F[4] = FACE_CENTER_COLOR.F;
    s.D[4] = FACE_CENTER_COLOR.D;
    s.L[4] = FACE_CENTER_COLOR.L;
    s.B[4] = FACE_CENTER_COLOR.B;
    return s;
  });
  const [manualSelectedColor, setManualSelectedColor] = useState('R');

  const face = FACE_ORDER[faceIdx];

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  // Handle cleanup on unmount or stream change
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [stream]);

  // Enter camera mode
  useEffect(() => {
    if (mode !== 'camera') return;
    let cancelled = false;
    setCamError('');
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'environment' },
        });
        if (cancelled) {
          s.getTracks().forEach(t => t.stop());
          return;
        }
        setStream(s);
        setFrozen(false);
      } catch (e) {
        if (cancelled) return;
        setCamError(`Camera blocked: ${e.message}. Switching to manual entry…`);
        setTimeout(() => setMode('manual'), 600);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mode]);

  // Attach stream to <video> once mounted
  useEffect(() => {
    if (mode !== 'camera') return;
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => {});
  }, [mode, faceIdx, frozen, stream]);

  // Render loop
  useEffect(() => {
    if (mode !== 'camera' || frozen || !stream) return;
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      canvas.width  = video.videoWidth  || 640;
      canvas.height = video.videoHeight || 480;

      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0, canvas.width, canvas.height);
      ctx.restore();

      const { colors, gridSize, gx, gy, cell, centers } = detectFaceColors(canvas);
      drawOverlay(canvas, gridSize, gx, gy, cell, colors);

      const pCanvas = previewCanvasRef.current;
      if (pCanvas) {
        if (pCanvas.width !== 140) { pCanvas.width = 140; pCanvas.height = 140; }
        drawFlatPreview(pCanvas, colors);
      }

      const newAlignment = classifyAlignment(centers);
      setAlignment(prev => (prev === newAlignment ? prev : newAlignment));

      if (!userEdited) setEditColors([...colors]);

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mode, frozen, faceIdx, userEdited, stream]);

  // Reset edit grid on face change
  useEffect(() => {
    if (mode !== 'camera') return;
    const initial = Array(9).fill('W');
    initial[4] = FACE_CENTER_COLOR[FACE_ORDER[faceIdx]];
    setEditColors(initial);
    setUserEdited(false);
    setFrozen(false);
    setAlignment('idle');
  }, [faceIdx, mode]);

  const handleEditCell = (idx, color) => {
    setEditColors(prev => {
      const next = [...prev];
      next[idx] = color;
      return next;
    });
    setUserEdited(true);
  };

  const confirmFace = () => {
    const final = [...editColors];
    final[4] = FACE_CENTER_COLOR[face];
    const newScanned = { ...scanned, [face]: final };
    setScanned(newScanned);

    if (faceIdx + 1 >= FACE_ORDER.length) {
      stopCamera();
      api.setScannedState(newScanned).catch(() => {});
      onScanComplete(newScanned);
    } else {
      setFaceIdx(faceIdx + 1);
    }
  };

  const retake = () => {
    if (faceIdx === 0) return;
    const prev = faceIdx - 1;
    const prevScanned = { ...scanned };
    delete prevScanned[FACE_ORDER[prev]];
    setScanned(prevScanned);
    setFaceIdx(prev);
  };

  const cancelCamera = () => {
    stopCamera();
    setFaceIdx(0);
    setScanned({});
    setEditColors(Array(9).fill('W'));
    setUserEdited(false);
    setFrozen(false);
    setAlignment('idle');
    setCamError('');
    setMode('choose');
  };

  const handleManualEdit = (face, idx, color) => {
    if (idx === 4) return;
    setManualState(prev => {
      const next = cloneState(prev);
      next[face][idx] = color;
      next.U[4] = FACE_CENTER_COLOR.U;
      next.R[4] = FACE_CENTER_COLOR.R;
      next.F[4] = FACE_CENTER_COLOR.F;
      next.D[4] = FACE_CENTER_COLOR.D;
      next.L[4] = FACE_CENTER_COLOR.L;
      next.B[4] = FACE_CENTER_COLOR.B;
      return next;
    });
  };

  const confirmManual = () => {
    api.setScannedState(manualState).catch(() => {});
    onScanComplete(manualState);
  };

  // ── RENDER ────────────────────────────────────────────────────────────────

  if (mode === 'choose') {
    return (
      <div className="fade-in">
        <div style={{ fontSize: 18, color: 'var(--text)', fontWeight: 600, marginBottom: 8 }}>
          Scan + Manual Editor
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 24 }}>
          Choose between using your camera for live color detection or entering the cube state manually. 
          The camera works best in good, natural lighting.
        </div>
        {camError && (
          <div style={{
            padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 12,
            color: 'var(--danger)', fontSize: 13, marginBottom: 16,
            border: '1px solid var(--danger)',
          }}>⚠ {camError}</div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button onClick={() => setMode('camera')} className="btn-primary" style={{ flex: 1, minWidth: 140 }}>
            📷 Start Camera Scan
          </button>
          <button onClick={() => setMode('manual')} className="btn-secondary" style={{ flex: 1, minWidth: 140 }}>
            ✏️ Manual Entry Only
          </button>
        </div>
        <div style={{
          marginTop: 24, padding: '16px',
          background: 'rgba(251, 191, 36, 0.05)', borderRadius: 14,
          border: '1px solid rgba(251, 191, 36, 0.15)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6,
        }}>
          <span style={{ color: 'var(--warn)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>PRO TIP:</span> 
          Avoid warm/yellow lighting as it can make orange look red. Natural daylight or cool white LEDs are ideal for the most accurate scan.
        </div>
      </div>
    );
  }

  if (mode === 'manual') {
    return (
      <div className="fade-in">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
          <button onClick={() => setMode('choose')} className="btn-secondary" style={{ padding: '6px 14px', fontSize: 12 }}>
            ← Back
          </button>
          <div style={{ fontSize: 16, color: 'var(--text)', fontWeight: 600 }}>
            Manual Cube Entry
          </div>
        </div>

        <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 24 }}>
          Click any sticker to paint it with the selected color. Centers are fixed to maintain cube orientation.
        </div>

        <FullCubeNet
          state={manualState}
          onChange={handleManualEdit}
          selectedColor={manualSelectedColor}
          onSelectColor={setManualSelectedColor}
        />

        <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={confirmManual} className="btn-primary" style={{ padding: '12px 32px' }}>
            ✓ Use This State
          </button>
          <button onClick={() => {
            const s = cloneState(SOLVED_STATE);
            s.U[4] = FACE_CENTER_COLOR.U;
            s.R[4] = FACE_CENTER_COLOR.R;
            s.F[4] = FACE_CENTER_COLOR.F;
            s.D[4] = FACE_CENTER_COLOR.D;
            s.L[4] = FACE_CENTER_COLOR.L;
            s.B[4] = FACE_CENTER_COLOR.B;
            setManualState(s);
          }} className="btn-secondary">↺ Reset to Solved</button>
        </div>
      </div>
    );
  }

  // ── mode === 'camera' ──────────────────────────────────────────────────────
  return (
    <div className="fade-in">
      {/* Face progress bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        {FACE_ORDER.map((f, i) => (
          <div key={f} style={{
            padding: '5px 12px', borderRadius: 8, fontSize: 11,
            fontFamily: 'var(--font-mono)',
            background: i < faceIdx ? 'rgba(110, 231, 183, 0.15)'
              : i === faceIdx ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255, 255, 255, 0.03)',
            color: i < faceIdx ? 'var(--accent)'
              : i === faceIdx ? 'var(--warn)' : 'var(--muted)',
            border: i === faceIdx ? '1px solid var(--warn)' : '1px solid var(--border)',
            fontWeight: i === faceIdx ? 700 : 400
          }}>
            {i < faceIdx ? '✓ ' : ''}{f}
          </div>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {faceIdx + 1} / 6
        </span>
      </div>

      {/* Face instruction */}
      <div style={{
        padding: '12px 16px', background: 'rgba(251, 191, 36, 0.05)',
        border: '1px solid rgba(251, 191, 36, 0.15)', borderRadius: 12,
        fontSize: 14, color: 'var(--warn)', marginBottom: 20,
        fontFamily: 'var(--font-mono)',
        display: 'flex', alignItems: 'center', gap: 10
      }}>
        <span style={{ fontSize: 18 }}>💡</span>
        <span>Hold the <b>{FACE_LABELS[face]}</b> inside the grid</span>
      </div>

      {/* Main scanning area */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 24, 
        alignItems: 'start' 
      }}>

        {/* Camera + Alignment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <div className="label-mono">LIVE FEED</div>
            <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
            <canvas ref={canvasRef} style={{
              borderRadius: 16, 
              border: '2px solid var(--border)',
              display: 'block', 
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              background: '#000'
            }} />
            {!stream && (
              <div style={{
                aspectRatio: '4/3',
                background: 'rgba(255,255,255,0.02)', borderRadius: 16,
                border: '2px dashed var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, color: 'var(--muted)',
                textAlign: 'center', padding: 20
              }}>
                {camError ? 'Camera access failed' : 'Requesting camera access...'}
              </div>
            )}
          </div>
          <AlignmentHint status={alignment} />
        </div>

        {/* Side Controls: Preview + Edit */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20 }}>
            {/* Flat Preview */}
            <div style={{ flex: '0 0 auto' }}>
              <div className="label-mono">DETECTED</div>
              <canvas
                ref={previewCanvasRef}
                width={140} height={140}
                style={{
                  borderRadius: 12, 
                  border: '2px solid rgba(110, 231, 183, 0.3)',
                  display: 'block', 
                  background: 'rgba(0,0,0,0.3)',
                }}
              />
            </div>

            {/* Editing grid */}
            <div style={{ flex: 1 }}>
              <div className="label-mono">EDIT IF WRONG</div>
              <FaceGrid
                face={face}
                colors={editColors}
                onChange={handleEditCell}
                selectedColor={selectedColor}
                onSelectColor={setSelectedColor}
              />
            </div>
          </div>

          {/* Confirmed summary */}
          {Object.keys(scanned).length > 0 && (
            <div className="glass-card" style={{ padding: 16, borderRadius: 16 }}>
              <div className="label-mono" style={{ fontSize: 10, marginBottom: 12 }}>CONFIRMED PROGRESS</div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {FACE_ORDER.filter(f => scanned[f]).map(f => (
                  <div key={f} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 10, color: 'var(--accent)', fontFamily: 'var(--font-mono)', marginBottom: 4, fontWeight: 700 }}>{f}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 10px)', gap: 1 }}>
                      {scanned[f].map((c, i) => (
                        <div key={i} style={{
                          width: 10, height: 10,
                          background: COLOR_HEX[c],
                          borderRadius: 2,
                        }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Controls */}
      <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={confirmFace} className="btn-primary" style={{ padding: '12px 32px' }}>
          {faceIdx < FACE_ORDER.length - 1
            ? `Confirm Face ${face} → Next`
            : 'Complete & Solve'}
        </button>

        {faceIdx > 0 && (
          <button onClick={retake} className="btn-secondary">
            ← Retake {FACE_ORDER[faceIdx - 1]}
          </button>
        )}

        <button onClick={cancelCamera} className="btn-secondary" style={{ 
          color: 'var(--danger)', 
          borderColor: 'rgba(248, 113, 113, 0.2)',
          marginLeft: 'auto' 
        }}>✕ Cancel</button>
      </div>
    </div>
  );
}
