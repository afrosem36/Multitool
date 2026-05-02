import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const COLORS = [
  'rgb(125,211,252)',  // sky-300
  'rgb(249,168,212)',  // pink-300
  'rgb(134,239,172)',  // green-300
  'rgb(253,224,71)',   // yellow-300
  'rgb(252,165,165)',  // red-300
  'rgb(216,180,254)',  // purple-300
  'rgb(147,197,253)',  // blue-300
  'rgb(165,180,252)',  // indigo-300
  'rgb(196,181,253)',  // violet-300
];

// Reduced grid for performance — still fills the background visually
const ROWS = 100;
const COLS = 70;

function getRandomColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export const BoxesCore = React.memo(function BoxesCore({ style, className }) {
  // Pre-compute which cells show the + SVG (every even row AND even col)
  const rows = useMemo(() => Array.from({ length: ROWS }, (_, i) => i), []);
  const cols = useMemo(() => Array.from({ length: COLS }, (_, j) => j), []);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '25%',
        top: '-25%',
        width: '100%',
        height: '100%',
        transform: 'translate(-40%,-60%) skewX(-48deg) skewY(14deg) scale(0.675) rotate(0deg) translateZ(0)',
        display: 'flex',
        zIndex: 0,
        padding: '1rem',
        ...style,
      }}
      className={className}
    >
      {rows.map(i => (
        <div
          key={i}
          style={{
            width: 64,
            height: 32,
            borderLeft: '1px solid rgba(100,116,139,0.3)',
            position: 'relative',
            flexShrink: 0,
          }}
        >
          {cols.map(j => (
            <motion.div
              key={j}
              whileHover={{ backgroundColor: getRandomColor(), transition: { duration: 0 } }}
              style={{
                width: 64,
                height: 32,
                borderRight: '1px solid rgba(100,116,139,0.3)',
                borderTop: '1px solid rgba(100,116,139,0.3)',
                position: 'relative',
              }}
            >
              {j % 2 === 0 && i % 2 === 0 && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="1.5"
                  stroke="currentColor"
                  style={{
                    position: 'absolute',
                    height: 24,
                    width: 40,
                    top: -14,
                    left: -22,
                    color: 'rgba(100,116,139,0.3)',
                    strokeWidth: 1,
                    pointerEvents: 'none',
                  }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6" />
                </svg>
              )}
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
});

export const Boxes = BoxesCore;
