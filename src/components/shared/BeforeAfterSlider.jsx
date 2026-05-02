import React, { useRef, useState, useCallback, useEffect } from 'react';
import './BeforeAfterSlider.css';

const BeforeAfterSlider = ({ beforeSrc, afterSrc }) => {
  const [pos, setPos] = useState(50);
  const containerRef = useRef(null);
  const dragging = useRef(false);

  const move = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(100, Math.max(0, next)));
  }, []);

  const onDown = (clientX) => { dragging.current = true; move(clientX); };
  const onUp   = () => { dragging.current = false; };

  useEffect(() => {
    const onMove = (e) => { if (dragging.current) move(e.clientX ?? e.touches?.[0]?.clientX); };
    const onEnd  = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onEnd);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend',  onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend',  onEnd);
    };
  }, [move]);

  return (
    <div
      className="ba-root"
      ref={containerRef}
      onMouseDown={(e) => onDown(e.clientX)}
      onTouchStart={(e) => onDown(e.touches[0].clientX)}
    >
      {/* Before — full width baseline */}
      <img src={beforeSrc} alt="Before" className="ba-img ba-before" draggable={false} />

      {/* After — clipped to right side of divider */}
      <div className="ba-after-wrap" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <img src={afterSrc} alt="After" className="ba-img" draggable={false} />
      </div>

      {/* Divider handle */}
      <div className="ba-handle" style={{ left: `${pos}%` }} onMouseDown={(e) => { e.stopPropagation(); onDown(e.clientX); }}>
        <div className="ba-line" />
        <div className="ba-knob">
          <span className="ba-arrow">◀</span>
          <span className="ba-arrow">▶</span>
        </div>
      </div>

      {/* Labels */}
      <span className="ba-label ba-label-before">Before</span>
      <span className="ba-label ba-label-after">After</span>
    </div>
  );
};

export default BeforeAfterSlider;
