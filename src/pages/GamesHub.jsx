import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Search, X, Maximize2, Gamepad2, Zap, Brain, Car, Puzzle, Clock, Star, ChevronRight, ExternalLink } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// GAME DATA — CrazyGames /embed/ URLs are officially supported for embedding.
// All games below are free-to-play HTML5 titles that allow iframe embedding.
// ─────────────────────────────────────────────────────────────────────────────
// Helper: bare CrazyGames CDN URL without query params (more reliable)
const cg = (slug) => `https://imgs.crazygames.com/games/${slug}/cover-16x9.png`;

const GAMES = [
  // Brain / Strategy
  {
    id: 1,
    name: 'Bloxorz',
    category: 'brain',
    tags: ['3d', 'logic', 'classic'],
    description: 'Roll a block to the finish hole without falling off.',
    image: cg('bloxorz'),
    url: 'https://www.crazygames.com/embed/bloxorz',
    featured: true,
  },
  {
    id: 2,
    name: '2048',
    category: 'brain',
    tags: ['numbers', 'slide', 'addictive'],
    description: 'Merge tiles to reach the 2048 tile.',
    image: cg('2048-online'),
    url: 'https://www.crazygames.com/embed/2048-online',
    featured: false,
  },
  {
    id: 3,
    name: 'Chess Online',
    category: 'brain',
    tags: ['chess', 'strategy', 'classic'],
    description: 'Play chess against the computer or a friend.',
    image: cg('chess'),
    url: 'https://www.crazygames.com/embed/chess',
    featured: false,
  },
  {
    id: 4,
    name: 'Mahjong Classic',
    category: 'brain',
    tags: ['tiles', 'match', 'relaxing'],
    description: 'Match identical tiles and clear the board.',
    image: cg('mahjong-classic'),
    url: 'https://www.crazygames.com/embed/mahjong-classic',
    featured: false,
  },
  // Racing
  {
    id: 5,
    name: 'Drift Hunters',
    category: 'racing',
    tags: ['cars', 'drift', '3d'],
    description: 'Master the art of drifting in powerful cars.',
    image: cg('drift-hunters'),
    url: 'https://www.crazygames.com/embed/drift-hunters',
    featured: true,
  },
  {
    id: 6,
    name: 'Moto X3M',
    category: 'racing',
    tags: ['bike', 'stunt', 'obstacles'],
    description: 'Perform insane stunts on your motorbike through deadly levels.',
    image: cg('moto-x3m'),
    url: 'https://www.crazygames.com/embed/moto-x3m',
    featured: false,
  },
  {
    id: 7,
    name: 'Road Rush Cars',
    category: 'racing',
    tags: ['endless', 'traffic', 'fast'],
    description: 'Dodge traffic and collect coins in this endless racer.',
    image: cg('road-rush-cars'),
    url: 'https://www.crazygames.com/embed/road-rush-cars',
    featured: false,
  },
  // Arcade
  {
    id: 8,
    name: 'Slope',
    category: 'arcade',
    tags: ['ball', 'reflex', 'speed', 'addictive'],
    description: 'Guide a ball down an endless neon slope at insane speed.',
    image: cg('slope'),
    url: 'https://www.crazygames.com/embed/slope',
    featured: true,
  },
  {
    id: 9,
    name: 'Paper.io 2',
    category: 'arcade',
    tags: ['io', 'territory', 'multiplayer'],
    description: 'Capture territory and outmaneuver rivals on the paper map.',
    image: cg('paperio-2'),
    url: 'https://www.crazygames.com/embed/paperio-2',
    featured: false,
  },
  {
    id: 10,
    name: 'Stickman Hook',
    category: 'arcade',
    tags: ['swing', 'physics', 'fun'],
    description: 'Swing through levels like a stickman Spider-Man.',
    image: cg('stickman-hook'),
    url: 'https://www.crazygames.com/embed/stickman-hook',
    featured: false,
  },
  // Puzzle
  {
    id: 11,
    name: 'Fireboy & Watergirl',
    category: 'puzzle',
    tags: ['coop', '2-player', 'elements'],
    description: 'Guide two heroes through elemental temples together.',
    image: cg('fireboy-and-watergirl-1-the-forest-temple'),
    url: 'https://www.crazygames.com/embed/fireboy-and-watergirl-1-the-forest-temple',
    featured: false,
  },
  {
    id: 12,
    name: 'Cut the Rope',
    category: 'puzzle',
    tags: ['physics', 'candy', 'cute'],
    description: "Feed candy to Om Nom by cutting ropes cleverly.",
    image: cg('cut-the-rope-remastered'),
    url: 'https://www.crazygames.com/embed/cut-the-rope-remastered',
    featured: true,
  },
  {
    id: 13,
    name: 'Bubble Shooter',
    category: 'puzzle',
    tags: ['bubbles', 'match3', 'casual'],
    description: 'Aim and fire colored bubbles to clear the board.',
    image: cg('bubble-shooter'),
    url: 'https://www.crazygames.com/embed/bubble-shooter',
    featured: false,
  },
  // 5-Minute Fun
  {
    id: 14,
    name: 'Wormate.io',
    category: 'quick',
    tags: ['snake', 'io', 'eat', 'multiplayer'],
    description: 'Eat sweets, grow your worm, and dominate the arena.',
    image: cg('wormate-io'),
    url: 'https://www.crazygames.com/embed/wormate-io',
    featured: false,
  },
  {
    id: 15,
    name: 'Tank Stars',
    category: 'quick',
    tags: ['tanks', 'turn-based', 'pvp'],
    description: 'Aim and fire devastating weapons in turn-based tank combat.',
    image: cg('tank-stars'),
    url: 'https://www.crazygames.com/embed/tank-stars',
    featured: false,
  },
  {
    id: 16,
    name: 'Snake io',
    category: 'quick',
    tags: ['snake', 'classic', 'io'],
    description: 'Eat pellets, grow long, and eliminate other snakes.',
    image: cg('snake-io'),
    url: 'https://www.crazygames.com/embed/snake-io',
    featured: false,
  },
];

