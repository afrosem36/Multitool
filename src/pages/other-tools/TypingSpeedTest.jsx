import React, { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================
// GAME DESIGN BLUEPRINT
// LOOP: Select Mode → Type passage → Score/XP/Combo → End Screen → Replay
// RETENTION: XP bar fills toward next level; streaks feel momentum
// REWARDS: Floating +pts, combo multiplier, power-ups, rank reveal
// TENSION: Lives draining, timer counting, combo about to break
// ============================================================

const PASSAGES = {
  easy: [
    "the cat sat on the mat and watched the sun rise over the hills",
    "she sold sea shells by the shore and smiled at every wave",
    "blue birds fly high above the green fields in summer sky",
  ],
  medium: [
    "programming requires both logic and creativity to solve complex problems efficiently in the modern world",
    "efficient communication is the cornerstone of any successful team working together toward a common goal",
    "the art of writing clean code is similar to crafting poetry where every character matters deeply",
  ],
  hard: [
    "quantum entanglement challenges classical intuition by suggesting particles synchronize across vast cosmological distances instantaneously",
    "distributed systems hinge on robust consensus algorithms facilitating seamless synchronization despite intermittent connectivity and latency",
    "existentialist philosophy reveals profound dichotomies between subjective experience and objective reality requiring meticulous linguistic precision",
  ],
};

const POWERUP_DEFS = {
  slowTime:    { label: 'SLOW TIME',    icon: '⏱',  color: '#00f5ff', desc: 'Freeze timer 5s',    duration: 5000 },
  autoCorrect: { label: 'SHIELD',       icon: '🛡',  color: '#a78bfa', desc: 'Block next error',   duration: null },
  doubleXP:    { label: '2× XP',        icon: '⚡',  color: '#fbbf24', desc: 'Double XP for 8s',   duration: 8000 },
};

const RANKS = [
  { min: 0,   label: 'ROOKIE',    color: '#94a3b8' },
  { min: 300, label: 'TYPIST',    color: '#4ade80' },
  { min: 600, label: 'SWIFT',     color: '#38bdf8' },
  { min: 900, label: 'ACE',       color: '#f59e0b' },
  { min: 1200,label: 'ELITE',     color: '#f87171' },
  { min: 1600,label: 'LEGEND',    color: '#e879f9' },
];

const LEVEL_XP = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 9999];

function getRank(score) {
  return [...RANKS].reverse().find(r => score >= r.min) || RANKS[0];
}
function getLevel(xp) {
  for (let i = LEVEL_XP.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_XP[i]) return i + 1;
  }
  return 1;
}
function xpForNext(xp) {
  const lvl = getLevel(xp);
  const curr = LEVEL_XP[lvl - 1] || 0;
  const next = LEVEL_XP[lvl] || LEVEL_XP[LEVEL_XP.length - 1];
  return { curr, next, pct: Math.min(((xp - curr) / (next - curr)) * 100, 100) };
}

// Minimal Web Audio beeps
function createBeep(freq, dur, vol = 0.08, type = 'sine') {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = freq;
    o.type = type;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch {}
}

