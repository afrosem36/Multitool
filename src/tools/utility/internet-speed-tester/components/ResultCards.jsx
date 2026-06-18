import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDown, ArrowUp, Activity, Zap, AlertCircle, RotateCw,
} from 'lucide-react';
import { SPEED_UNITS } from '../constants';
import {
  convertSpeed, qualityOf, pingQuality, jitterQuality, packetLossQuality,
} from '../utils/speedUtils';
import LiveGraph from './LiveGraph';

/**
 * ResultCards — the full results view after a test completes.
 */
export default function ResultCards({ results, unit, onUnitChange, onRetest }) {
  const dlMbps = results.downloadMbps;
  const ulMbps = results.uploadMbps;
  const qual   = qualityOf(dlMbps);
  const dlVal  = convertSpeed(results.downloadSpeed, unit);
  const ulVal  = convertSpeed(results.uploadSpeed, unit);

  const pQual  = pingQuality(results.ping);
  const jQual  = jitterQuality(results.jitter);
  const lQual  = packetLossQuality(results.packetLoss);

  const speedCards = [
    { label: 'Download', value: dlVal, mbps: dlMbps, icon: ArrowDown, color: '#10b981', glow: 'rgba(16,185,129,0.2)' },
    { label: 'Upload',   value: ulVal, mbps: ulMbps, icon: ArrowUp,   color: '#22d3ee', glow: 'rgba(34,211,238,0.2)' },
  ];

  const metricCards = [
    { icon: Activity,    label: 'Ping',        value: results.ping,       sub: 'ms', q: pQual },
    { icon: Zap,         label: 'Jitter',      value: results.jitter,     sub: 'ms', q: jQual },
    { icon: AlertCircle, label: 'Packet Loss', value: results.packetLoss, sub: '%',  q: lQual },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="ist-results-summary"
    >
        {/* Quality badge + title */}
        <div className="ist-results-header">
          <motion.span
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 220 }}
            className="ist-quality-badge"
            style={{
              background: qual.bg,
              border: `1px solid ${qual.color}40`,
              color: qual.color,
            }}
          >
            {qual.label}
          </motion.span>
          <h2 className="ist-results-title">Test Complete</h2>
        </div>

        {/* Download / Upload hero cards */}
        <div className="ist-speed-grid">
          {speedCards.map(({ label, value, mbps, icon: Icon, color, glow }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="ist-speed-card"
              style={{ border: `1px solid ${color}25`, boxShadow: `0 0 32px ${glow}` }}
            >
              <div className="ist-speed-card__label">
                <Icon size={14} style={{ color }} />
                <span style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
              </div>
              <div className="ist-speed-card__value">{value}</div>
              <div className="ist-speed-card__unit">{unit}</div>
              <div
                className="ist-speed-card__quality"
                style={{ color, background: `${color}18` }}
              >
                {qualityOf(mbps).label}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Ping / Jitter / Packet loss cards */}
        <div className="ist-metric-grid">
          {metricCards.map(({ icon: Icon, label, value, sub, q }) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="ist-metric-card"
            >
              <Icon size={14} style={{ color: q.c, marginBottom: 4 }} />
              <div className="ist-metric-card__label">{label}</div>
              <div className="ist-metric-card__value">
                {value}
                <span className="ist-metric-card__sub">{sub}</span>
              </div>
              <div className="ist-metric-card__quality" style={{ color: q.c }}>{q.t}</div>
            </motion.div>
          ))}
        </div>

        {/* Unit selector */}
        <div className="ist-unit-selector">
          {SPEED_UNITS.map((u) => (
            <button
              key={u}
              onClick={() => onUnitChange(u)}
              className={`ist-unit-btn${unit === u ? ' ist-unit-btn--active' : ''}`}
            >
              {u}
            </button>
          ))}
        </div>

        {/* Speed history graph */}
        {results.speedHistory.length > 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="ist-history-chart"
          >
            <p className="ist-section-label">Speed History</p>
            <LiveGraph data={results.speedHistory} height={130} />
          </motion.div>
        )}

        {/* Re-test button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={onRetest}
          className="ist-btn-retest"
        >
          <RotateCw size={16} />
          Test Again
        </motion.button>
    </motion.div>
  );
}