const CATEGORIES = [
  { id: 'all',    label: 'All Games',        icon: Gamepad2 },
  { id: 'brain',  label: 'Train Your Brain', icon: Brain },
  { id: 'arcade', label: 'Arcade',           icon: Zap },
  { id: 'quick',  label: '5-Minute Fun',     icon: Clock },
  { id: 'racing', label: 'Racing',           icon: Car },
  { id: 'puzzle', label: 'Puzzle',           icon: Puzzle },
];

const CAT_GRADIENTS = {
  brain:  'linear-gradient(135deg, #312e81 0%, #4f46e5 100%)',
  arcade: 'linear-gradient(135deg, #064e3b 0%, #10b981 100%)',
  quick:  'linear-gradient(135deg, #78350f 0%, #f59e0b 100%)',
  racing: 'linear-gradient(135deg, #7f1d1d 0%, #ef4444 100%)',
  puzzle: 'linear-gradient(135deg, #4c1d95 0%, #8b5cf6 100%)',
};

// ─── Game Card ───────────────────────────────────────────────────────────────
function GameCard({ game, onPlay }) {
  const [imgState, setImgState] = useState('loading'); // 'loading' | 'loaded' | 'error'
  const categoryColors = {
    brain:  { bg: 'rgba(99,102,241,0.15)', text: '#a5b4fc' },
    arcade: { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7' },
    quick:  { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d' },
    racing: { bg: 'rgba(239,68,68,0.15)',  text: '#fca5a5' },
    puzzle: { bg: 'rgba(139,92,246,0.15)', text: '#c4b5fd' },
  };
  const col = categoryColors[game.category] || { bg: 'rgba(255,255,255,0.08)', text: '#94a3b8' };
  const catLabel = CATEGORIES.find(c => c.id === game.category)?.label || game.category;
  const gradient = CAT_GRADIENTS[game.category] || 'linear-gradient(135deg, #1e293b 0%, #334155 100%)';
  // Initials from game name for the fallback card
  const initials = game.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <div className="gh-card" onClick={() => onPlay(game)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onPlay(game)}>
      <div className="gh-card-img-wrap">
        {game.featured && <span className="gh-featured-badge"><Star size={10} fill="currentColor" /> Featured</span>}

        {/* Gradient fallback — always rendered, hidden when image loads */}
        <div
          className="gh-card-img-fallback"
          style={{
            background: gradient,
            opacity: imgState === 'loaded' ? 0 : 1,
            transition: 'opacity 0.3s',
          }}
        >
          <span style={{ fontSize: '2rem', fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: '-0.02em' }}>{initials}</span>
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem', textAlign: 'center', padding: '0 0.5rem' }}>{game.name}</span>
          <Gamepad2 size={18} style={{ position: 'absolute', bottom: 8, right: 8, opacity: 0.25 }} />
        </div>

        {/* Real image — hidden on error, fades in on load */}
        <img
          src={game.image}
          alt={game.name}
          loading="lazy"
          onLoad={() => setImgState('loaded')}
          onError={() => setImgState('error')}
          className="gh-card-img"
          style={{ opacity: imgState === 'loaded' ? 1 : 0, transition: 'opacity 0.4s' }}
        />

        <div className="gh-card-overlay">
          <button className="gh-play-btn">▶ Play</button>
        </div>
      </div>
      <div className="gh-card-info">
        <p className="gh-card-title">{game.name}</p>
        <span className="gh-card-cat" style={{ background: col.bg, color: col.text }}>{catLabel}</span>
      </div>
    </div>
  );
}

// ─── Game Player Modal ───────────────────────────────────────────────────────
function GamePlayer({ game, onClose }) {
  const [iframeKey, setIframeKey] = useState(0);
  const [iframeVisible, setIframeVisible] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const timeoutRef = useRef(null);

  // Derive full CrazyGames page URL from embed URL for fallback
  const slug = game.url.split('/embed/')[1] || '';
  const crazygamesUrl = slug
    ? `https://www.crazygames.com/game/${slug}`
    : game.url;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onClose]);

  // Reset state when game changes or iframe is retried
  useEffect(() => {
    setIframeVisible(false);
    setTimedOut(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    // 12-second timeout: if onLoad hasn't fired, show fallback
    timeoutRef.current = setTimeout(() => setTimedOut(true), 12000);
    return () => clearTimeout(timeoutRef.current);
  }, [iframeKey, game.url]);

  const handleLoad = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIframeVisible(true);
  };

  const handleRetry = () => {
    setIframeKey(k => k + 1);
  };

  return (
    <div className="gh-modal-overlay" onClick={onClose}>
      <div className="gh-modal" onClick={e => e.stopPropagation()}>
        {/* Modal header */}
        <div className="gh-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Gamepad2 size={18} style={{ color: '#6366f1' }} />
            <span className="gh-modal-title">{game.name}</span>
            <span className="gh-modal-desc">{game.description}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <a
              href={crazygamesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gh-modal-ext-link"
              title="Open on CrazyGames"
              onClick={e => e.stopPropagation()}
            >
              <ExternalLink size={15} /> Open on CrazyGames
            </a>
            <button className="gh-modal-close" onClick={onClose} title="Close (Esc)">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Iframe / Fallback */}
        <div className="gh-iframe-wrap">
          {/* Loading spinner — shown while iframe loads */}
          {!iframeVisible && !timedOut && (
            <div className="gh-loader">
              <div className="gh-spinner" />
              <p>Loading {game.name}…</p>
            </div>
          )}

          {/* Timeout / hard fallback */}
          {timedOut && !iframeVisible && (
            <div className="gh-fallback">
              <div className="gh-fallback-icon">⚠️</div>
              <p className="gh-fallback-title">This game may not support embedding</p>
              <p className="gh-fallback-sub">Some games require being played on the original site.</p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                <a
                  href={crazygamesUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gh-fallback-btn-primary"
                >
                  <ExternalLink size={15} /> Play on CrazyGames
                </a>
                <button className="gh-fallback-btn-secondary" onClick={handleRetry}>
                  ↩ Try Again
                </button>
              </div>
            </div>
          )}

          <iframe
            key={iframeKey}
            src={game.url}
            title={game.name}
            className="gh-iframe"
            style={{ opacity: iframeVisible ? 1 : 0 }}
            onLoad={handleLoad}
            allow="fullscreen; autoplay; gamepad; camera; microphone; encrypted-media; picture-in-picture; storage-access"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        <div className="gh-modal-footer">
          Press <kbd>Esc</kbd> to close
          {iframeVisible && (
            <span style={{ marginLeft: '1rem', opacity: 0.6 }}>
              Having trouble?{' '}
              <a href={crazygamesUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1' }}>
                Play on CrazyGames ↗
              </a>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function GamesHub() {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [activeGame, setActiveGame] = useState(null);
  const catBarRef = useRef(null);

  const filtered = useMemo(() => {
    return GAMES.filter(g => {
      const matchCat = category === 'all' || g.category === category;
      const matchQ = !query || g.name.toLowerCase().includes(query.toLowerCase()) || g.tags.some(t => t.includes(query.toLowerCase()));
      return matchCat && matchQ;
    });
  }, [category, query]);

  const featured = useMemo(() => GAMES.filter(g => g.featured), []);

  const handlePlay = useCallback((game) => setActiveGame(game), []);
  const handleClose = useCallback(() => setActiveGame(null), []);

  return (
    <div className="gh-root">
      <style>{`
        /* ── Root ── */
        .gh-root { min-height: 100vh; padding: 2rem 1.5rem 4rem; max-width: 1400px; margin: 0 auto; }

        /* ── Hero Header ── */
        .gh-hero { margin-bottom: 2rem; }
        .gh-hero-title { font-size: clamp(1.6rem, 4vw, 2.4rem); font-weight: 800; letter-spacing: -0.03em; background: linear-gradient(135deg, #6366f1, #a78bfa, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; margin: 0 0 0.4rem; }
        .gh-hero-sub { color: var(--text-secondary, #94a3b8); font-size: 0.95rem; margin: 0; }

        /* ── Featured Strip ── */
        .gh-featured-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-secondary, #64748b); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem; }
        .gh-featured-strip { display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 2rem; scrollbar-width: thin; }
        .gh-featured-strip::-webkit-scrollbar { height: 4px; }
        .gh-featured-strip::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .gh-featured-card { flex-shrink: 0; width: 220px; border-radius: 14px; overflow: hidden; cursor: pointer; position: relative; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .gh-featured-card:hover { transform: translateY(-4px) scale(1.02); box-shadow: 0 16px 40px rgba(99,102,241,0.25); }
        .gh-featured-card img { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
        .gh-featured-card-info { padding: 0.6rem 0.75rem; }
        .gh-featured-card-name { font-weight: 600; font-size: 0.88rem; }
        .gh-featured-play { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.45); opacity: 0; transition: opacity 0.2s; }
        .gh-featured-card:hover .gh-featured-play { opacity: 1; }
        .gh-featured-play-btn { background: #6366f1; color: white; border: none; padding: 0.5rem 1.2rem; border-radius: 999px; font-weight: 700; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; }

        /* ── Toolbar (search + categories) ── */
        .gh-toolbar { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.75rem; }
        .gh-search-wrap { position: relative; max-width: 360px; }
        .gh-search { width: 100%; padding: 0.65rem 0.85rem 0.65rem 2.4rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; color: var(--text-primary, #e2e8f0); font-size: 0.9rem; outline: none; transition: border-color 0.2s; }
        .gh-search:focus { border-color: #6366f1; background: rgba(99,102,241,0.06); }
        .gh-search::placeholder { color: #475569; }
        .gh-search-icon { position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); color: #475569; pointer-events: none; }
        .gh-search-clear { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #475569; cursor: pointer; padding: 0; display: flex; }
        .gh-search-clear:hover { color: #94a3b8; }

        /* ── Category Bar ── */
        .gh-cats { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.4rem; scrollbar-width: none; }
        .gh-cats::-webkit-scrollbar { display: none; }
        .gh-cat-btn { flex-shrink: 0; display: flex; align-items: center; gap: 0.4rem; padding: 0.45rem 1rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #94a3b8; font-size: 0.82rem; font-weight: 500; cursor: pointer; transition: all 0.2s; white-space: nowrap; }
        .gh-cat-btn:hover { background: rgba(255,255,255,0.08); color: #e2e8f0; border-color: rgba(255,255,255,0.2); }
        .gh-cat-btn.active { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border-color: transparent; box-shadow: 0 4px 14px rgba(99,102,241,0.4); }

        /* ── Grid ── */
        .gh-count { font-size: 0.8rem; color: var(--text-secondary, #64748b); margin-bottom: 1rem; }
        .gh-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1.1rem; }

        /* ── Game Card ── */
        .gh-card { border-radius: 14px; overflow: hidden; cursor: pointer; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s; outline: none; }
        .gh-card:hover, .gh-card:focus-visible { transform: translateY(-5px) scale(1.02); box-shadow: 0 12px 36px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.3); border-color: rgba(99,102,241,0.35); }
        .gh-card-img-wrap { position: relative; aspect-ratio: 16/9; overflow: hidden; background: #0a0a14; }
        .gh-card-img-fallback { position: absolute; inset: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .gh-card-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease, opacity 0.4s; }
        .gh-card:hover .gh-card-img { transform: scale(1.06); }
        .gh-card-overlay { position: absolute; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }
        .gh-card:hover .gh-card-overlay { opacity: 1; }
        .gh-play-btn { background: rgba(99,102,241,0.9); backdrop-filter: blur(4px); color: white; border: none; padding: 0.45rem 1.1rem; border-radius: 999px; font-weight: 700; font-size: 0.82rem; cursor: pointer; letter-spacing: 0.02em; transition: background 0.15s; }
        .gh-play-btn:hover { background: #6366f1; }
        .gh-featured-badge { position: absolute; top: 6px; left: 6px; background: rgba(245,158,11,0.9); color: #0a0a0f; font-size: 0.66rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 999px; display: flex; align-items: center; gap: 0.3rem; z-index: 1; }
        .gh-card-info { padding: 0.6rem 0.75rem 0.75rem; }
        .gh-card-title { font-weight: 600; font-size: 0.85rem; margin: 0 0 0.35rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gh-card-cat { font-size: 0.7rem; font-weight: 600; padding: 0.18rem 0.5rem; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.04em; }

        /* ── Empty State ── */
        .gh-empty { text-align: center; padding: 4rem 2rem; color: #475569; }
        .gh-empty svg { margin-bottom: 1rem; }
        .gh-empty p { font-size: 0.95rem; }

        /* ── Modal ── */
        .gh-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; backdrop-filter: blur(6px); animation: ghFadeIn 0.2s ease-out; }
        @keyframes ghFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .gh-modal { width: 100%; max-width: 1100px; height: 90vh; display: flex; flex-direction: column; background: #0d0d16; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; overflow: hidden; animation: ghSlideUp 0.25s ease-out; box-shadow: 0 40px 80px rgba(0,0,0,0.8); }
        @keyframes ghSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .gh-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; background: #12121e; border-bottom: 1px solid rgba(255,255,255,0.07); flex-shrink: 0; }
        .gh-modal-title { font-weight: 700; font-size: 0.95rem; }
        .gh-modal-desc { font-size: 0.78rem; color: #64748b; margin-left: 0.25rem; display: none; }
        @media (min-width: 600px) { .gh-modal-desc { display: inline; } }
        .gh-modal-close { background: rgba(255,255,255,0.07); border: none; color: #94a3b8; cursor: pointer; padding: 0.4rem; border-radius: 8px; display: flex; align-items: center; transition: background 0.15s, color 0.15s; }
        .gh-modal-close:hover { background: rgba(239,68,68,0.15); color: #f87171; }
        .gh-iframe-wrap { flex: 1; position: relative; overflow: hidden; background: #000; }
        .gh-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; transition: opacity 0.3s; }
        .gh-loader { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: #64748b; font-size: 0.9rem; }
        .gh-spinner { width: 40px; height: 40px; border: 3px solid rgba(99,102,241,0.2); border-top-color: #6366f1; border-radius: 50%; animation: ghSpin 0.8s linear infinite; }
        @keyframes ghSpin { to { transform: rotate(360deg); } }
        .gh-modal-footer { padding: 0.4rem 1.25rem; background: #0a0a12; border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.72rem; color: #334155; text-align: center; flex-shrink: 0; }
        .gh-modal-footer kbd { background: rgba(255,255,255,0.07); padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.7rem; }
        .gh-modal-ext-link { display: flex; align-items: center; gap: 0.3rem; padding: 0.3rem 0.7rem; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #94a3b8; font-size: 0.75rem; text-decoration: none; transition: background 0.15s, color 0.15s; white-space: nowrap; }
        .gh-modal-ext-link:hover { background: rgba(99,102,241,0.15); color: #a5b4fc; border-color: rgba(99,102,241,0.3); }
        .gh-fallback { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 2rem; text-align: center; background: #07070e; z-index: 2; }
        .gh-fallback-icon { font-size: 2.5rem; }
        .gh-fallback-title { font-weight: 600; font-size: 1rem; color: #e2e8f0; margin: 0; }
        .gh-fallback-sub { font-size: 0.85rem; color: #64748b; margin: 0; }
        .gh-fallback-btn-primary { display: inline-flex; align-items: center; gap: 0.4rem; background: #6366f1; color: white; border: none; padding: 0.6rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.875rem; cursor: pointer; text-decoration: none; transition: background 0.15s; }
        .gh-fallback-btn-primary:hover { background: #4f46e5; }
        .gh-fallback-btn-secondary { display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(255,255,255,0.07); color: #94a3b8; border: 1px solid rgba(255,255,255,0.1); padding: 0.6rem 1.25rem; border-radius: 8px; font-weight: 500; font-size: 0.875rem; cursor: pointer; transition: background 0.15s; }
        .gh-fallback-btn-secondary:hover { background: rgba(255,255,255,0.12); color: #e2e8f0; }

        /* ── Responsive ── */
        @media (max-width: 600px) {
          .gh-root { padding: 1rem 0.75rem 5rem; }
          .gh-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; }
          .gh-modal { height: 95vh; border-radius: 16px 16px 0 0; }
          .gh-modal-overlay { align-items: flex-end; padding: 0; }
        }
      `}</style>

      {/* Hero */}
      <div className="gh-hero">
        <h1 className="gh-hero-title">🎮 Games Hub</h1>
        <p className="gh-hero-sub">Play {GAMES.length} free browser games — no downloads, no installs</p>
      </div>

      {/* Featured Strip */}
      <p className="gh-featured-label"><Star size={12} fill="currentColor" style={{ color: '#f59e0b' }} /> Featured Games</p>
      <div className="gh-featured-strip">
        {featured.map(game => (
          <div key={game.id} className="gh-featured-card" onClick={() => handlePlay(game)}>
            <img src={game.image} alt={game.name} loading="lazy" />
            <div className="gh-featured-play">
              <button className="gh-featured-play-btn"><ChevronRight size={16} /> Play</button>
            </div>
            <div className="gh-featured-card-info">
              <p className="gh-featured-card-name">{game.name}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="gh-toolbar">
        <div className="gh-search-wrap">
          <Search size={16} className="gh-search-icon" />
          <input
            className="gh-search"
            placeholder="Search games…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button className="gh-search-clear" onClick={() => setQuery('')}>
              <X size={15} />
            </button>
          )}
        </div>

        <div className="gh-cats" ref={catBarRef}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`gh-cat-btn${category === cat.id ? ' active' : ''}`}
              onClick={() => setCategory(cat.id)}
            >
              <cat.icon size={14} />
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <p className="gh-count">{filtered.length} game{filtered.length !== 1 ? 's' : ''}</p>

      {filtered.length === 0 ? (
        <div className="gh-empty">
          <Gamepad2 size={48} />
          <p>No games match "<strong>{query}</strong>" in this category.</p>
        </div>
      ) : (
        <div className="gh-grid">
          {filtered.map(game => (
            <GameCard key={game.id} game={game} onPlay={handlePlay} />
          ))}
        </div>
      )}

      {/* Player Modal */}
      {activeGame && <GamePlayer game={activeGame} onClose={handleClose} />}
    </div>
  );
}