// ============================================================
export default function TypingSpeedTest() {
  // GAME STATE
  const [screen, setScreen] = useState('menu'); // menu | game | end
  const [mode, setMode] = useState(null); // speedRush | accuracy | survival
  const [difficulty, setDifficulty] = useState('medium');
  const [passage, setPassage] = useState('');
  const [userInput, setUserInput] = useState('');

  // TIMER
  const [startTime, setStartTime] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [timerFrozen, setTimerFrozen] = useState(false);
  const timerRef = useRef(null);

  // STATS
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [errors, setErrors] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);

  // LIVES
  const [lives, setLives] = useState(3);
  const maxLives = 3;

  // XP / LEVEL
  const [xp, setXp] = useState(0);

  // POWER-UPS
  const [powerups, setPowerups] = useState({ slowTime: 1, autoCorrect: 1, doubleXP: 1 });
  const [activeEffects, setActiveEffects] = useState({});
  const shieldRef = useRef(false);
  const doubleXpRef = useRef(false);

  // FEEDBACK
  const [shakeActive, setShakeActive] = useState(false);
  const [floaters, setFloaters] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [comboFlash, setComboFlash] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [charStates, setCharStates] = useState([]);

  // SPEED RUSH countdown
  const SPEED_RUSH_TIME = 30;
  const [timeLeft, setTimeLeft] = useState(SPEED_RUSH_TIME);

  const inputRef = useRef(null);
  const floatId = useRef(0);
  const achieveId = useRef(0);

  // ─── HELPERS ───────────────────────────────────────────────
  const spawnFloat = useCallback((text, color = '#fbbf24', x = 50, y = 40) => {
    const id = floatId.current++;
    setFloaters(f => [...f, { id, text, color, x, y }]);
    setTimeout(() => setFloaters(f => f.filter(fl => fl.id !== id)), 1200);
  }, []);

  const spawnAchieve = useCallback((text) => {
    const id = achieveId.current++;
    setAchievements(a => [...a, { id, text }]);
    setTimeout(() => setAchievements(a => a.filter(ac => ac.id !== id)), 2800);
  }, []);

  const doShake = () => { setShakeActive(true); setTimeout(() => setShakeActive(false), 400); };

  const beep = useCallback((type) => {
    if (!soundOn) return;
    if (type === 'key') createBeep(660, 0.06, 0.05);
    if (type === 'error') createBeep(160, 0.25, 0.1, 'sawtooth');
    if (type === 'combo') createBeep(880, 0.12, 0.07);
    if (type === 'powerup') createBeep(1200, 0.3, 0.1);
    if (type === 'complete') createBeep(1047, 0.5, 0.12);
  }, [soundOn]);

  // ─── GAME START ────────────────────────────────────────────
  const startGame = (selectedMode, diff = difficulty) => {
    const list = PASSAGES[diff];
    const p = list[Math.floor(Math.random() * list.length)];
    setPassage(p);
    setUserInput('');
    setStartTime(null);
    setTimeElapsed(0);
    setTimerFrozen(false);
    setWpm(0);
    setAccuracy(100);
    setErrors(0);
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setLives(selectedMode === 'survival' ? 3 : 99);
    setPowerups({ slowTime: 1, autoCorrect: 1, doubleXP: 1 });
    setActiveEffects({});
    shieldRef.current = false;
    doubleXpRef.current = false;
    setCharStates([]);
    setFloaters([]);
    setAchievements([]);
    setTimeLeft(SPEED_RUSH_TIME);
    setMode(selectedMode);
    setDifficulty(diff);
    setScreen('game');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ─── TIMER ─────────────────────────────────────────────────
  useEffect(() => {
    if (!startTime || screen !== 'game') return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!timerFrozen) {
        setTimeElapsed(t => {
          const next = t + 0.1;
          const sec = (Date.now() - startTime) / 1000;
          const w = Math.round((userInput.length / 5) / Math.max(sec / 60, 0.01));
          setWpm(w);
          return next;
        });
        if (mode === 'speedRush') {
          setTimeLeft(t => {
            if (t <= 0.1) { endGame(); return 0; }
            return t - 0.1;
          });
        }
      }
    }, 100);
    return () => clearInterval(timerRef.current);
  }, [startTime, screen, timerFrozen, mode]);

  // ─── INPUT ─────────────────────────────────────────────────
  const handleInput = (e) => {
    const val = e.target.value;
    if (screen !== 'game') return;
    if (val.length > passage.length) return;

    if (!startTime) setStartTime(Date.now());

    const newStates = val.split('').map((ch, i) => ch === passage[i] ? 'correct' : 'wrong');
    setCharStates(newStates);

    const prevLen = userInput.length;
    const currChar = val[val.length - 1];
    const expectedChar = passage[val.length - 1];
    const isCorrect = currChar === expectedChar;
    const isDeleting = val.length < prevLen;

    if (!isDeleting && currChar !== undefined) {
      if (isCorrect) {
        beep('key');
        const newCombo = combo + 1;
        setCombo(newCombo);
        if (newCombo > maxCombo) setMaxCombo(newCombo);

        // Combo milestones
        if (newCombo > 0 && newCombo % 10 === 0) {
          beep('combo');
          setComboFlash(true);
          setTimeout(() => setComboFlash(false), 500);
          spawnFloat(`🔥 ${newCombo} COMBO!`, '#f59e0b', 50 + Math.random() * 20, 30);
          spawnAchieve(`${newCombo} COMBO STREAK!`);
        }

        // Score points
        const multiplier = doubleXpRef.current ? 2 : 1;
        const comboBonus = Math.floor(newCombo / 5);
        const pts = (10 + comboBonus) * multiplier;
        setScore(s => s + pts);
        if (pts > 10) spawnFloat(`+${pts}`, '#4ade80', 20 + Math.random() * 60, 25 + Math.random() * 30);
      } else {
        // ERROR
        if (shieldRef.current) {
          shieldRef.current = false;
          setActiveEffects(e => { const n = {...e}; delete n.autoCorrect; return n; });
          spawnFloat('🛡 BLOCKED', '#a78bfa', 50, 30);
          // treat as correct visually — replace in state but keep passage intact
          const corrected = val.slice(0, val.length - 1) + expectedChar;
          setUserInput(corrected);
          setCharStates(corrected.split('').map((ch, i) => ch === passage[i] ? 'correct' : 'wrong'));
          return;
        }

        beep('error');
        doShake();
        setCombo(0);
        setErrors(e => e + 1);

        if (mode === 'accuracy') {
          setScore(s => Math.max(0, s - 30));
          spawnFloat('-30', '#f87171', 50, 30);
        }
        if (mode === 'survival') {
          setLives(l => {
            const next = l - 1;
            if (next <= 0) { setTimeout(endGame, 100); }
            return next;
          });
          spawnFloat('💔 LIFE LOST', '#f87171', 50, 25);
        }
      }
    }

    setUserInput(val);

    // Accuracy calc
    const errCnt = val.split('').filter((ch, i) => ch !== passage[i]).length;
    const acc = val.length > 0 ? Math.round(((val.length - errCnt) / val.length) * 100) : 100;
    setAccuracy(acc);

    // COMPLETE
    if (val === passage) {
      beep('complete');
      endGame(val);
    }
  };

  // ─── END GAME ──────────────────────────────────────────────
  const endGame = useCallback((finalInput = userInput) => {
    clearInterval(timerRef.current);
    const elapsed = timeElapsed || 1;
    const finalWpm = Math.round((passage.length / 5) / (elapsed / 60));
    const errCnt = (finalInput || '').split('').filter((ch, i) => ch !== passage[i]).length;
    const finalAcc = finalInput.length > 0 ? Math.round(((finalInput.length - errCnt) / finalInput.length) * 100) : accuracy;

    // Final score calc
    const baseScore = score;
    const accBonus = Math.round(finalAcc * 5);
    const wpmBonus = Math.round(finalWpm * 3);
    const comboBonus2 = maxCombo * 10;
    const totalScore = baseScore + accBonus + wpmBonus + comboBonus2;

    setScore(totalScore);
    setWpm(finalWpm);
    setAccuracy(finalAcc);

    // XP gained
    const xpGained = Math.round(totalScore / 10);
    setXp(x => x + xpGained);

    setScreen('end');
  }, [userInput, timeElapsed, passage, score, accuracy, maxCombo]);

  // ─── POWER-UPS ─────────────────────────────────────────────
  const usePowerup = (type) => {
    if (!powerups[type] || screen !== 'game') return;
    setPowerups(p => ({ ...p, [type]: 0 }));
    beep('powerup');
    spawnFloat(POWERUP_DEFS[type].icon + ' ' + POWERUP_DEFS[type].label, POWERUP_DEFS[type].color, 50, 20);

    if (type === 'slowTime') {
      setTimerFrozen(true);
      setActiveEffects(e => ({ ...e, slowTime: true }));
      setTimeout(() => { setTimerFrozen(false); setActiveEffects(e => { const n = {...e}; delete n.slowTime; return n; }); }, POWERUP_DEFS.slowTime.duration);
    }
    if (type === 'autoCorrect') {
      shieldRef.current = true;
      setActiveEffects(e => ({ ...e, autoCorrect: true }));
    }
    if (type === 'doubleXP') {
      doubleXpRef.current = true;
      setActiveEffects(e => ({ ...e, doubleXP: true }));
      setTimeout(() => { doubleXpRef.current = false; setActiveEffects(e => { const n = {...e}; delete n.doubleXP; return n; }); }, POWERUP_DEFS.doubleXP.duration);
    }
    inputRef.current?.focus();
  };

  // ─── RENDER CHAR-BY-CHAR ───────────────────────────────────
  const renderPassage = () => {
    return passage.split('').map((char, i) => {
      const state = charStates[i];
      const isCursor = i === userInput.length;
      let color = '#4a5568';
      let shadow = 'none';
      let bg = 'transparent';
      if (state === 'correct') { color = '#4ade80'; shadow = '0 0 8px #4ade8088'; }
      if (state === 'wrong')   { color = '#f87171'; shadow = '0 0 8px #f8717188'; bg = 'rgba(248,113,113,0.12)'; }
      return (
        <span
          key={i}
          style={{
            color, textShadow: shadow, background: bg,
            borderBottom: isCursor ? '2px solid #00f5ff' : 'none',
            animation: isCursor ? 'cursorBlink 0.7s infinite' : 'none',
            transition: 'color 0.1s, text-shadow 0.1s',
            fontSize: '1.1rem',
            letterSpacing: '0.06em',
          }}
        >
          {char}
        </span>
      );
    });
  };

  // ─── LIVES ─────────────────────────────────────────────────
  const renderLives = () => {
    if (mode !== 'survival') return null;
    return (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {Array.from({ length: maxLives }).map((_, i) => (
          <span key={i} style={{ fontSize: '1.3rem', filter: i < lives ? 'none' : 'grayscale(1) opacity(0.3)', transition: 'all 0.3s' }}>❤️</span>
        ))}
      </div>
    );
  };

  // ─── LEVEL / XP ────────────────────────────────────────────
  const lvl = getLevel(xp);
  const { curr, next, pct } = xpForNext(xp);

  // ============================================================
  // SCREENS
  // ============================================================

  // ── MENU ──
  if (screen === 'menu') {
    return (
      <div style={styles.root}>
        <style>{css}</style>
        <div style={styles.stars}>{starsBg}</div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 8 }}>⌨️</div>
            <h1 style={styles.title}>TYPE<span style={{ color: '#00f5ff' }}>STRIKE</span></h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem', letterSpacing: 4, textTransform: 'uppercase' }}>Typing · Arcade · Experience</p>
          </div>

          {/* XP Bar */}
          <div style={styles.glassPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: '#00f5ff', fontWeight: 700, fontSize: '0.85rem' }}>LV {lvl}</span>
              <span style={{ color: '#64748b', fontSize: '0.8rem' }}>{xp} / {next} XP</span>
            </div>
            <div style={styles.xpTrack}>
              <div style={{ ...styles.xpFill, width: `${pct}%` }} />
            </div>
          </div>

          {/* Difficulty */}
          <div style={{ ...styles.glassPanel, marginTop: '1.2rem' }}>
            <p style={styles.sectionLabel}>DIFFICULTY</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {['easy','medium','hard'].map(d => (
                <button key={d} onClick={() => setDifficulty(d)} style={{
                  ...styles.chipBtn,
                  ...(difficulty === d ? { background: 'rgba(0,245,255,0.15)', borderColor: '#00f5ff', color: '#00f5ff' } : {})
                }}>{d.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {/* Mode Select */}
          <div style={{ marginTop: '1.2rem' }}>
            <p style={styles.sectionLabel}>SELECT MODE</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
              {[
                { id: 'speedRush', icon: '🚀', name: 'SPEED RUSH', desc: '30-second blitz. Max WPM wins.', accent: '#f59e0b' },
                { id: 'accuracy', icon: '🎯', name: 'PRECISION MODE', desc: 'Every error costs -30pts. Be perfect.', accent: '#4ade80' },
                { id: 'survival', icon: '💀', name: 'SURVIVAL', desc: '3 lives. Errors drain them. Type or die.', accent: '#f87171' },
              ].map(m => (
                <button key={m.id} onClick={() => startGame(m.id)} style={{ ...styles.modeBtn, '--accent': m.accent }}>
                  <span style={{ fontSize: '2rem' }}>{m.icon}</span>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ color: m.accent, fontWeight: 700, letterSpacing: 2, fontSize: '0.9rem' }}>{m.name}</div>
                    <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 2 }}>{m.desc}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', color: m.accent, fontSize: '1.3rem' }}>▶</span>
                </button>
              ))}
            </div>
          </div>

          {/* Sound */}
          <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
            <button onClick={() => setSoundOn(s => !s)} style={styles.ghostBtn}>
              {soundOn ? '🔊 Sound ON' : '🔇 Sound OFF'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── GAME ──
  if (screen === 'game') {
    const progressPct = (userInput.length / passage.length) * 100;
    const timeDisplayPct = mode === 'speedRush' ? (timeLeft / SPEED_RUSH_TIME) * 100 : null;

    return (
      <div style={styles.root}>
        <style>{css}</style>
        <div style={styles.stars}>{starsBg}</div>

        {/* FLOATING SCORE TEXT */}
        {floaters.map(f => (
          <div key={f.id} style={{ ...styles.floater, left: `${f.x}%`, top: `${f.y}%`, color: f.color }}>
            {f.text}
          </div>
        ))}

        {/* ACHIEVEMENT POPUPS */}
        {achievements.map(a => (
          <div key={a.id} style={styles.achieveToast}>{a.text}</div>
        ))}

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 760, margin: '0 auto', padding: '1rem' }}>
          {/* TOP BAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <button onClick={() => setScreen('menu')} style={styles.ghostBtn}>← MENU</button>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              {Object.keys(activeEffects).map(k => (
                <span key={k} style={{ fontSize: '0.75rem', color: POWERUP_DEFS[k]?.color || '#fff', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 20, border: `1px solid ${POWERUP_DEFS[k]?.color}44` }}>
                  {POWERUP_DEFS[k]?.icon} {POWERUP_DEFS[k]?.label}
                </span>
              ))}
            </div>
            <button onClick={() => setSoundOn(s => !s)} style={styles.ghostBtn}>{soundOn ? '🔊' : '🔇'}</button>
          </div>

          {/* STATS STRIP */}
          <div style={styles.statsStrip}>
            <Stat label="WPM" value={wpm} color="#00f5ff" />
            <Stat label="ACC" value={`${accuracy}%`} color="#4ade80" />
            <Stat label="SCORE" value={score} color="#fbbf24" big />
            <Stat label="COMBO" value={`${combo}×`} color={combo >= 10 ? '#f59e0b' : '#94a3b8'} glow={comboFlash} />
            {mode === 'speedRush'
              ? <Stat label="TIME" value={`${Math.ceil(timeLeft)}s`} color={timeLeft < 10 ? '#f87171' : '#e2e8f0'} />
              : <Stat label="TIME" value={`${Math.round(timeElapsed)}s`} color="#e2e8f0" />
            }
          </div>

          {/* LIVES */}
          {mode === 'survival' && (
            <div style={{ textAlign: 'center', margin: '0.5rem 0' }}>{renderLives()}</div>
          )}

          {/* SPEED RUSH TIMER BAR */}
          {mode === 'speedRush' && (
            <div style={styles.timerTrack}>
              <div style={{ ...styles.timerFill, width: `${timeDisplayPct}%`, background: timeLeft < 10 ? '#f87171' : '#00f5ff' }} />
            </div>
          )}

          {/* PASSAGE DISPLAY */}
          <div
            style={{
              ...styles.passageBox,
              animation: shakeActive ? 'shake 0.4s' : 'none',
              boxShadow: combo >= 10 ? `0 0 30px ${comboFlash ? '#f59e0b88' : '#f59e0b33'}` : styles.passageBox.boxShadow,
            }}
          >
            <div style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '1.05rem', lineHeight: 1.9 }}>
              {renderPassage()}
            </div>
          </div>

          {/* PROGRESS BAR */}
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressFill, width: `${progressPct}%` }}>
              <div style={styles.progressGlow} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#475569', marginTop: 3 }}>
            <span>{userInput.length} chars</span>
            <span>{passage.length} total</span>
          </div>

          {/* INPUT */}
          <textarea
            ref={inputRef}
            value={userInput}
            onChange={handleInput}
            placeholder="Start typing…"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            style={styles.textarea}
          />

          {/* POWER-UPS */}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', marginTop: '0.8rem' }}>
            {Object.entries(POWERUP_DEFS).map(([key, def]) => (
              <button
                key={key}
                onClick={() => usePowerup(key)}
                disabled={!powerups[key] || !!activeEffects[key]}
                title={def.desc}
                style={{
                  ...styles.powerupBtn,
                  borderColor: powerups[key] ? def.color : '#1e293b',
                  opacity: powerups[key] && !activeEffects[key] ? 1 : 0.35,
                  boxShadow: activeEffects[key] ? `0 0 12px ${def.color}` : 'none',
                }}
              >
                <span style={{ fontSize: '1.3rem' }}>{def.icon}</span>
                <span style={{ fontSize: '0.65rem', color: def.color, display: 'block', lineHeight: 1.2 }}>{def.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── END SCREEN ──
  if (screen === 'end') {
    const rank = getRank(score);
    const errCnt = userInput.split('').filter((ch, i) => ch !== passage[i]).length;
    const finalAcc = userInput.length > 0 ? Math.round(((userInput.length - errCnt) / userInput.length) * 100) : accuracy;
    const xpGained = Math.round(score / 10);

    return (
      <div style={styles.root}>
        <style>{css}</style>
        <div style={styles.stars}>{starsBg}</div>
        <div style={styles.confetti}>{confettiEls}</div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 580, margin: '0 auto', padding: '2rem 1rem' }}>
          {/* RANK REVEAL */}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', animation: 'popIn 0.5s ease' }}>
            <div style={{ fontSize: '0.75rem', letterSpacing: 4, color: '#475569', marginBottom: 6 }}>RANK ACHIEVED</div>
            <div style={{ fontSize: '3.5rem', fontWeight: 900, color: rank.color, textShadow: `0 0 30px ${rank.color}`, letterSpacing: 6 }}>{rank.label}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>+{xpGained} XP EARNED · LV {lvl}</div>
          </div>

          {/* SCORE BREAKDOWN */}
          <div style={{ ...styles.glassPanel, marginBottom: '1rem' }}>
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.75rem', color: '#475569', letterSpacing: 3 }}>FINAL SCORE</div>
              <div style={{ fontSize: '3rem', fontWeight: 900, color: '#fbbf24', textShadow: '0 0 20px #fbbf2488' }}>{score.toLocaleString()}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', textAlign: 'center' }}>
              <StatBox label="WPM" value={wpm} color="#00f5ff" />
              <StatBox label="ACCURACY" value={`${finalAcc}%`} color="#4ade80" />
              <StatBox label="MAX COMBO" value={`${maxCombo}×`} color="#f59e0b" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', textAlign: 'center', marginTop: '0.8rem' }}>
              <StatBox label="ERRORS" value={errors} color="#f87171" />
              <StatBox label="TIME" value={`${Math.round(timeElapsed)}s`} color="#e2e8f0" />
            </div>
          </div>

          {/* XP Bar update */}
          <div style={styles.glassPanel}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.82rem' }}>
              <span style={{ color: '#00f5ff', fontWeight: 700 }}>LV {lvl}</span>
              <span style={{ color: '#64748b' }}>{xp} XP</span>
            </div>
            <div style={styles.xpTrack}><div style={{ ...styles.xpFill, width: `${pct}%` }} /></div>
          </div>

          {/* CTA */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
            <button onClick={() => startGame(mode)} style={{ ...styles.ctaBtn, flex: 2, background: 'linear-gradient(135deg, #00f5ff22, #00f5ff11)', borderColor: '#00f5ff', color: '#00f5ff' }}>
              ↻ PLAY AGAIN
            </button>
            <button onClick={() => setScreen('menu')} style={{ ...styles.ctaBtn, flex: 1, background: 'rgba(255,255,255,0.03)', borderColor: '#334155', color: '#64748b' }}>
              MENU
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── SUB-COMPONENTS ──────────────────────────────────────────
function Stat({ label, value, color, big, glow }) {
  return (
    <div style={{ textAlign: 'center', minWidth: 52 }}>
      <div style={{ fontSize: big ? '1.4rem' : '1.1rem', fontWeight: 900, color, textShadow: glow ? `0 0 16px ${color}` : 'none', transition: 'text-shadow 0.2s' }}>{value}</div>
      <div style={{ fontSize: '0.62rem', color: '#475569', letterSpacing: 1.5 }}>{label}</div>
    </div>
  );
}
function StatBox({ label, value, color }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.6rem 0.4rem', border: '1px solid #1e293b' }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: '0.65rem', color: '#475569', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── STATIC DECORATIONS ──────────────────────────────────────
const starsBg = Array.from({ length: 60 }).map((_, i) => (
  <div key={i} style={{
    position: 'absolute',
    width: Math.random() * 2 + 1 + 'px', height: Math.random() * 2 + 1 + 'px',
    background: '#fff',
    borderRadius: '50%',
    left: Math.random() * 100 + '%',
    top: Math.random() * 100 + '%',
    opacity: Math.random() * 0.5 + 0.1,
    animation: `twinkle ${Math.random() * 3 + 2}s infinite alternate`,
  }} />
));

const confettiEls = Array.from({ length: 28 }).map((_, i) => {
  const colors = ['#00f5ff','#fbbf24','#4ade80','#f87171','#a78bfa','#f59e0b'];
  return (
    <div key={i} style={{
      position: 'absolute',
      width: 8, height: 8,
      background: colors[i % colors.length],
      top: '-10px',
      left: Math.random() * 100 + '%',
      borderRadius: Math.random() > 0.5 ? '50%' : '0',
      animation: `confettiFall ${1.5 + Math.random() * 2}s ${Math.random() * 1.5}s forwards ease-in`,
    }} />
  );
});

// ── STYLES ──────────────────────────────────────────────────
const styles = {
  root: {
    minHeight: '100vh',
    background: '#020617',
    fontFamily: "'Rajdhani', 'Orbitron', sans-serif",
    color: '#e2e8f0',
    position: 'relative',
    overflow: 'hidden',
  },
  stars: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
  },
  title: {
    fontSize: '3rem', fontWeight: 900, letterSpacing: 6,
    background: 'linear-gradient(135deg, #e2e8f0 30%, #00f5ff)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    margin: 0,
  },
  glassPanel: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: '1.2rem',
    backdropFilter: 'blur(10px)',
  },
  xpTrack: {
    height: 6, background: '#0f172a', borderRadius: 99, overflow: 'hidden',
  },
  xpFill: {
    height: '100%', background: 'linear-gradient(90deg, #00f5ff, #a78bfa)',
    borderRadius: 99, transition: 'width 0.5s ease',
  },
  sectionLabel: {
    fontSize: '0.7rem', letterSpacing: 3, color: '#475569', marginBottom: 8, marginTop: 0,
  },
  chipBtn: {
    flex: 1, padding: '0.5rem', borderRadius: 8,
    background: 'rgba(255,255,255,0.04)', border: '1px solid #1e293b',
    color: '#64748b', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
    letterSpacing: 1, fontFamily: 'inherit', transition: 'all 0.2s',
  },
  modeBtn: {
    display: 'flex', alignItems: 'center', gap: '1rem',
    padding: '1rem 1.2rem', borderRadius: 14,
    background: 'rgba(255,255,255,0.03)', border: '1px solid #1e293b',
    color: '#e2e8f0', cursor: 'pointer', width: '100%',
    fontFamily: 'inherit', transition: 'all 0.2s',
  },
  ghostBtn: {
    background: 'none', border: 'none', color: '#475569',
    cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem',
    letterSpacing: 1, padding: '0.3rem 0.6rem', borderRadius: 6,
  },
  statsStrip: {
    display: 'flex', justifyContent: 'space-around', alignItems: 'center',
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12, padding: '0.8rem 0.5rem', marginBottom: '0.8rem',
  },
  timerTrack: {
    height: 4, background: '#0f172a', borderRadius: 99, overflow: 'hidden', marginBottom: '0.8rem',
  },
  timerFill: {
    height: '100%', borderRadius: 99, transition: 'width 0.1s linear, background 0.5s',
  },
  passageBox: {
    background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14, padding: '1.4rem 1.6rem', minHeight: 120,
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    transition: 'box-shadow 0.3s',
  },
  progressTrack: {
    height: 4, background: '#0f172a', borderRadius: 99, overflow: 'hidden', marginTop: '0.8rem',
  },
  progressFill: {
    height: '100%', background: 'linear-gradient(90deg, #00f5ff, #4ade80)',
    borderRadius: 99, transition: 'width 0.15s ease', position: 'relative',
  },
  progressGlow: {
    position: 'absolute', right: 0, top: '-3px', width: 8, height: 10,
    background: '#fff', borderRadius: '50%', boxShadow: '0 0 8px 3px #00f5ff',
  },
  textarea: {
    width: '100%', padding: '1rem 1.2rem', borderRadius: 12,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
    color: '#e2e8f0', fontSize: '1rem', minHeight: 90, outline: 'none',
    resize: 'none', fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.05em', boxSizing: 'border-box', marginTop: '0.8rem',
    transition: 'border-color 0.2s',
  },
  powerupBtn: {
    padding: '0.5rem 0.9rem', borderRadius: 10, border: '1px solid',
    background: 'rgba(0,0,0,0.4)', cursor: 'pointer', textAlign: 'center',
    transition: 'all 0.2s', minWidth: 72, fontFamily: 'inherit',
  },
  floater: {
    position: 'fixed', pointerEvents: 'none', zIndex: 999,
    fontWeight: 900, fontSize: '1.1rem', letterSpacing: 2,
    animation: 'floatUp 1.2s ease forwards',
    textShadow: '0 0 10px currentColor',
  },
  achieveToast: {
    position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
    background: 'linear-gradient(135deg, #1e293b, #0f172a)',
    border: '1px solid #f59e0b', color: '#f59e0b',
    padding: '0.5rem 1.5rem', borderRadius: 99,
    fontSize: '0.85rem', fontWeight: 700, letterSpacing: 2,
    boxShadow: '0 0 20px #f59e0b44', zIndex: 998,
    animation: 'slideDown 0.3s ease',
  },
  ctaBtn: {
    padding: '1rem', borderRadius: 12, border: '1px solid',
    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700,
    fontSize: '0.9rem', letterSpacing: 2, transition: 'all 0.2s',
  },
  confetti: {
    position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden',
  },
};

// ── CSS KEYFRAMES ────────────────────────────────────────────
const css = `
@import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;700;900&family=Orbitron:wght@700;900&display=swap');

@keyframes cursorBlink { 0%,100%{opacity:1} 50%{opacity:0} }
@keyframes twinkle { from{opacity:0.1} to{opacity:0.6} }
@keyframes shake {
  0%,100%{transform:translateX(0)}
  20%{transform:translateX(-8px) rotate(-0.5deg)}
  40%{transform:translateX(8px) rotate(0.5deg)}
  60%{transform:translateX(-6px)}
  80%{transform:translateX(6px)}
}
@keyframes floatUp {
  0%{opacity:1;transform:translateY(0) scale(1)}
  100%{opacity:0;transform:translateY(-70px) scale(1.3)}
}
@keyframes popIn {
  0%{opacity:0;transform:scale(0.7)}
  70%{transform:scale(1.08)}
  100%{opacity:1;transform:scale(1)}
}
@keyframes slideDown {
  from{opacity:0;transform:translate(-50%,-20px)}
  to{opacity:1;transform:translate(-50%,0)}
}
@keyframes confettiFall {
  0%{opacity:1;transform:translateY(0) rotate(0deg)}
  100%{opacity:0;transform:translateY(110vh) rotate(720deg)}
}
textarea:focus { border-color: rgba(0,245,255,0.4) !important; box-shadow: 0 0 0 3px rgba(0,245,255,0.08); }
button:hover:not(:disabled) { opacity:0.85; transform:translateY(-1px); }
`;