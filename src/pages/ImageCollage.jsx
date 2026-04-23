/**
 * @file ImageCollage.jsx
 * 
 * User-Control-First, Render-from-State Architecture
 * 
 * Transform State Pattern:
 * - Each image stores persistent transform: { x, y, scale }
 * - No derived positioning logic
 * - Preview & Canvas render from same state
 * - Layout changes don't reset user adjustments
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { ArrowDown, LayoutGrid, Trash2, Shuffle, X, RotateCcw } from 'lucide-react';
import FileUpload from '../components/shared/FileUpload';
import ProcessingState from '../components/shared/ProcessingState';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import { useFileValidation } from '../hooks/useFileValidation';
import { useToolHistory } from '../hooks/useToolHistory';
import { loadImageFromFile, downloadBlob } from '../utils/imageTools';
import './ToolStyles.css';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const BG_PRESETS = ['#ffffff', '#000000', '#1e293b', '#f1f5f9', '#fef9c3', '#fce7f3'];

const ASPECT_RATIOS = {
  '1:1':    1,
  '16:9':   9 / 16,
  '4:5':    5 / 4,
  '9:16':   16 / 9,
  '9:19.5': 19.5 / 9,
};

// ─────────────────────────────────────────────────────────────────────────────
// INLINED STYLES  (injected once into <head> so no extra .css file needed)
// ─────────────────────────────────────────────────────────────────────────────

const COLLAGE_CSS = `
.collage-thumb-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));margin-bottom:1.5rem}
.collage-thumb-card{position:relative;padding:.75rem;border-radius:16px;transition:opacity .2s,transform .15s}
.collage-thumb-card[draggable=true]{cursor:grab}
.collage-thumb-card.drag-over{outline:2px dashed var(--primary,#6366f1);outline-offset:2px}
.collage-thumb-card.dragging{opacity:.45;transform:scale(.97)}
.collage-thumb-img{width:100%;height:120px;object-fit:cover;border-radius:12px;display:block}
.collage-badge{position:absolute;top:.5rem;left:.5rem;min-width:22px;height:22px;padding:0 5px;border-radius:999px;background:var(--primary,#6366f1);color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;pointer-events:none;z-index:2;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.collage-remove-btn{position:absolute;top:.4rem;right:.4rem;border:none;border-radius:999px;width:34px;height:34px;display:grid;place-items:center;background:rgba(15,23,42,.9);color:#fff;cursor:pointer;transition:background .15s,transform .1s;z-index:2}
.collage-remove-btn:hover{background:#dc2626;transform:scale(1.1)}
.collage-caption-input{margin-top:.5rem;width:100%;padding:.3rem .5rem;border-radius:8px;border:1px solid var(--border,rgba(255,255,255,.12));background:var(--surface,rgba(255,255,255,.06));color:var(--text-primary,#f1f5f9);font-size:12px;outline:none;box-sizing:border-box;transition:border-color .15s}
.collage-caption-input:focus{border-color:var(--primary,#6366f1)}
.collage-skeleton-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));margin-bottom:1.5rem}
.collage-skeleton-img{width:100%;height:120px;border-radius:12px;background:linear-gradient(90deg,rgba(255,255,255,.06) 25%,rgba(255,255,255,.13) 50%,rgba(255,255,255,.06) 75%);background-size:200% 100%;animation:skshimmer 1.4s infinite}
@keyframes skshimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
.collage-swatches{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-top:.4rem}
.collage-swatch{width:28px;height:28px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:transform .15s,border-color .15s;flex-shrink:0}
.collage-swatch:hover{transform:scale(1.15)}
.collage-swatch.active{border-color:var(--primary,#6366f1);transform:scale(1.15)}
.collage-swatch-custom{width:28px;height:28px;border-radius:50%;border:2px dashed var(--text-secondary,#94a3b8);overflow:hidden;cursor:pointer;flex-shrink:0;position:relative;transition:transform .15s}
.collage-swatch-custom:hover{transform:scale(1.15)}
.collage-swatch-custom input[type=color]{position:absolute;inset:-4px;width:calc(100% + 8px);height:calc(100% + 8px);border:none;padding:0;cursor:pointer;opacity:.01}
.collage-wireframe{border-radius:12px;overflow:hidden;background:var(--surface,rgba(255,255,255,.04));border:1px dashed var(--border,rgba(255,255,255,.12));padding:8px;margin-bottom:1.5rem}
.collage-wireframe-cell{background:var(--text-secondary,rgba(148,163,184,.22));border-radius:6px;animation:wfpulse 2s infinite}
@keyframes wfpulse{0%,100%{opacity:.55}50%{opacity:.85}}
.collage-action-row{display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:center}
.collage-tooltip-wrap{position:relative;display:inline-flex}
.collage-tooltip-wrap .collage-tooltip{visibility:hidden;opacity:0;position:absolute;bottom:calc(100% + 6px);left:50%;transform:translateX(-50%);background:rgba(15,23,42,.93);color:#f1f5f9;font-size:12px;white-space:nowrap;padding:4px 10px;border-radius:6px;pointer-events:none;transition:opacity .15s;z-index:10}
.collage-tooltip-wrap:hover .collage-tooltip{visibility:visible;opacity:1}
.collage-output-meta{text-align:center;margin-top:.5rem;font-size:13px;color:var(--text-secondary,#94a3b8);display:flex;justify-content:center;gap:1rem;flex-wrap:wrap}
.collage-clear-btn{background:transparent;border:1px solid var(--border,rgba(255,255,255,.12));color:var(--text-secondary,#94a3b8);padding:.45rem 1rem;border-radius:10px;cursor:pointer;font-size:13px;display:inline-flex;align-items:center;gap:.35rem;transition:color .15s,border-color .15s}
.collage-clear-btn:hover{color:#dc2626;border-color:#dc2626}
.collage-clear-btn:disabled{opacity:.4;cursor:not-allowed}
.collage-settings-grid{display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin-bottom:1.5rem}
.collage-setting-label{display:flex;flex-direction:column;gap:.5rem}
.collage-setting-row{display:flex;justify-content:space-between;margin-bottom:.5rem}
.collage-select{padding:.75rem;border-radius:12px;background:var(--surface,rgba(255,255,255,.06));border:1px solid var(--border,rgba(255,255,255,.12));color:var(--text-primary,#f1f5f9);cursor:pointer}
.collage-single-warning{background:rgba(234,179,8,.12);border:1px solid rgba(234,179,8,.35);border-radius:10px;padding:.6rem 1rem;font-size:13px;color:#fbbf24;margin-bottom:1rem;text-align:center}
`;

function injectStyles() {
  if (document.getElementById('collage-styles')) return;
  const tag = document.createElement('style');
  tag.id = 'collage-styles';
  tag.textContent = COLLAGE_CSS;
  document.head.appendChild(tag);
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useDebounced(value, delay = 50) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS / WORKER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getWorkerSource() {
  return `
    function roundedClip(ctx,x,y,w,h,r){ctx.beginPath();if(r<=0){ctx.rect(x,y,w,h);}else{const cr=Math.min(r,w/2,h/2);ctx.moveTo(x+cr,y);ctx.lineTo(x+w-cr,y);ctx.quadraticCurveTo(x+w,y,x+w,y+cr);ctx.lineTo(x+w,y+h-cr);ctx.quadraticCurveTo(x+w,y+h,x+w-cr,y+h);ctx.lineTo(x+cr,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-cr);ctx.lineTo(x,y+cr);ctx.quadraticCurveTo(x,y,x+cr,y);ctx.closePath();}ctx.clip();}
    function drawImageWithTransform(ctx,img,x,y,w,h,r,transform){const s=Math.min(w/img.width,h/img.height);const dw=img.width*s,dh=img.height*s;const centerX=x+w/2,centerY=y+h/2;const finalScale=(transform?.scale||1)*s;const finalW=dw*finalScale,finalH=dh*finalScale;const dx=centerX-finalW/2+(transform?.x||0),dy=centerY-finalH/2+(transform?.y||0);ctx.save();roundedClip(ctx,x,y,w,h,r);ctx.drawImage(img,dx,dy,finalW,finalH);ctx.restore();}
    async function renderCollage(items,opts){const{columns,gap,padding,fit,background,cellWidth,cellHeight,borderRadius,showLabels}=opts;const LH=showLabels?28:0;const rows=Math.ceil(items.length/columns);const W=padding*2+columns*cellWidth+gap*(columns-1);const H=padding*2+rows*(cellHeight+LH)+gap*(rows-1);const canvas=new OffscreenCanvas(W,H);const ctx=canvas.getContext('2d');ctx.fillStyle=background;ctx.fillRect(0,0,W,H);items.forEach(({image,label,transform},i)=>{const col=i%columns,row=Math.floor(i/columns);const x=padding+col*(cellWidth+gap),y=padding+row*(cellHeight+LH+gap);drawImageWithTransform(ctx,image,x,y,cellWidth,cellHeight,borderRadius,transform);if(showLabels&&label){ctx.save();ctx.font='13px sans-serif';ctx.fillStyle='#374151';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,x+cellWidth/2,y+cellHeight+LH/2,cellWidth-8);ctx.restore();}});return canvas.convertToBlob({type:'image/png'});}
    self.onmessage=async(e)=>{const{bitmaps,labels,transforms,options}=e.data;try{const items=bitmaps.map((image,i)=>({image,label:labels[i]||'',transform:transforms[i]||{x:0,y:0,scale:1}}));const blob=await renderCollage(items,options);self.postMessage({blob});}catch(err){self.postMessage({error:err?.message??'Worker error'});}};
  `;
}

async function renderOnMainThread(items, opts) {
  const { columns, gap, padding, background, cellWidth, cellHeight, borderRadius, showLabels } = opts;
  const LH = showLabels ? 28 : 0;
  const rows = Math.ceil(items.length / columns);
  const W = padding * 2 + columns * cellWidth + gap * (columns - 1);
  const H = padding * 2 + rows * (cellHeight + LH) + gap * (rows - 1);
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');

  function roundedClip(x, y, w, h, r) {
    ctx.beginPath();
    if (r <= 0) { ctx.rect(x, y, w, h); }
    else {
      const cr = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x+cr,y); ctx.lineTo(x+w-cr,y); ctx.quadraticCurveTo(x+w,y,x+w,y+cr);
      ctx.lineTo(x+w,y+h-cr); ctx.quadraticCurveTo(x+w,y+h,x+w-cr,y+h);
      ctx.lineTo(x+cr,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-cr);
      ctx.lineTo(x,y+cr); ctx.quadraticCurveTo(x,y,x+cr,y); ctx.closePath();
    }
    ctx.clip();
  }

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, W, H);

  items.forEach(({ image, label, transform }, i) => {
    const col = i % columns, row = Math.floor(i / columns);
    const x = padding + col * (cellWidth + gap);
    const y = padding + row * (cellHeight + LH + gap);
    
    // Fit image to cell (contain logic only)
    const s = Math.min(cellWidth / image.width, cellHeight / image.height);
    const dw = image.width * s, dh = image.height * s;
    
    // Center image in cell, then apply user transform
    const centerX = x + cellWidth / 2;
    const centerY = y + cellHeight / 2;
    const finalScale = (transform?.scale || 1) * s;
    const finalW = dw * finalScale;
    const finalH = dh * finalScale;
    const dx = centerX - finalW / 2 + (transform?.x || 0);
    const dy = centerY - finalH / 2 + (transform?.y || 0);
    
    ctx.save();
    roundedClip(x, y, cellWidth, cellHeight, borderRadius);
    ctx.drawImage(image, dx, dy, finalW, finalH);
    ctx.restore();
    
    if (showLabels && label) {
      ctx.save(); ctx.font = '13px sans-serif'; ctx.fillStyle = '#374151';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, x+cellWidth/2, y+cellHeight+LH/2, cellWidth-8); ctx.restore();
    }
  });

  return new Promise((res, rej) =>
    canvas.toBlob((b) => b ? res(b) : rej(new Error('toBlob failed')), 'image/png')
  );
}

function computeDimensions(count, { columns, gap, padding, cellWidth, cellHeight, showLabels }) {
  const LH = showLabels ? 28 : 0;
  const rows = Math.ceil(count / columns);
  return {
    width:  padding * 2 + columns * cellWidth  + gap * (columns - 1),
    height: padding * 2 + rows * (cellHeight + LH) + gap * (rows - 1),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function ThumbSkeletons({ count }) {
  return (
    <div className="collage-skeleton-grid" aria-busy="true" aria-label="Loading images">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-panel" style={{ padding: '.75rem', borderRadius: 16 }}>
          <div className="collage-skeleton-img" />
        </div>
      ))}
    </div>
  );
}

function WireframePreview({ items, columns, gap, padding, cellWidth, cellHeight, onUpdateTransform }) {
  const rows = Math.ceil(items.length / columns);
  const containerStyle = useMemo(() => ({ padding }), [padding]);
  const gridStyle = useMemo(() => ({
    display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap,
  }), [columns, gap]);
  const cellStyle = { 
    aspectRatio: String(cellWidth / cellHeight), 
    position: 'relative', 
    overflow: 'hidden', 
    borderRadius: '8px', 
    backgroundColor: '#f8fafc',
    border: '1px solid rgba(255,255,255,0.1)',
    cursor: 'grab'
  };

  if (!items.length) return null;

  return (
    <div className="collage-wireframe" role="img" aria-label="Live layout preview">
      <p style={{ margin: '0 0 6px', fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center', letterSpacing: '.06em', textTransform: 'uppercase' }}>
        Layout preview · {columns} col × {rows} row · Drag to move, scroll to zoom
      </p>
      <div style={containerStyle}>
        <div style={gridStyle}>
          {items.map((item) => (
            <ImageCell 
              key={item.id} 
              item={item} 
              cellWidth={cellWidth}
              cellHeight={cellHeight}
              onUpdateTransform={onUpdateTransform}
              cellStyle={cellStyle}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function ImageCell({ item, cellWidth, cellHeight, onUpdateTransform, cellStyle }) {
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, startX: 0, startY: 0 });

  const transform = item.transform || { x: 0, y: 0, scale: 1 };

  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: transform.x,
      y: transform.y,
      startX: e.clientX,
      startY: e.clientY,
    };
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grabbing';
    }
  }, [transform]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.startX;
    const dy = e.clientY - dragStartRef.current.startY;
    onUpdateTransform(item.id, {
      x: dragStartRef.current.x + dx,
      y: dragStartRef.current.y + dy,
      scale: transform.scale,
    });
  }, [isDragging, item.id, transform.scale, onUpdateTransform]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    if (containerRef.current) {
      containerRef.current.style.cursor = 'grab';
    }
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const scaleStep = 0.1;
    const newScale = Math.max(0.5, Math.min(3, transform.scale - e.deltaY * 0.001 * scaleStep));
    onUpdateTransform(item.id, {
      x: transform.x,
      y: transform.y,
      scale: Number(newScale.toFixed(2)),
    });
  }, [transform, item.id, onUpdateTransform]);

  const handleDoubleClick = useCallback(() => {
    onUpdateTransform(item.id, { x: 0, y: 0, scale: 1 });
  }, [item.id, onUpdateTransform]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const imgStyle = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    maxWidth: '100%',
    maxHeight: '100%',
    width: 'auto',
    height: 'auto',
    objectFit: 'cover',
    transform: `translate(calc(-50% + ${transform.x}px), calc(-50% + ${transform.y}px)) scale(${transform.scale})`,
    transition: isDragging ? 'none' : 'transform 0.15s ease-out',
    pointerEvents: 'none',
  };

  return (
    <div
      ref={containerRef}
      style={cellStyle}
      onMouseDown={handleMouseDown}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
      title="Drag to move, scroll to zoom, double-click to reset"
    >
      <img src={item.url} alt={item.label || 'Image'} style={imgStyle} />
      <div style={{
        position: 'absolute',
        bottom: 4,
        right: 4,
        fontSize: '9px',
        color: 'rgba(255,255,255,0.6)',
        background: 'rgba(0,0,0,0.5)',
        padding: '2px 4px',
        borderRadius: '3px',
        pointerEvents: 'none',
      }}>
        {transform.scale.toFixed(1)}x
      </div>
    </div>
  );
}

function BgPalette({ value, onChange }) {
  const isPreset = BG_PRESETS.includes(value);
  return (
    <div className="collage-setting-label">
      <span>Background</span>
      <div className="collage-swatches">
        {BG_PRESETS.map((c) => (
          <button key={c} type="button"
            className={`collage-swatch${value === c ? ' active' : ''}`}
            style={{ background: c, boxShadow: c === '#ffffff' ? 'inset 0 0 0 1px #e2e8f0' : undefined }}
            aria-label={`Background ${c}`} aria-pressed={value === c}
            onClick={() => onChange(c)}
          />
        ))}
        <div
          className={`collage-swatch-custom${!isPreset ? ' active' : ''}`}
          style={!isPreset ? { background: value, border: '2px solid var(--primary,#6366f1)' } : {}}
          title="Custom colour" aria-label="Custom background colour"
        >
          <input type="color" value={isPreset ? '#aabbcc' : value}
            onChange={(e) => onChange(e.target.value)} aria-label="Custom colour picker" />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const ImageCollage = () => {
  useEffect(() => { injectStyles(); }, []);

  const [items, setItems]               = useState([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const [columns, setColumns]           = useState(2);
  const [gap, setGap]                   = useState(16);
  const [padding, setPadding]           = useState(20);
  const [background, setBackground]     = useState('#ffffff');
  const [cellWidth, setCellWidth]       = useState(320);
  const [borderRadius, setBorderRadius] = useState(0);
  const [aspectKey, setAspectKey]       = useState('1:1');
  const [outputBlob, setOutputBlob]     = useState(null);
  const [outputUrl, setOutputUrl]       = useState('');
  const [outputMeta, setOutputMeta]     = useState(null);
  const [status, setStatus]             = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const dColumns      = useDebounced(columns);
  const dGap          = useDebounced(gap);
  const dPadding      = useDebounced(padding);
  const dCellWidth    = useDebounced(cellWidth);
  const dBorderRadius = useDebounced(borderRadius);

  const dragSrcRef   = useRef(null);
  const itemsRef     = useRef([]);
  const outputUrlRef = useRef('');

  const { validateFiles } = useFileValidation();
  const { addHistory }    = useToolHistory();

  useEffect(() => { addHistory('/image/collage', 'Image Collage', 'image'); }, []);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { outputUrlRef.current = outputUrl; }, [outputUrl]);
  useEffect(() => () => {
    itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url));
    if (outputUrlRef.current) URL.revokeObjectURL(outputUrlRef.current);
  }, []);

  const cellHeight = useMemo(() => Math.round(cellWidth * (ASPECT_RATIOS[aspectKey] ?? 1)), [cellWidth, aspectKey]);
  const estimatedRows = useMemo(() => Math.ceil(items.length / columns), [items.length, columns]);
  const collageOptions = useMemo(() => ({
    columns: dColumns, gap: dGap, padding: dPadding, background,
    cellWidth: dCellWidth,
    cellHeight: Math.round(dCellWidth * (ASPECT_RATIOS[aspectKey] ?? 1)),
    borderRadius: dBorderRadius,
    showLabels: items.some((it) => it.label),
  }), [dColumns, dGap, dPadding, background, dCellWidth, dBorderRadius, aspectKey, items]);

  const canBuild    = items.length >= 2;
  const isSingleImg = items.length === 1;

  const handleFilesSelected = useCallback(async (selectedFiles) => {
    const { validFiles, error } = validateFiles(selectedFiles, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFiles: 9, currentCount: items.length, maxSizeMB: 20,
    });
    setStatus('idle'); setErrorMessage('');
    if (error) { setStatus('error'); setErrorMessage(error); }
    if (!validFiles.length) return;
    setLoadingCount(validFiles.length);
    try {
      const loaded = await Promise.all(
        validFiles.map(async (file) => {
          const { image } = await loadImageFromFile(file);
          return {
            id: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 7)}`,
            file, image, url: URL.createObjectURL(file), label: '',
            transform: { x: 0, y: 0, scale: 1 },
          };
        }),
      );
      setItems((prev) => [...prev, ...loaded]);
    } catch (err) {
      console.error(err); setStatus('error'); setErrorMessage('One or more images could not be loaded.');
    } finally { setLoadingCount(0); }
  }, [items.length, validateFiles]);

  const removeItem = useCallback((id) => {
    setItems((prev) => {
      const t = prev.find((it) => it.id === id);
      if (t) setTimeout(() => URL.revokeObjectURL(t.url), 200);
      return prev.filter((it) => it.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    setItems((prev) => { prev.forEach((it) => setTimeout(() => URL.revokeObjectURL(it.url), 200)); return []; });
    if (outputUrl) { setTimeout(() => URL.revokeObjectURL(outputUrl), 200); setOutputUrl(''); setOutputBlob(null); setOutputMeta(null); }
    setStatus('idle');
  }, [outputUrl]);

  const shuffle = useCallback(() => {
    setItems((prev) => {
      const a = [...prev];
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
      return a;
    });
  }, []);

  const updateLabel = useCallback((id, label) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, label } : it));
  }, []);

  const updateTransform = useCallback((id, transform) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, transform } : it));
  }, []);

  const handleDragStart = useCallback((e, id) => { dragSrcRef.current = id; e.dataTransfer.effectAllowed = 'move'; }, []);
  const handleDragOver  = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }, []);
  const handleDrop      = useCallback((e, targetId) => {
    e.preventDefault();
    const srcId = dragSrcRef.current;
    if (!srcId || srcId === targetId) return;
    setItems((prev) => {
      const next = [...prev];
      const si = next.findIndex((it) => it.id === srcId);
      const ti = next.findIndex((it) => it.id === targetId);
      if (si === -1 || ti === -1) return prev;
      const [moved] = next.splice(si, 1); next.splice(ti, 0, moved);
      return next;
    });
    dragSrcRef.current = null;
  }, []);

  const buildCollage = useCallback(async () => {
    if (!canBuild) return;
    setStatus('processing'); setErrorMessage('');
    try {
      const bitmaps   = await Promise.all(items.map((it) => createImageBitmap(it.image)));
      const labels    = items.map((it) => it.label || '');
      const transforms = items.map((it) => it.transform || { x: 0, y: 0, scale: 1 });
      const opts      = collageOptions;

      const blob = await new Promise((resolve, reject) => {
        try {
          const wb  = new Blob([getWorkerSource()], { type: 'text/javascript' });
          const wu  = URL.createObjectURL(wb);
          const w   = new Worker(wu);
          w.onmessage = (ev) => { URL.revokeObjectURL(wu); w.terminate(); ev.data.error ? reject(new Error(ev.data.error)) : resolve(ev.data.blob); };
          w.onerror   = (err) => { URL.revokeObjectURL(wu); w.terminate(); reject(err); };
          w.postMessage({ bitmaps, labels, transforms, options: opts }, bitmaps);
        } catch { reject(new Error('Worker unavailable')); }
      }).catch(() => renderOnMainThread(items, opts));

      const url = URL.createObjectURL(blob);
      if (outputUrl) setTimeout(() => URL.revokeObjectURL(outputUrl), 200);
      const dims = computeDimensions(items.length, opts);
      setOutputBlob(blob); setOutputUrl(url);
      setOutputMeta({ ...dims, sizeKB: Math.round(blob.size / 1024) });
      setStatus('success');
    } catch (err) {
      console.error(err); setStatus('error'); setErrorMessage('Unable to build the collage right now.');
    }
  }, [canBuild, items, collageOptions, outputUrl]);

  return (
    <div className="tool-container container" style={{ maxWidth: '1000px' }}>
      <div className="tool-header text-center animate-fade-in">
        <h1>Image Collage</h1>
        <p>Combine multiple photos into a single collage with full layout, spacing, and style control.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <FileUpload
          onFilesSelected={handleFilesSelected}
          accept="image/jpeg,image/png,image/webp"
          title={items.length ? 'Add more images to the collage' : 'Click or drag to upload collage images'}
          subtitle="Use at least two images · Up to nine images supported."
        />

        {loadingCount > 0 && <ThumbSkeletons count={loadingCount} />}

        {items.length > 0 && (
          <>
            {isSingleImg && (
              <div className="collage-single-warning" role="alert">
                ⚠ Add at least one more image to create a collage.
              </div>
            )}

            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
              <div className="collage-settings-grid">
                <label className="collage-setting-label">
                  <div className="collage-setting-row"><span>Columns</span><strong>{columns}</strong></div>
                  <input type="range" min="1" max="4" value={columns} onChange={(e) => setColumns(Number(e.target.value))} style={{ width: '100%' }} aria-label="Number of columns" />
                </label>
                <label className="collage-setting-label">
                  <div className="collage-setting-row"><span>Gap</span><strong>{gap}px</strong></div>
                  <input type="range" min="0" max="40" value={gap} onChange={(e) => setGap(Number(e.target.value))} style={{ width: '100%' }} aria-label="Gap between cells" />
                </label>
                <label className="collage-setting-label">
                  <div className="collage-setting-row"><span>Padding</span><strong>{padding}px</strong></div>
                  <input type="range" min="0" max="48" value={padding} onChange={(e) => setPadding(Number(e.target.value))} style={{ width: '100%' }} aria-label="Canvas padding" />
                </label>
                <label className="collage-setting-label">
                  <div className="collage-setting-row"><span>Cell Size</span><strong>{cellWidth}px</strong></div>
                  <input type="range" min="160" max="480" step="8" value={cellWidth} onChange={(e) => setCellWidth(Number(e.target.value))} style={{ width: '100%' }} aria-label="Cell width" />
                </label>
                <label className="collage-setting-label">
                  <div className="collage-setting-row"><span>Border Radius</span><strong>{borderRadius}px</strong></div>
                  <input type="range" min="0" max="32" value={borderRadius} onChange={(e) => setBorderRadius(Number(e.target.value))} style={{ width: '100%' }} aria-label="Cell border radius" />
                </label>
                <label className="collage-setting-label">
                  <span>Cell Aspect Ratio</span>
                  <select className="collage-select" value={aspectKey} onChange={(e) => setAspectKey(e.target.value)} aria-label="Cell aspect ratio">
                    <option value="1:1">Square (1:1)</option>
                    <option value="16:9">Landscape (16:9)</option>
                    <option value="4:5">Portrait (4:5)</option>
                    <option value="9:16">Mobile Portrait (9:16)</option>
                    <option value="9:19.5">Mobile Tall (9:19.5)</option>
                  </select>
                </label>
                <BgPalette value={background} onChange={setBackground} />
              </div>
            </div>

            <WireframePreview items={items} columns={columns} gap={gap} padding={padding} cellWidth={cellWidth} cellHeight={cellHeight} onUpdateTransform={updateTransform} />

            <div className="collage-thumb-grid" role="list" aria-label="Collage images">
              {items.map((item, index) => (
                <div
                  key={item.id} role="listitem"
                  className="collage-thumb-card glass-panel"
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, item.id)}
                  onDragEnter={(e) => e.currentTarget.classList.add('drag-over')}
                  onDragLeave={(e) => e.currentTarget.classList.remove('drag-over')}
                  onDragEnd={(e) => e.currentTarget.classList.remove('drag-over')}
                  aria-label={`Image ${index + 1}${item.label ? `: ${item.label}` : ''}`}
                >
                  <span className="collage-badge" aria-label={`Position ${index + 1}`}>{index + 1}</span>
                  <img src={item.url} alt={`Collage image ${index + 1}`} className="collage-thumb-img" />
                  <button className="collage-remove-btn" onClick={() => removeItem(item.id)} aria-label={`Remove image ${index + 1}`} title={`Remove image ${index + 1}`}>
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                  <input type="text" className="collage-caption-input" placeholder="Add caption…" value={item.label} onChange={(e) => updateLabel(item.id, e.target.value)} aria-label={`Caption for image ${index + 1}`} maxLength={60} />
                  
                  <button 
                    onClick={() => updateTransform(item.id, { x: 0, y: 0, scale: 1 })}
                    className="collage-clear-btn"
                    style={{ marginTop: '.5rem', width: '100%', justifyContent: 'center' }}
                    title="Reset image position and zoom"
                  >
                    <RotateCcw size={12} aria-hidden="true" /> Reset
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <button className="collage-clear-btn" onClick={shuffle} disabled={items.length < 2} aria-label="Shuffle image order">
                <Shuffle size={14} aria-hidden="true" /> Shuffle
              </button>
              {items.length >= 3 && (
                <button className="collage-clear-btn" onClick={clearAll} aria-label="Remove all images">
                  <X size={14} aria-hidden="true" /> Clear all
                </button>
              )}
            </div>

            <ProcessingState
              status={status}
              error={errorMessage}
              message={status === 'success' ? 'Collage created successfully.' : 'Building your collage…'}
            />

            <div className="collage-action-row">
              <div className="collage-tooltip-wrap">
                <button onClick={buildCollage} className="btn-primary" disabled={!canBuild} aria-disabled={!canBuild} aria-label="Create collage">
                  <LayoutGrid size={18} aria-hidden="true" /> Create Collage
                </button>
                {!canBuild && <span className="collage-tooltip" role="tooltip">Add at least 2 images</span>}
              </div>
              {outputBlob && (
                <button onClick={() => downloadBlob(outputBlob, 'image-collage.png')} className="btn-secondary" aria-label="Download collage PNG">
                  <ArrowDown size={18} aria-hidden="true" /> Download
                </button>
              )}
            </div>

            <p style={{ marginTop: '.75rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
              {items.length} image{items.length !== 1 ? 's' : ''} · {columns} column{columns !== 1 ? 's' : ''} · {estimatedRows} row{estimatedRows !== 1 ? 's' : ''}
            </p>

            {outputUrl && (
              <div className="glass-panel" style={{ padding: '1rem', marginTop: '1.5rem' }}>
                <img src={outputUrl} alt="Generated collage preview" style={{ width: '100%', borderRadius: '12px', display: 'block' }} />
                {outputMeta && (
                  <div className="collage-output-meta" aria-live="polite">
                    <span>📐 {outputMeta.width} × {outputMeta.height} px</span>
                    <span>💾 ~{outputMeta.sizeKB} KB</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {(items.length > 0 || outputBlob) && <AdPlaceholder className="mt-5" />}
    </div>
  );
};

export default ImageCollage;