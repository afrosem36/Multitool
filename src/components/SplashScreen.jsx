import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const WORDS = ['MultiTool', 'Hub'];

// ── Individual letter animation ───────────────────────────────────────────────
const Letter = ({ char, delay }) => (
  <motion.span
    initial={{ opacity: 0, y: 24, filter: 'blur(8px)' }}
    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
    transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    style={{ display: 'inline-block', whiteSpace: char === ' ' ? 'pre' : 'normal' }}
  >
    {char === ' ' ? ' ' : char}
  </motion.span>
);

// ── Animated orb ─────────────────────────────────────────────────────────────
const Orb = ({ style, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.6 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ duration: 1.8, delay, ease: 'easeOut' }}
    style={{
      position: 'absolute',
      borderRadius: '50%',
      filter: 'blur(80px)',
      pointerEvents: 'none',
      ...style,
    }}
  />
);

// ── Grid lines backdrop ───────────────────────────────────────────────────────
const GridLines = () => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 1.2 }}
    style={{
      position: 'absolute', inset: 0, pointerEvents: 'none',
      backgroundImage: `
        linear-gradient(rgba(99,102,241,0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(99,102,241,0.04) 1px, transparent 1px)
      `,
      backgroundSize: '60px 60px',
    }}
  />
);

export default function SplashScreen({ onDone }) {
  const [phase, setPhase]   = useState('in');   // 'in' | 'out'
  const [showBar, setShowBar] = useState(false);

  const exit = useCallback(() => {
    setPhase('out');
    setTimeout(onDone, 600);
  }, [onDone]);

  useEffect(() => {
    const t1 = setTimeout(() => setShowBar(true), 700);
    const t2 = setTimeout(exit, 2600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [exit]);

  const fullText  = 'Welcome to MultiTool Hub';
  const letterDelay = 0.04;

  return (
    <AnimatePresence>
      {phase === 'in' && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.04 }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#07070f',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Background orbs */}
          <Orb delay={0}   style={{ width: 600, height: 600, top: -200, left: -200,   background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)' }} />
          <Orb delay={0.3} style={{ width: 500, height: 500, bottom: -150, right: -150, background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)' }} />
          <Orb delay={0.5} style={{ width: 300, height: 300, top: '40%', right: '20%',  background: 'radial-gradient(circle, rgba(217,70,239,0.08) 0%, transparent 70%)' }} />

          {/* Grid */}
          <GridLines />

          {/* Center content */}
          <div style={{ position: 'relative', textAlign: 'center', zIndex: 1, padding: '0 2rem' }}>

            {/* Logo mark */}
            <motion.div
              initial={{ scale: 0, rotate: -180, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.34, 1.56, 0.64, 1] }}
              style={{
                width: 72, height: 72,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef)',
                borderRadius: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 2rem',
                boxShadow: '0 0 48px rgba(99,102,241,0.5), 0 0 96px rgba(99,102,241,0.2)',
              }}
            >
              {/* MT monogram */}
              <span style={{ color: '#fff', fontWeight: 900, fontSize: '1.6rem', letterSpacing: '-2px', fontFamily: 'system-ui' }}>
                MT
              </span>
            </motion.div>

            {/* Animated text reveal */}
            <div style={{
              fontSize: 'clamp(2rem, 6vw, 3.5rem)',
              fontWeight: 800,
              letterSpacing: '-1.5px',
              lineHeight: 1.1,
              marginBottom: '1rem',
              fontFamily: "'Outfit', system-ui, sans-serif",
            }}>
              {fullText.split('').map((char, i) => {
                // Color the "MultiTool Hub" part
                const prefix    = 'Welcome to ';
                const isColored = i >= prefix.length;
                return (
                  <Letter
                    key={i}
                    char={char}
                    delay={0.4 + i * letterDelay}
                  />
                );
              })}
            </div>

            {/* Color overlay on brand words via a second pass */}
            <div style={{
              position: 'absolute', top: 72 + 32, left: 0, right: 0,
              fontSize: 'clamp(2rem, 6vw, 3.5rem)',
              fontWeight: 800,
              letterSpacing: '-1.5px',
              lineHeight: 1.1,
              marginBottom: '1rem',
              fontFamily: "'Outfit', system-ui, sans-serif",
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6, #d946ef)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              pointerEvents: 'none',
              userSelect: 'none',
            }}>
              {'Welcome to '.split('').map((char, i) => (
                <span key={i} style={{ display: 'inline-block', WebkitTextFillColor: 'transparent' }}>
                  {char === ' ' ? ' ' : char}
                </span>
              ))}
              {'MultiTool Hub'.split('').map((char, i) => {
                const globalIdx = 'Welcome to '.length + i;
                return (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.01, delay: 0.4 + globalIdx * letterDelay }}
                    style={{ display: 'inline-block', whiteSpace: char === ' ' ? 'pre' : 'normal' }}
                  >
                    {char === ' ' ? ' ' : char}
                  </motion.span>
                );
              })}
            </div>

            {/* Tagline */}
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.4, ease: 'easeOut' }}
              style={{
                color: 'rgba(148,163,184,0.8)',
                fontSize: 'clamp(0.9rem, 2.5vw, 1.05rem)',
                margin: '0.5rem auto 0',
                marginTop: '3.5rem',
                letterSpacing: '0.01em',
                maxWidth: 380,
              }}
            >
              50+ tools · AI powered · Free forever
            </motion.p>

            {/* Dots */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6, duration: 0.4 }}
              style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '2.5rem' }}
            >
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }}
                />
              ))}
            </motion.div>
          </div>

          {/* Bottom progress bar */}
          <AnimatePresence>
            {showBar && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
                  background: 'rgba(255,255,255,0.04)',
                }}
              >
                <motion.div
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 1.9, ease: [0.4, 0, 0.2, 1] }}
                  style={{
                    height: '100%',
                    background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #d946ef)',
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skip button */}
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            onClick={exit}
            style={{
              position: 'absolute', top: '1.5rem', right: '1.5rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(148,163,184,0.7)',
              padding: '0.35rem 0.85rem',
              borderRadius: 99, fontSize: '0.78rem', fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
          >
            Skip
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
