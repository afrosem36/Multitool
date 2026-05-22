import React from 'react';
import { motion } from 'framer-motion';
import { polarToXY, buildArcPath } from '../utils/speedUtils';

const START_ANGLE = -210;
const END_ANGLE   = 30;
const TOTAL_DEG   = END_ANGLE - START_ANGLE; // 240°
const RADIUS      = 88;

/**
 * SpeedGauge — semi-arc SVG speedometer.
 *
 * @param {object} props
 * @param {number} props.value  - Current speed value
 * @param {number} [props.max]  - Maximum scale value (default 200)
 * @param {number} [props.size] - SVG canvas size in px (default 240)
 * @param {string} [props.color] - Needle / accent color
 * @param {string} [props.unit]  - Label shown beneath the number
 */
export default function SpeedGauge({ value, max = 200, size = 240, color = '#22d3ee', unit = 'Mbps' }) {
  const cx = size / 2;
  const cy = size / 2 + 14;

  const pct    = Math.min(value / max, 1);
  const arcDeg = pct * TOTAL_DEG;

  // Needle geometry
  const needleDeg   = START_ANGLE + arcDeg;
  const needleTip   = polarToXY(needleDeg, RADIUS - 6, cx, cy);
  const needleBase1 = polarToXY(needleDeg + 90, 7, cx, cy);
  const needleBase2 = polarToXY(needleDeg - 90, 7, cx, cy);

  const displayValue = value < 1
    ? value.toFixed(2)
    : value >= 100
    ? Math.round(value)
    : value.toFixed(1);

  return (
    <svg
      width={size}
      height={size * 0.72}
      viewBox={`0 0 ${size} ${size * 0.72}`}
      style={{ overflow: 'visible' }}
      aria-label={`Speed gauge: ${displayValue} ${unit}`}
    >
      {/* Track */}
      <path
        d={buildArcPath(START_ANGLE, END_ANGLE, RADIUS, cx, cy)}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="10"
        strokeLinecap="round"
      />

      {/* Gradient definition */}
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#6366f1" />
          <stop offset="50%"  stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Filled arc */}
      {value > 0 && (
        <motion.path
          d={buildArcPath(START_ANGLE, START_ANGLE + arcDeg, RADIUS, cx, cy)}
          fill="none"
          stroke="url(#gaugeGrad)"
          strokeWidth="10"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}

      {/* Needle */}
      <motion.polygon
        points={`${needleTip.x},${needleTip.y} ${needleBase1.x},${needleBase1.y} ${needleBase2.x},${needleBase2.y}`}
        fill={color}
        opacity={0.9}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <circle cx={cx} cy={cy} r="5" fill={color} opacity={0.9} />

      {/* Centre value */}
      <text x={cx} y={cy - 18} textAnchor="middle" fontSize="32" fontWeight="700" fill="#fff">
        {displayValue}
      </text>
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.4)" fontWeight="500">
        {unit}
      </text>
    </svg>
  );
}
