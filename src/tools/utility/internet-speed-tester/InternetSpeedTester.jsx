import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, ArrowDown, ArrowUp, Activity, Zap, AlertCircle, Globe } from 'lucide-react';
import { useSpeedTest } from './hooks/useSpeedTest';
import TestProgress from './components/TestProgress';
import ResultCards from './components/ResultCards';
import NetworkInfo from './components/NetworkInfo';
import './internetSpeedTester.css';

// ─── Landing feature badges ────────────────────────────────────────────────────

const FEATURES = [
  { icon: ArrowDown,    label: 'Download',    color: '#10b981' },
  { icon: ArrowUp,      label: 'Upload',      color: '#22d3ee' },
  { icon: Activity,     label: 'Ping',        color: '#f59e0b' },
  { icon: Zap,          label: 'Jitter',      color: '#a78bfa' },
  { icon: AlertCircle,  label: 'Packet Loss', color: '#f87171' },
  { icon: Globe,        label: 'ISP Info',    color: '#fb923c' },
];

// ─── Landing Screen ────────────────────────────────────────────────────────────

function LandingScreen({ onStart, error }) {
  return (
    <div className="ist-screen">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="ist-landing"
      >
        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <p className="ist-landing__eyebrow">Network Diagnostics</p>
          <h1 className="ist-landing__title">Internet Speed Test</h1>
          <p className="ist-landing__subtitle">
            Measure download, upload, ping, jitter &amp; packet loss
          </p>
        </div>

        {/* CTA button with pulse rings */}
        <div className="ist-cta-wrapper" style={{ marginBottom: '2.5rem' }}>
          {[1, 2].map((i) => (
            <motion.div
              key={i}
              className="ist-pulse-ring"
              animate={{ scale: [1, 1.5 + i * 0.2], opacity: [0.18, 0] }}
              transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
            />
          ))}
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStart}
            className="ist-cta-btn"
            aria-label="Start speed test"
          >
            <Wifi size={28} />
            <span>GO</span>
          </motion.button>
        </div>

        {/* Feature grid */}
        <div className="ist-feature-grid">
          {FEATURES.map(({ icon: Icon, label, color }) => (
            <div key={label} className="ist-feature-tile">
              <Icon size={16} style={{ color }} />
              <span className="ist-feature-tile__label">{label}</span>
            </div>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="ist-error-banner"
            role="alert"
          >
            {error}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Root Component ────────────────────────────────────────────────────────────

export default function InternetSpeedTester() {
  const [unit, setUnit] = useState('Mbps');

  const {
    phase,
    phaseProgress,
    overallProgress,
    realTimeSpeed,
    speedHistory,
    results,
    networkInfo,
    error,
    isTesting,
    startTest,
    stopTest,
    resetTest,
  } = useSpeedTest();

  // Testing in progress
  if (isTesting) {
    return (
      <div className="ist-screen ist-screen--testing">
        <TestProgress
          phase={phase}
          phaseProgress={phaseProgress}
          overallProgress={overallProgress}
          realTimeSpeed={realTimeSpeed}
          speedHistory={speedHistory}
          onStop={stopTest}
        />
      </div>
    );
  }

  // Results view
  if (results) {
    return (
      <div className="ist-screen ist-screen--results" style={{ display: 'block' }}>
        <div style={{ maxWidth: 680, margin: '0 auto', padding: '2rem 1rem' }}>
          <ResultCards
            results={results}
            unit={unit}
            onUnitChange={setUnit}
            onRetest={resetTest}
          />
          <NetworkInfo info={networkInfo} />
        </div>
      </div>
    );
  }

  // Landing
  return <LandingScreen onStart={startTest} error={error} />;
}
