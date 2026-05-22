import React from 'react';
import { motion } from 'framer-motion';
import { TEST_PHASES } from '../constants';
import SpeedGauge from './SpeedGauge';
import LiveGraph from './LiveGraph';

const PHASE_LABELS = {
  ping:     'Measuring Latency…',
  download: 'Testing Download…',
  upload:   'Testing Upload…',
  done:     'Finalizing…',
};

const GAUGE_COLORS = {
  download: '#10b981',
  upload:   '#22d3ee',
  default:  '#a78bfa',
};

/**
 * TestProgress — displayed while the speed test is running.
 */
export default function TestProgress({
  phase,
  phaseProgress,
  overallProgress,
  realTimeSpeed,
  speedHistory,
  onStop,
}) {
  const currentStep = TEST_PHASES.findIndex((p) => p.key === phase) + 1;
  const phaseLabel  = PHASE_LABELS[phase] || 'Finalizing…';
  const gaugeColor  = GAUGE_COLORS[phase] || GAUGE_COLORS.default;
  const gaugeMax    = phase === 'upload' ? 100 : 200;

  return (
    <div className="ist-screen ist-screen--testing">
      {/* Phase stepper */}
      <div className="ist-stepper">
        {TEST_PHASES.map((p, i) => {
          const done   = currentStep > p.step;
          const active = currentStep === p.step;
          return (
            <React.Fragment key={p.key}>
              <div className="ist-step">
                <motion.div
                  className="ist-step__dot"
                  animate={active ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{
                    background: done
                      ? '#10b981'
                      : active
                      ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                      : 'rgba(255,255,255,0.07)',
                    border: active
                      ? '2px solid rgba(99,102,241,0.5)'
                      : '1px solid rgba(255,255,255,0.1)',
                    color: done || active ? '#fff' : 'rgba(255,255,255,0.3)',
                    boxShadow: active ? '0 0 16px rgba(99,102,241,0.4)' : 'none',
                  }}
                >
                  {done ? '✓' : p.step}
                </motion.div>
                <span
                  className="ist-step__label"
                  style={{ color: active ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: active ? 600 : 400 }}
                >
                  {p.label}
                </span>
              </div>
              {i < TEST_PHASES.length - 1 && <div className="ist-step__connector" />}
            </React.Fragment>
          );
        })}
      </div>

      {/* Speedometer */}
      <div className="ist-gauge-wrapper">
        <SpeedGauge value={realTimeSpeed} max={gaugeMax} color={gaugeColor} size={280} unit="Mbps" />
      </div>

      {/* Phase label */}
      <p className="ist-phase-label">{phaseLabel}</p>

      {/* Phase progress bar */}
      <div className="ist-progress-row">
        <div className="ist-progress-meta">
          <span>Phase</span>
          <span>{Math.round(phaseProgress)}%</span>
        </div>
        <div className="ist-progress-track">
          <motion.div
            className="ist-progress-fill"
            animate={{ width: `${phaseProgress}%` }}
            transition={{ duration: 0.3 }}
            style={{ background: `linear-gradient(90deg, #6366f1, ${gaugeColor})` }}
          />
        </div>
      </div>

      {/* Overall progress bar */}
      <div className="ist-progress-row" style={{ marginBottom: '1.25rem' }}>
        <div className="ist-progress-meta">
          <span>Overall</span>
          <span>{overallProgress}%</span>
        </div>
        <div className="ist-progress-track ist-progress-track--thin">
          <motion.div
            className="ist-progress-fill"
            animate={{ width: `${overallProgress}%` }}
            transition={{ duration: 0.5 }}
            style={{ background: 'linear-gradient(90deg, #22d3ee, #6366f1)' }}
          />
        </div>
      </div>

      {/* Live graph */}
      {speedHistory.length > 2 && (
        <div className="ist-graph-container">
          <LiveGraph data={speedHistory} height={100} />
        </div>
      )}

      {/* Stop button */}
      <button className="ist-btn-stop" onClick={onStop}>
        Stop Test
      </button>
    </div>
  );
}
