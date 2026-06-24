import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, ChevronLeft, ExternalLink, Gamepad2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GAMES = [
  {
    id: 'bloxorz',
    provider: 'CrazyGames',
    name: 'Bloxorz',
    description: 'Roll a block to the finish hole without falling off.',
    image: 'https://imgs.crazygames.com/games/bloxorz/cover-16x9.png',
    url: 'https://www.crazygames.com/embed/bloxorz',
    externalUrl: 'https://www.crazygames.com/game/bloxorz',
    actionLabel: 'Open on CrazyGames',
  },
  {
    id: 'gamezop',
    provider: 'Gamezop',
    name: 'Gamezop Arcade',
    description: 'Play the new embedded Gamezop browser game.',
    image: null,
    url: '/games/gamezop/',
    externalUrl: 'https://zv1y2i8p.play.gamezop.com/g/SkhljT2fdgb',
    actionLabel: 'Open on Gamezop',
  },
];

function GamePlayer({ game, onClose }) {
  const [gameMode, setGameMode] = useState('loading');
  const [iframeKey, setIframeKey] = useState(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const handler = (event) => {
      if (event.key === 'Escape') onClose();
    };

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
      setGameMode((mode) => (mode === 'loading' ? 'fallback' : mode));
    }, 15000);

    return () => clearTimeout(timeoutRef.current);
  }, [iframeKey, game.url]);

  return (
    <div className="gh-overlay" onClick={onClose}>
      <div className="gh-modal" onClick={(event) => event.stopPropagation()}>
        <div className="gh-modal-header">
          <div className="gh-modal-heading">
            <Gamepad2 size={17} className="gh-modal-icon" />
            <span className="gh-modal-title">{game.name}</span>
            <span className="gh-modal-desc">{game.description}</span>
          </div>
          <div className="gh-modal-actions">
            <a
              href={game.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gh-ext-link"
              onClick={(event) => event.stopPropagation()}
            >
              <ExternalLink size={14} /> {game.actionLabel}
            </a>
            <button className="gh-close" onClick={onClose} title="Close (Esc)">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="gh-iframe-wrap">
          {gameMode === 'loading' && (
            <div className="gh-loader">
              <div className="gh-spinner" />
              <p>Preparing your session...</p>
              <p className="gh-loader-sub">This may take a few seconds depending on network speed.</p>
            </div>
          )}

          {gameMode === 'fallback' && (
            <div className="gh-fallback">
              <AlertCircle size={38} />
              <p className="gh-fallback-title">Game cannot be loaded inside the app</p>
              <p className="gh-fallback-sub">Play it directly on {game.provider} instead.</p>
              <div className="gh-fallback-actions">
                <a href={game.externalUrl} target="_blank" rel="noopener noreferrer" className="gh-btn-primary">
                  <ExternalLink size={14} /> Play on {game.provider}
                </a>
                <button className="gh-btn-secondary" onClick={() => setIframeKey((key) => key + 1)}>
                  Try Again
                </button>
              </div>
            </div>
          )}

          <iframe
            key={iframeKey}
            src={game.url}
            title={game.name}
            className="gh-iframe"
            style={{
              opacity: gameMode === 'iframe' ? 1 : 0,
              pointerEvents: gameMode === 'iframe' ? 'auto' : 'none',
            }}
            onLoad={() => {
              clearTimeout(timeoutRef.current);
              setGameMode('iframe');
            }}
            onError={() => {
              clearTimeout(timeoutRef.current);
              setGameMode('fallback');
            }}
            allow="fullscreen; autoplay; gamepad; camera; microphone; encrypted-media; picture-in-picture; storage-access"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="gh-footer">
          Press <kbd>Esc</kbd> to close
          {gameMode === 'iframe' && (
            <span className="gh-footer-help">
              Having trouble?{' '}
              <a href={game.externalUrl} target="_blank" rel="noopener noreferrer">
                Play on {game.provider}
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GamesHub() {
  const navigate = useNavigate();
  const [activeGame, setActiveGame] = useState(null);
  const [loadedImages, setLoadedImages] = useState({});

  return (
    <div className="gh-root">
      <style>{`
        .gh-root {
          min-height: 100vh;
          padding: 2.5rem 1.5rem 5rem;
          max-width: 980px;
          margin: 0 auto;
          position: relative;
        }

        .gh-back-btn {
          position: absolute;
          top: 1.5rem;
          left: 1.5rem;
          background: transparent;
          border: none;
          color: var(--text-secondary, #94a3b8);
          cursor: pointer;
          padding: 0.5rem;
          border-radius: 8px;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .gh-back-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: var(--text-primary, #e2e8f0);
          transform: translateX(-2px);
        }

        .gh-hero-title {
          font-size: 2rem;
          font-weight: 800;
          letter-spacing: 0;
          background: linear-gradient(135deg, #6366f1, #14b8a6, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin: 0 0 0.4rem;
        }

        .gh-hero-sub {
          color: var(--text-secondary, #94a3b8);
          font-size: 0.95rem;
          margin: 0 0 2rem;
        }

        .gh-dev-notice {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.85rem 1rem;
          margin-bottom: 2rem;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 8px;
          color: #f59e0b;
          font-size: 0.85rem;
          line-height: 1.5;
        }

        .gh-dev-notice svg {
          flex-shrink: 0;
        }

        .gh-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 1rem;
          align-items: start;
        }

        .gh-card {
          overflow: hidden;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .gh-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 20px 50px rgba(20, 184, 166, 0.14);
        }

        .gh-card-img-wrap {
          position: relative;
          aspect-ratio: 16 / 9;
          background: #0a0a14;
          cursor: pointer;
        }

        .gh-card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: opacity 0.25s ease;
        }

        .gh-card-art {
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.55rem;
          background: #111827;
          color: #a5b4fc;
        }

        .gh-card-art span {
          color: #cbd5e1;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .gh-card-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .gh-card-img-wrap:hover .gh-card-overlay {
          opacity: 1;
        }

        .gh-play-btn {
          background: #6366f1;
          color: white;
          border: none;
          padding: 0.6rem 1.6rem;
          border-radius: 999px;
          font-weight: 700;
          font-size: 1rem;
          cursor: pointer;
        }

        .gh-card-body {
          padding: 1rem 1.25rem 1.25rem;
        }

        .gh-card-name {
          font-size: 1.1rem;
          font-weight: 700;
          margin: 0 0 0.3rem;
        }

        .gh-card-desc {
          min-height: 2.5rem;
          font-size: 0.85rem;
          color: #64748b;
          margin: 0 0 1rem;
          line-height: 1.45;
        }

        .gh-play-full-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: #6366f1;
          color: white;
          border: none;
          padding: 0.55rem 1.1rem;
          border-radius: 8px;
          font-weight: 600;
          font-size: 0.9rem;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .gh-play-full-btn:hover {
          background: #4f46e5;
        }

        .gh-coming-soon {
          margin-top: 2rem;
          padding: 1.25rem;
          border-radius: 8px;
          background: rgba(20, 184, 166, 0.05);
          border: 1px dashed rgba(20, 184, 166, 0.25);
          text-align: center;
        }

        .gh-coming-soon-title {
          font-size: 0.95rem;
          font-weight: 700;
          color: #99f6e4;
          margin: 0 0 0.3rem;
        }

        .gh-coming-soon-sub {
          font-size: 0.82rem;
          color: #64748b;
          margin: 0;
        }

        .gh-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.88);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          backdrop-filter: blur(6px);
          animation: ghFade 0.2s ease-out;
        }

        @keyframes ghFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .gh-modal {
          width: 100%;
          max-width: 1100px;
          height: 90vh;
          display: flex;
          flex-direction: column;
          background: #0d0d16;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          overflow: hidden;
          animation: ghUp 0.22s ease-out;
          box-shadow: 0 40px 80px rgba(0, 0, 0, 0.8);
        }

        @keyframes ghUp {
          from { transform: translateY(16px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .gh-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1.25rem;
          background: #12121e;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          flex-shrink: 0;
          gap: 0.5rem;
        }

        .gh-modal-heading,
        .gh-modal-actions,
        .gh-fallback-actions {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }

        .gh-modal-icon {
          color: #14b8a6;
        }

        .gh-modal-title {
          font-weight: 700;
          font-size: 0.95rem;
        }

        .gh-modal-desc {
          font-size: 0.78rem;
          color: #64748b;
          display: none;
        }

        .gh-ext-link {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.3rem 0.7rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          color: #94a3b8;
          font-size: 0.75rem;
          text-decoration: none;
          white-space: nowrap;
          transition: background 0.15s ease;
        }

        .gh-ext-link:hover {
          background: rgba(20, 184, 166, 0.14);
          color: #99f6e4;
        }

        .gh-close {
          background: rgba(255, 255, 255, 0.07);
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 0.4rem;
          border-radius: 8px;
          display: flex;
          transition: background 0.15s ease;
        }

        .gh-close:hover {
          background: rgba(239, 68, 68, 0.15);
          color: #f87171;
        }

        .gh-iframe-wrap {
          flex: 1;
          position: relative;
          overflow: hidden;
          background: #000;
        }

        .gh-iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: none;
          transition: opacity 0.3s ease;
        }

        .gh-loader {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          color: #64748b;
          font-size: 0.9rem;
          z-index: 1;
        }

        .gh-loader p {
          margin: 0;
        }

        .gh-loader-sub {
          font-size: 0.75rem;
          color: #475569;
        }

        .gh-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(99, 102, 241, 0.2);
          border-top-color: #14b8a6;
          border-radius: 50%;
          animation: ghSpin 0.8s linear infinite;
        }

        @keyframes ghSpin {
          to { transform: rotate(360deg); }
        }

        .gh-fallback {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          padding: 2rem;
          text-align: center;
          background: #07070e;
          color: #f59e0b;
          z-index: 2;
        }

        .gh-fallback-title {
          font-weight: 600;
          font-size: 1rem;
          color: #e2e8f0;
          margin: 0;
        }

        .gh-fallback-sub {
          font-size: 0.85rem;
          color: #64748b;
          margin: 0;
        }

        .gh-btn-primary,
        .gh-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 1.1rem;
          border-radius: 8px;
          font-size: 0.875rem;
          cursor: pointer;
          text-decoration: none;
        }

        .gh-btn-primary {
          background: #6366f1;
          color: white;
          border: none;
          font-weight: 600;
        }

        .gh-btn-primary:hover {
          background: #4f46e5;
        }

        .gh-btn-secondary {
          background: rgba(255, 255, 255, 0.07);
          color: #94a3b8;
          border: 1px solid rgba(255, 255, 255, 0.1);
          font-weight: 500;
          transition: background 0.15s ease;
        }

        .gh-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #e2e8f0;
        }

        .gh-footer {
          padding: 0.4rem 1.25rem;
          background: #0a0a12;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          font-size: 0.72rem;
          color: #64748b;
          text-align: center;
          flex-shrink: 0;
        }

        .gh-footer kbd {
          background: rgba(255, 255, 255, 0.07);
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
        }

        .gh-footer-help {
          margin-left: 1rem;
          opacity: 0.72;
        }

        .gh-footer a {
          color: #14b8a6;
        }

        @media (min-width: 600px) {
          .gh-modal-desc {
            display: inline;
          }
        }

        @media (max-width: 600px) {
          .gh-root {
            padding: 1.25rem 0.75rem 5rem;
          }

          .gh-hero-title {
            font-size: 1.6rem;
          }

          .gh-modal {
            height: 95vh;
            border-radius: 8px 8px 0 0;
          }

          .gh-overlay {
            align-items: flex-end;
            padding: 0;
          }

          .gh-modal-header {
            align-items: flex-start;
          }

          .gh-modal-actions {
            gap: 0.35rem;
          }
        }
      `}</style>

      <button className="gh-back-btn" onClick={() => navigate(-1)} title="Go back">
        <ChevronLeft size={20} />
      </button>

      <h1 className="gh-hero-title">Games Hub</h1>
      <p className="gh-hero-sub">Free browser games - no downloads, no installs</p>

      <div className="gh-dev-notice">
        <AlertCircle size={16} />
        <span>This feature is under development. Some actions may take longer than expected.</span>
      </div>

      <div className="gh-grid">
        {GAMES.map((game) => (
          <div className="gh-card" key={game.id}>
            <div className="gh-card-img-wrap" onClick={() => setActiveGame(game)}>
              {game.image ? (
                <img
                  src={game.image}
                  alt={game.name}
                  className="gh-card-img"
                  style={{ opacity: loadedImages[game.id] ? 1 : 0 }}
                  onLoad={() => setLoadedImages((images) => ({ ...images, [game.id]: true }))}
                />
              ) : (
                <div className="gh-card-art">
                  <Gamepad2 size={54} />
                  <span>{game.provider}</span>
                </div>
              )}
              <div className="gh-card-overlay">
                <button className="gh-play-btn">Play</button>
              </div>
            </div>
            <div className="gh-card-body">
              <p className="gh-card-name">{game.name}</p>
              <p className="gh-card-desc">{game.description}</p>
              <button className="gh-play-full-btn" onClick={() => setActiveGame(game)}>
                <Gamepad2 size={16} /> Play Now
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="gh-coming-soon">
        <p className="gh-coming-soon-title">More games coming soon</p>
        <p className="gh-coming-soon-sub">We are adding more verified games to the hub. Check back soon!</p>
      </div>

      {activeGame && <GamePlayer game={activeGame} onClose={() => setActiveGame(null)} />}
    </div>
  );
}
