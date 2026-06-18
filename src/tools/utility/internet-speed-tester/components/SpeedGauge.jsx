import React from 'react';
import { Gauge } from '@/components/ui/gauge-1';

/**
 * SpeedGauge - animated speed tester meter and progress bar.
 *
 * @param {object} props
 * @param {number} props.value - Current speed value
 * @param {number} [props.max] - Maximum scale value
 * @param {number} [props.size] - Gauge size in px
 * @param {string} [props.color] - Accent color
 * @param {string} [props.unit] - Display unit
 */
export default function SpeedGauge({ value, max = 200, size = 240, color = '#22d3ee', unit = 'Mbps' }) {
  const safeValue = Number.isFinite(value) ? Math.max(value, 0) : 0;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  const percent = Math.min((safeValue / safeMax) * 100, 100);
  const displayValue = formatSpeed(safeValue);
  const quality = getSpeedQuality(safeValue);

  return (
    <div
      className="ist-speed-gauge"
      style={{ '--ist-gauge-color': color, '--ist-gauge-percent': `${percent}%` }}
      aria-label={`Speed gauge: ${displayValue} ${unit}`}
    >
      <div className="ist-speed-gauge__ring">
        <Gauge
          value={safeValue}
          min={0}
          max={safeMax}
          size={size}
          strokeWidth={8}
          gradient
          glowEffect
          tickMarks
          label={unit}
          unit={unit}
          primary={{
            0: '#f87171',
            15: '#f59e0b',
            35: '#22d3ee',
            70: color,
          }}
          secondary="rgba(255,255,255,0.10)"
          thresholds={[
            { value: safeMax * 0.25, color: 'rgba(245,158,11,0.9)' },
            { value: safeMax * 0.5, color: 'rgba(34,211,238,0.9)' },
            { value: safeMax * 0.75, color },
          ]}
          className={{
            svgClassName: 'ist-speed-gauge__svg',
            textClassName: 'ist-speed-gauge__value',
            labelClassName: 'ist-speed-gauge__unit',
          }}
        />
      </div>

      <div className="ist-speed-gauge__status">
        <span>{quality}</span>
        <strong>
          {displayValue} {unit}
        </strong>
      </div>

      <div className="ist-speed-gauge__bar" aria-hidden="true">
        <span className="ist-speed-gauge__bar-fill" />
      </div>

      <div className="ist-speed-gauge__scale">
        <span>0</span>
        <span>{formatSpeed(safeMax / 2)}</span>
        <span>
          {formatSpeed(safeMax)} {unit}
        </span>
      </div>
    </div>
  );
}

function formatSpeed(speed) {
  if (speed < 1) return speed.toFixed(2);
  if (speed >= 100) return String(Math.round(speed));
  return speed.toFixed(1);
}

function getSpeedQuality(speed) {
  if (speed >= 100) return 'Excellent';
  if (speed >= 50) return 'Fast';
  if (speed >= 20) return 'Good';
  if (speed > 0) return 'Warming up';
  return 'Waiting for signal';
}
