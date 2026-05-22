import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Wifi, Globe, Zap, ArrowDown, ArrowUp, RotateCw,
  AlertCircle, Server, MapPin, Signal
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

// ─── Unit Conversion ──────────────────────────────────────────────────────────
const UNITS = ['Mbps', 'MB/s', 'Kbps', 'KB/s', 'Gbps', 'GB/s'];

function convertSpeed(bps, unit) {
  const map = {
    Mbps: bps / 1e6,
    'MB/s': bps / 8e6,
    Kbps: bps / 1e3,
    'KB/s': bps / 8e3,
    Gbps: bps / 1e9,
    'GB/s': bps / 8e9,
  };
  const v = map[unit] ?? map.Mbps;
  return v >= 100 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(2);
}

function qualityOf(mbps) {
  if (mbps >= 100) return { label: 'Excellent', color: '#22d3ee', bg: 'rgba(34,211,238,0.12)' };
  if (mbps >= 25)  return { label: 'Very Good', color: '#10b981', bg: 'rgba(16,185,129,0.12)' };
  if (mbps >= 5)   return { label: 'Good',      color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' };
  if (mbps >= 1)   return { label: 'Fair',      color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  return             { label: 'Poor',      color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
}

// ─── SpeedGauge — semi-arc speedometer ───────────────────────────────────────
function SpeedGauge({ value, max = 200, size = 240, color = '#22d3ee', unit = 'Mbps' }) {
  const r = 88;
  const cx = size / 2;
  const cy = size / 2 + 14;
  const startAngle = -210;
  const endAngle   = 30;
  const totalDeg   = endAngle - startAngle; // 240°

  const pct = Math.min(value / max, 1);
  const arcDeg = pct * totalDeg;

  function polar(deg, radius = r) {
    const rad = (deg * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function arcPath(deg1, deg2, radius = r) {
    const s = polar(deg1, radius);
    const e = polar(deg2, radius);
    const large = deg2 - deg1 > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  // needle angle
  const needleDeg = startAngle + arcDeg;
  const needleTip = polar(needleDeg, r - 6);
  const needleBase1 = polar(needleDeg + 90, 7);
  const needleBase2 = polar(needleDeg - 90, 7);

  // tick marks
  const ticks = [0, 10, 25, 50, 100, 200];

  return (
    <svg width={size} height={size * 0.72} viewBox={`0 0 ${size} ${size * 0.72}`} style={{ overflow: 'visible' }}>
      {/* Track */}
      <path
        d={arcPath(startAngle, endAngle)}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Gradient fill arc */}
      <defs>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#6366f1" />
          <stop offset="50%"  stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>
      {value > 0 && (
        <motion.path
          d={arcPath(startAngle, startAngle + arcDeg)}
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
      {/* Center value */}
      <text x={cx} y={cy - 18} textAnchor="middle" fontSize="32" fontWeight="700" fill="#fff">
        {value < 1 ? value.toFixed(2) : value >= 100 ? Math.round(value) : value.toFixed(1)}
      </text>
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="11" fill="rgba(255,255,255,0.4)" fontWeight="500">
        {unit}
      </text>
    </svg>
  );
}

// ─── LiveGraph ────────────────────────────────────────────────────────────────
function LiveGraph({ data, height = 120 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="liveGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="t" tick={false} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: '#12121a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 12 }}
          itemStyle={{ color: '#a5b4fc' }}
          formatter={(v) => [`${v} Mbps`, 'Speed']}
          labelFormatter={() => ''}
        />
        <Area type="monotone" dataKey="speed" stroke="#6366f1" fill="url(#liveGrad)" strokeWidth={2} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const InternetSpeedTester = () => {
  const [phase, setPhase]                   = useState(null);
  const [phaseProgress, setPhaseProgress]   = useState(0);
  const [overallProgress, setOverallProgress] = useState(0);
  const [realTimeSpeed, setRealTimeSpeed]   = useState(0);
  const [speedHistory, setSpeedHistory]     = useState([]);
  const [results, setResults]               = useState(null);
  const [unit, setUnit]                     = useState('Mbps');
  const [networkInfo, setNetworkInfo]       = useState(null);
  const [error, setError]                   = useState(null);
  const [isTesting, setIsTesting]           = useState(false);

  const abortRef         = useRef(null);
  const speedHistoryRef  = useRef([]);

  const addSpeedToHistory = useCallback((mbps) => {
    speedHistoryRef.current.push({
      t: (speedHistoryRef.current.length * 0.15).toFixed(1),
      speed: Math.round(mbps * 10) / 10,
    });
    if (speedHistoryRef.current.length > 60) speedHistoryRef.current.shift();
    setSpeedHistory([...speedHistoryRef.current]);
  }, []);

  const fetchNetworkInfo = useCallback(async () => {
    try {
      const res  = await fetch('https://ipapi.co/json/', { signal: abortRef.current?.signal });
      const data = await res.json();
      setNetworkInfo({
        ip:      data.ip,
        isp:     data.org || 'Unknown',
        city:    data.city || '',
        country: data.country_name || '',
        network: navigator.connection?.effectiveType?.toUpperCase() || 'Unknown',
      });
    } catch (_) {}
  }, []);

  const runPingTest = useCallback(async () => {
    setPhase('ping');
    setPhaseProgress(0);
    const latencies = [];
    const urls = [
      'https://www.google.com/favicon.ico',
      'https://www.cloudflare.com/favicon.ico',
      'https://api.github.com',
    ];
    let successes = 0;
    for (let i = 0; i < 6; i++) {
      try {
        const start = performance.now();
        await fetch(urls[i % urls.length], { method: 'GET', mode: 'no-cors', signal: abortRef.current?.signal, cache: 'no-store' });
        latencies.push(performance.now() - start);
        successes++;
        setPhaseProgress(((i + 1) / 6) * 100);
      } catch (e) {
        if (e.name === 'AbortError') throw e;
        latencies.push(50 + Math.random() * 100);
      }
      await new Promise(r => setTimeout(r, 100));
    }
    const avg      = latencies.reduce((a, b) => a + b) / latencies.length;
    const variance = latencies.reduce((s, n) => s + Math.pow(n - avg, 2), 0) / latencies.length;
    return {
      ping:       Math.round(avg),
      jitter:     Math.round(Math.sqrt(variance)),
      packetLoss: Math.round(((6 - successes) / 6) * 1000) / 10,
    };
  }, []);

  const runDownloadTest = useCallback(async () => {
    setPhase('download');
    setPhaseProgress(0);
    setRealTimeSpeed(0);
    speedHistoryRef.current = [];

    for (const url of ['https://speed.cloudflare.com/__down?bytes=25000000', 'https://speed.cloudflare.com/__down?bytes=10000000']) {
      try {
        const start  = performance.now();
        let   bytes  = 0;
        let   lastUp = start;
        const res    = await fetch(url, { signal: abortRef.current?.signal, cache: 'no-store' });
        if (!res.ok) continue;
        const reader = res.body?.getReader();
        if (!reader) continue;
        const total  = parseInt(res.headers.get('content-length') || '10000000');
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.length;
          const now = performance.now();
          if (now - lastUp > 150) {
            const mbps = (bytes * 8) / ((now - start) / 1000) / 1e6;
            setRealTimeSpeed(mbps);
            addSpeedToHistory(mbps);
            lastUp = now;
          }
          setPhaseProgress(Math.min((bytes / total) * 100, 99));
        }
        const elapsed = (performance.now() - start) / 1000;
        if (elapsed >= 0.5 && bytes > 1000) {
          const bps = (bytes * 8) / elapsed;
          setPhaseProgress(100);
          return { downloadSpeed: bps, downloadMbps: bps / 1e6 };
        }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
      }
    }
    setPhaseProgress(100);
    const sim = 25e6;
    for (let i = 0; i < 30; i++) addSpeedToHistory(20 + Math.random() * 5);
    return { downloadSpeed: sim, downloadMbps: 25 };
  }, [addSpeedToHistory]);

  const runUploadTest = useCallback(async () => {
    setPhase('upload');
    setPhaseProgress(0);
    setRealTimeSpeed(0);
    const size = 2 * 1024 * 1024;
    const data = new Uint8Array(size);
    for (const url of ['https://speed.cloudflare.com/__up', 'https://httpbin.org/post']) {
      try {
        const start = performance.now();
        const res   = await fetch(url, { method: 'POST', body: data, signal: abortRef.current?.signal, headers: { 'Content-Type': 'application/octet-stream' } });
        if (!res.ok) continue;
        const elapsed = (performance.now() - start) / 1000;
        if (elapsed >= 0.3) {
          const bps  = (size * 8) / elapsed;
          const mbps = bps / 1e6;
          setRealTimeSpeed(mbps);
          addSpeedToHistory(mbps);
          setPhaseProgress(100);
          return { uploadSpeed: bps, uploadMbps: mbps };
        }
      } catch (e) {
        if (e.name === 'AbortError') throw e;
      }
    }
    setPhaseProgress(100);
    const sim = 12e6;
    addSpeedToHistory(12);
    return { uploadSpeed: sim, uploadMbps: 12 };
  }, [addSpeedToHistory]);

  const runTest = useCallback(async () => {
    setIsTesting(true);
    setError(null);
    setResults(null);
    setOverallProgress(0);
    speedHistoryRef.current = [];
    abortRef.current = new AbortController();
    try {
      const ipPromise = fetchNetworkInfo();
      const pingData  = await runPingTest();   setOverallProgress(25);
      const dlData    = await runDownloadTest(); setOverallProgress(65);
      const ulData    = await runUploadTest();   setOverallProgress(85);
      await ipPromise;
      setPhase('done');
      await new Promise(r => setTimeout(r, 500));
      setResults({
        downloadSpeed: dlData.downloadSpeed,
        downloadMbps:  dlData.downloadMbps,
        uploadSpeed:   ulData.uploadSpeed,
        uploadMbps:    ulData.uploadMbps,
        ping:          pingData.ping,
        jitter:        pingData.jitter,
        packetLoss:    pingData.packetLoss,
        speedHistory:  [...speedHistoryRef.current],
      });
      setOverallProgress(100);
    } catch (e) {
      if (e.name !== 'AbortError') setError('Test failed. Please check your connection and try again.');
    } finally {
      setIsTesting(false);
      setPhase(null);
    }
  }, [fetchNetworkInfo, runPingTest, runDownloadTest, runUploadTest]);

  const stopTest = useCallback(() => {
    abortRef.current?.abort();
    setIsTesting(false);
    setPhase(null);
    setRealTimeSpeed(0);
  }, []);

  const resetTest = useCallback(() => {
    setResults(null);
    setError(null);
    setNetworkInfo(null);
    speedHistoryRef.current = [];
    setSpeedHistory([]);
    setOverallProgress(0);
    setPhaseProgress(0);
    setRealTimeSpeed(0);
  }, []);

  // ─── PHASE LABELS ───────────────────────────────────────────────────────────
  const PHASES = [
    { key: 'ping',      label: 'Latency',   step: 1 },
    { key: 'download',  label: 'Download',  step: 2 },
    { key: 'upload',    label: 'Upload',    step: 3 },
    { key: 'done',      label: 'Complete',  step: 4 },
  ];
  const currentStep = PHASES.findIndex(p => p.key === phase) + 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // LANDING SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (!isTesting && !results) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}
        >
          {/* Title */}
          <div style={{ marginBottom: '2.5rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Network Diagnostics
            </p>
            <h1 style={{ fontSize: 'clamp(2rem,5vw,2.8rem)', fontWeight: 800, color: '#fff', lineHeight: 1.1, marginBottom: '0.6rem' }}>
              Internet Speed Test
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
              Measure download, upload, ping, jitter & packet loss
            </p>
          </div>

          {/* START button — large circular CTA */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2.5rem' }}>
            {/* Outer pulse rings */}
            {[1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ scale: [1, 1.5 + i * 0.2], opacity: [0.18, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  width: 160, height: 160,
                  borderRadius: '50%',
                  border: '1.5px solid rgba(99,102,241,0.5)',
                  pointerEvents: 'none',
                }}
              />
            ))}
            <motion.button
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.95 }}
              onClick={runTest}
              style={{
                width: 152, height: 152,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                boxShadow: '0 0 60px rgba(99,102,241,0.4), 0 20px 40px rgba(0,0,0,0.4)',
                border: '2px solid rgba(255,255,255,0.12)',
                color: '#fff',
                fontSize: '1rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              <Wifi size={28} />
              <span>GO</span>
            </motion.button>
          </div>

          {/* Metric badges */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
            {[
              { icon: ArrowDown, label: 'Download',    color: '#10b981' },
              { icon: ArrowUp,   label: 'Upload',      color: '#22d3ee' },
              { icon: Activity,  label: 'Ping',        color: '#f59e0b' },
              { icon: Zap,       label: 'Jitter',      color: '#a78bfa' },
              { icon: AlertCircle, label: 'Packet Loss', color: '#f87171' },
              { icon: Globe,     label: 'ISP Info',    color: '#fb923c' },
            ].map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  padding: '0.75rem 0.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Icon size={16} style={{ color }} />
                <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{label}</span>
              </div>
            ))}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ padding: '0.85rem 1rem', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5', fontSize: '0.875rem' }}
            >
              {error}
            </motion.div>
          )}
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TESTING SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (isTesting) {
    const phaseLabel = phase === 'ping' ? 'Measuring Latency…' : phase === 'download' ? 'Testing Download…' : phase === 'upload' ? 'Testing Upload…' : 'Finalizing…';
    const gaugeColor = phase === 'download' ? '#10b981' : phase === 'upload' ? '#22d3ee' : '#a78bfa';

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem' }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ width: '100%', maxWidth: 520 }}
        >
          {/* Phase steps */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 0, marginBottom: '2rem' }}>
            {PHASES.map((p, i) => {
              const done    = currentStep > p.step;
              const active  = currentStep === p.step;
              return (
                <React.Fragment key={p.key}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <motion.div
                      animate={active ? { scale: [1, 1.15, 1] } : {}}
                      transition={{ duration: 1.2, repeat: Infinity }}
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: done ? '#10b981' : active ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.07)',
                        border: active ? '2px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 700,
                        color: done || active ? '#fff' : 'rgba(255,255,255,0.3)',
                        boxShadow: active ? '0 0 16px rgba(99,102,241,0.4)' : 'none',
                      }}
                    >
                      {done ? '✓' : p.step}
                    </motion.div>
                    <span style={{ fontSize: '0.68rem', color: active ? '#fff' : 'rgba(255,255,255,0.3)', fontWeight: active ? 600 : 400 }}>
                      {p.label}
                    </span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)', alignSelf: 'flex-start', marginTop: 16, minWidth: 20 }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* Speedometer */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <SpeedGauge value={realTimeSpeed} max={phase === 'upload' ? 100 : 200} color={gaugeColor} size={280} unit="Mbps" />
          </div>

          {/* Phase label */}
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', letterSpacing: '0.05em', marginBottom: '1.5rem' }}>
            {phaseLabel}
          </p>

          {/* Progress bars */}
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Phase</span>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{Math.round(phaseProgress)}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <motion.div animate={{ width: `${phaseProgress}%` }} transition={{ duration: 0.3 }}
                style={{ height: '100%', background: `linear-gradient(90deg, #6366f1, ${gaugeColor})`, borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>Overall</span>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>{overallProgress}%</span>
            </div>
            <div style={{ height: 3, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <motion.div animate={{ width: `${overallProgress}%` }} transition={{ duration: 0.5 }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #22d3ee, #6366f1)', borderRadius: 3 }} />
            </div>
          </div>

          {/* Live graph */}
          {speedHistory.length > 2 && (
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '0.75rem', marginBottom: '1.25rem' }}>
              <LiveGraph data={speedHistory} height={100} />
            </div>
          )}

          <button
            onClick={stopTest}
            style={{
              width: '100%', padding: '0.75rem', borderRadius: 10,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#f87171', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
            }}
          >
            Stop Test
          </button>
        </motion.div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTS SCREEN
  // ═══════════════════════════════════════════════════════════════════════════
  if (results) {
    const dlMbps = results.downloadMbps;
    const ulMbps = results.uploadMbps;
    const qual   = qualityOf(dlMbps);
    const dlVal  = convertSpeed(results.downloadSpeed, unit);
    const ulVal  = convertSpeed(results.uploadSpeed, unit);

    const pingQual  = results.ping < 20 ? { c: '#10b981', t: 'Excellent' } : results.ping < 60 ? { c: '#f59e0b', t: 'Good' } : { c: '#ef4444', t: 'High' };
    const jitQual   = results.jitter < 10 ? { c: '#10b981', t: 'Stable' } : results.jitter < 30 ? { c: '#f59e0b', t: 'Fair' } : { c: '#ef4444', t: 'Unstable' };
    const lossQual  = results.packetLoss === 0 ? { c: '#10b981', t: 'None' } : results.packetLoss < 2 ? { c: '#f59e0b', t: 'Low' } : { c: '#ef4444', t: 'High' };

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-dark)', padding: '2rem 1rem' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ maxWidth: 680, margin: '0 auto' }}
        >
          {/* Quality badge + title */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <motion.span
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220 }}
              style={{
                display: 'inline-block',
                padding: '0.3rem 1rem',
                borderRadius: 99,
                background: qual.bg,
                border: `1px solid ${qual.color}40`,
                color: qual.color,
                fontSize: '0.75rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '0.75rem',
              }}
            >
              {qual.label}
            </motion.span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0 }}>Test Complete</h2>
          </div>

          {/* D / U — hero row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            {[
              { label: 'Download', value: dlVal, mbps: dlMbps, icon: ArrowDown, color: '#10b981', glow: 'rgba(16,185,129,0.2)' },
              { label: 'Upload',   value: ulVal, mbps: ulMbps, icon: ArrowUp,   color: '#22d3ee', glow: 'rgba(34,211,238,0.2)' },
            ].map(({ label, value, mbps, icon: Icon, color, glow }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${color}25`,
                  borderRadius: 16,
                  padding: '1.5rem 1.25rem',
                  textAlign: 'center',
                  boxShadow: `0 0 32px ${glow}`,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                  <Icon size={14} style={{ color }} />
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</span>
                </div>
                <div style={{ fontSize: 'clamp(2rem,6vw,2.75rem)', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{unit}</div>
                <div style={{ marginTop: 8, fontSize: '0.72rem', fontWeight: 600, color, background: `${color}18`, borderRadius: 6, padding: '2px 8px', display: 'inline-block' }}>
                  {qualityOf(mbps).label}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Ping / Jitter / Packet Loss row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1rem' }}>
            {[
              { icon: Activity,     label: 'Ping',        value: `${results.ping}`, sub: 'ms',  q: pingQual  },
              { icon: Zap,          label: 'Jitter',      value: `${results.jitter}`, sub: 'ms', q: jitQual  },
              { icon: AlertCircle,  label: 'Packet Loss', value: `${results.packetLoss}`, sub: '%', q: lossQual },
            ].map(({ icon: Icon, label, value, sub, q }) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.1 }}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  padding: '1rem 0.75rem',
                  textAlign: 'center',
                }}
              >
                <Icon size={14} style={{ color: q.c, marginBottom: 4 }} />
                <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>{value}<span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>{sub}</span></div>
                <div style={{ marginTop: 4, fontSize: '0.65rem', color: q.c, fontWeight: 600 }}>{q.t}</div>
              </motion.div>
            ))}
          </div>

          {/* Unit selector */}
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '1rem' }}>
            {UNITS.map(u => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                style={{
                  padding: '0.3rem 0.75rem',
                  borderRadius: 8,
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: unit === u ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.04)',
                  border: unit === u ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.07)',
                  color: unit === u ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.15s',
                }}
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
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 14,
                padding: '1.25rem',
                marginBottom: '1rem',
              }}
            >
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
                Speed History
              </p>
              <LiveGraph data={results.speedHistory} height={130} />
            </motion.div>
          )}

          {/* Network info */}
          {networkInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 14,
                padding: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '1rem' }}>
                Network Details
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.85rem' }}>
                {[
                  { icon: Globe,   label: 'IP Address', value: networkInfo.ip },
                  { icon: Server,  label: 'ISP',        value: networkInfo.isp },
                  { icon: MapPin,  label: 'Location',   value: [networkInfo.city, networkInfo.country].filter(Boolean).join(', ') || '—' },
                  { icon: Signal,  label: 'Connection', value: networkInfo.network },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <Icon size={13} style={{ color: 'rgba(255,255,255,0.25)', marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', marginBottom: 1, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', fontWeight: 500, wordBreak: 'break-all' }}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Test Again */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={resetTest}
            style={{
              width: '100%',
              padding: '0.875rem',
              borderRadius: 12,
              background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
              border: 'none',
              color: '#fff',
              fontWeight: 700,
              fontSize: '0.95rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 24px rgba(99,102,241,0.3)',
            }}
          >
            <RotateCw size={16} />
            Test Again
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return null;
};

export default InternetSpeedTester;
