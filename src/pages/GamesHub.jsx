import React, { useState, useEffect, useRef } from 'react';
import { Gamepad2, ExternalLink, X } from 'lucide-react';

const BLOXORZ = {
  name: 'Bloxorz',
  description: 'Roll a block to the finish hole without falling off.',
  image: 'https://imgs.crazygames.com/games/bloxorz/cover-16x9.png',
  url: 'https://www.crazygames.com/embed/bloxorz',
  externalUrl: 'https://www.crazygames.com/game/bloxorz',
};

function GamePlayer({ onClose }) {
  const [gameMode, setGameMode] = useState('loading'); // 'loading' | 'iframe' | 'fallback'
  const [iframeKey, setIframeKey] = useState(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      clearTimeout(timeoutRef.current);
    };
  }, [onClose]);

  useEffect(() => {
    setGameMode('loading');
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setGameMode(m => m === 'loading' ? 'fallback' : m);
    }, 15000);
    return () => clearTimeout(timeoutRef.current);
  }, [iframeKey]);

  return (
    <div className="gh-overlay" onClick={onClose}>
      <div className="gh-modal" onClick={e => e.stopPropagation()}>
        <div className="gh-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Gamepad2 size={17} style={{ color: '#6366f1' }} />
            <span className="gh-modal-title">{BLOXORZ.name}</span>
            <span className="gh-modal-desc">{BLOXORZ.description}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a href={BLOXORZ.externalUrl} target="_blank" rel="noopener noreferrer" className="gh-ext-link" onClick={e => e.stopPropagation()}>
              <ExternalLink size={14} /> Open on CrazyGames
            </a>
            <button className="gh-close" onClick={onClose} title="Close (Esc)"><X size={20} /></button>
          </div>
        </div>

        <div className="gh-iframe-wrap">
          {gameMode === 'loading' && (
            <div className="gh-loader">
              <div className="gh-spinner" />
              <p>Loading Bloxorz…</p>
            </div>
          )}

          {gameMode === 'fallback' && (
            <div className="gh-fallback">
              <div style={{ fontSize: '2.5rem' }}>⚠️</div>
              <p className="gh-fallback-title">Game cannot be loaded inside the app</p>
              <p className="gh-fallback-sub">Play it directly on CrazyGames instead.</p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <a href={BLOXORZ.externalUrl} target="_blank" rel="noopener noreferrer" className="gh-btn-primary">
                  <ExternalLink size={14} /> Play on CrazyGames
                </a>
                <button className="gh-btn-secondary" onClick={() => setIframeKey(k => k + 1)}>↩ Try Again</button>
              </div>
            </div>
          )}

          <iframe
            key={iframeKey}
            src={BLOXORZ.url}
            title={BLOXORZ.name}
            className="gh-iframe"
            style={{ opacity: gameMode === 'iframe' ? 1 : 0, pointerEvents: gameMode === 'iframe' ? 'auto' : 'none' }}
            onLoad={() => { clearTimeout(timeoutRef.current); setGameMode('iframe'); }}
            onError={() => { clearTimeout(timeoutRef.current); setGameMode('fallback'); }}
            allow="fullscreen; autoplay; gamepad; camera; microphone; encrypted-media; picture-in-picture; storage-access"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="gh-footer">
          Press <kbd>Esc</kbd> to close
          {gameMode === 'iframe' && (
            <span style={{ marginLeft: '1rem', opacity: 0.5 }}>
              Having trouble?{' '}
              <a href={BLOXORZ.externalUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>Play on CrazyGames ↗</a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GamesHub() {
  const [playing, setPlaying] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <div className="gh-root">
      <style>{`
        .gh-root { min-height: 100vh; padding: 2.5rem 1.5rem 5rem; max-width: 900px; margin: 0 auto; }

        .gh-hero-title { font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 800; letter-spacing: -0.03em; background: linear-gradient(135deg, #6366f1, #a78bfa, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin: 0 0 0.4rem; }
        .gh-hero-sub { color: var(--text-secondary, #94a3b8); font-size: 0.95rem; margin: 0 0 2.5rem; }

        .gh-card { border-radius: 18px; overflow: hidden; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); max-width: 480px; transition: transform 0.2s, box-shadow 0.2s; }
        .gh-card:hover { transform: translateY(-4px); box-shadow: 0 20px 50px rgba(99,102,241,0.2); }
        .gh-card-img-wrap { position: relative; aspect-ratio: 16/9; background: #0a0a14; cursor: pointer; }
        .gh-card-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: opacity 0.4s; }
        .gh-card-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }
        .gh-card-img-wrap:hover .gh-card-overlay { opacity: 1; }
        .gh-play-btn { background: #6366f1; color: white; border: none; padding: 0.6rem 1.6rem; border-radius: 999px; font-weight: 700; font-size: 1rem; cursor: pointer; }
        .gh-card-body { padding: 1rem 1.25rem 1.25rem; }
        .gh-card-name { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.3rem; }
        .gh-card-desc { font-size: 0.85rem; color: #64748b; margin: 0 0 1rem; }
        .gh-play-full-btn { display: inline-flex; align-items: center; gap: 0.4rem; background: linear-gradient(135deg,#6366f1,#8b5cf6); color: white; border: none; padding: 0.55rem 1.4rem; border-radius: 8px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: opacity 0.15s; }
        .gh-play-full-btn:hover { opacity: 0.88; }

        .gh-coming-soon { margin-top: 3rem; padding: 1.5rem; border-radius: 14px; background: rgba(99,102,241,0.06); border: 1px dashed rgba(99,102,241,0.25); text-align: center; }
        .gh-coming-soon-title { font-size: 0.95rem; font-weight: 700; color: #a5b4fc; margin: 0 0 0.3rem; }
        .gh-coming-soon-sub { font-size: 0.82rem; color: #475569; margin: 0; }

        /* Modal */
        .gh-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(6px); animation: ghFade 0.2s ease-out; }
        @keyframes ghFade { from { opacity: 0; } to { opacity: 1; } }
        .gh-modal { width: 100%; max-width: 1100px; height: 90vh; display: flex; flex-direction: column; background: #0d0d16; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; overflow: hidden; animation: ghUp 0.22s ease-out; box-shadow: 0 40px 80px rgba(0,0,0,0.8); }
        @keyframes ghUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .gh-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; background: #12121e; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; gap: 0.5rem; }
        .gh-modal-title { font-weight: 700; font-size: 0.95rem; }
        .gh-modal-desc { font-size: 0.78rem; color: #64748b; display: none; }
        @media (min-width: 600px) { .gh-modal-desc { display: inline; } }
        .gh-ext-link { display: flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.7rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #94a3b8; font-size: 0.75rem; text-decoration: none; white-space: nowrap; transition: background 0.15s; }
        .gh-ext-link:hover { background: rgba(99,102,241,0.15); color: #a5b4fc; }
        .gh-close { background: rgba(255,255,255,0.07); border: none; color: #94a3b8; cursor: pointer; padding: 0.4rem; border-radius: 8px; display: flex; transition: background 0.15s; }
        .gh-close:hover { background: rgba(239,68,68,0.15); color: #f87171; }
        .gh-iframe-wrap { flex: 1; position: relative; overflow: hidden; background: #000; }
        .gh-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; transition: opacity 0.3s; }
        .gh-loader { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: #64748b; font-size: 0.9rem; z-index: 1; }
        .gh-spinner { width: 40px; height: 40px; border: 3px solid rgba(99,102,241,0.2); border-top-color: #6366f1; border-radius: 50%; animation: ghSpin 0.8s linear infinite; }
        @keyframes ghSpin { to { transform: rotate(360deg); } }
        .gh-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 2rem; text-align: center; background: #07070e; z-index: 2; }
        .gh-fallback-title { font-weight: 600; font-size: 1rem; color: #e2e8f0; margin: 0; }
        .gh-fallback-sub { font-size: 0.85rem; color: #64748b; margin: 0; }
        .gh-btn-primary { display: inline-flex; align-items: center; gap: 0.4rem; background: #6366f1; color: white; border: none; padding: 0.6rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.875rem; cursor: pointer; text-decoration: none; transition: background 0.15s; }
        .gh-btn-primary:hover { background: #4f46e5; }
        .gh-btn-secondary { display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(255,255,255,0.07); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 0.6rem 1.25rem; border-radius: 8px; font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: background 0.15s; }
        .gh-btn-secondary:hover { background: rgba(255,255,255,0.12); color: #e2e8f0; }
        .gh-footer { padding: 0.4rem 1.25rem; background: #0a0a12; border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.72rem; color: #334155; text-align: center; flex-shrink: 0; }
        .gh-footer kbd { background: rgba(255,255,255,0.07); padding: 0.1rem 0.4rem; border-radius: 4px; }

        @media (max-width: 600px) {
          .gh-root { padding: 1.25rem 0.75rem 5rem; }
          .gh-modal { height: 95vh; border-radius: 16px 16px 0 0; }
          .gh-overlay { align-items: flex-end; padding: 0; }
        }
      `}</style>

      <h1 className="gh-hero-title">🎮 Games Hub</h1>
      <p className="gh-hero-sub">Free browser games — no downloads, no installs</p>

      {/* Bloxorz card */}
      <div className="gh-card">
        <div className="gh-card-img-wrap" onClick={() => setPlaying(true)}>
          <img
            src={BLOXORZ.image}
            alt={BLOXORZ.name}
            className="gh-card-img"
            style={{ opacity: imgLoaded ? 1 : 0 }}
            onLoad={() => setImgLoaded(true)}
          />
          <div className="gh-card-overlay">
            <button className="gh-play-btn">▶ Play</button>
          </div>
        </div>
        <div className="gh-card-body">
          <p className="gh-card-name">{BLOXORZ.name}</p>
          <p className="gh-card-desc">{BLOXORZ.description}</p>
          <button className="gh-play-full-btn" onClick={() => setPlaying(true)}>
            <Gamepad2 size={16} /> Play Now
          </button>
        </div>
      </div>

      {/* More games coming soon */}
      <div className="gh-coming-soon">
        <p className="gh-coming-soon-title">🚀 More games coming soon</p>
        <p className="gh-coming-soon-sub">We're adding more verified games to the hub. Check back soon!</p>
      </div>

      {playing && <GamePlayer onClose={() => setPlaying(false)} />}
    </div>
  );
}
