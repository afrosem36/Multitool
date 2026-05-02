import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, Clock, Link2, Search, Youtube } from 'lucide-react';
import ProcessingState from '../../components/shared/ProcessingState';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import { useToolHistory } from '../../hooks/useToolHistory';
import { apiFetch } from '../../utils/api';
import '../ToolStyles.css';
import './YouTubeDownloader.css';

const formatDuration = (secs) => {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const YouTubeDownloader = () => {
  const [url,        setUrl]        = useState('');
  const [info,       setInfo]       = useState(null);
  const [quality,    setQuality]    = useState('');
  const [infoStatus, setInfoStatus] = useState('idle');
  const [dlStatus,   setDlStatus]   = useState('idle');
  const [infoError,  setInfoError]  = useState('');
  const [dlError,    setDlError]    = useState('');
  const [dlMsg,      setDlMsg]      = useState('');
  const abortRef = useRef(null);

  const { addHistory } = useToolHistory();
  useEffect(() => { addHistory('/tools/youtube-downloader', 'YouTube Downloader', 'utility'); }, [addHistory]);

  const handleGetInfo = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    setInfo(null);
    setInfoStatus('processing');
    setInfoError('');
    setDlStatus('idle');
    setDlError('');
    setDlMsg('');

    try {
      const res  = await apiFetch(`/api/youtube/info?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch video info.');
      setInfo(data);
      setQuality(data.formats?.[0] || 'best');
      setInfoStatus('success');
    } catch (err) {
      setInfoStatus('error');
      setInfoError(err.message || 'Could not fetch video info. Check the URL and try again.');
    }
  };

  const handleDownload = async () => {
    if (!info) return;
    setDlStatus('processing');
    setDlError('');
    setDlMsg('Preparing download — this may take a minute for HD videos…');

    try {
      const res = await apiFetch('/api/youtube/download', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: url.trim(), quality }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Download failed.' }));
        // Check if a lower-quality fallback was used
        const formatUsed = res.headers.get('x-format-used');
        if (formatUsed && formatUsed !== quality) {
          setDlMsg(`Note: Requested quality unavailable — downloaded at ${formatUsed} instead.`);
        }
        throw new Error(err.error || 'Download failed.');
      }

      const formatUsed   = res.headers.get('x-format-used');
      const disposition  = res.headers.get('content-disposition') || '';
      const match        = disposition.match(/filename="?([^"]+)"?/);
      const filename     = match?.[1] || `video.${quality === 'audio' ? 'mp3' : 'mp4'}`;

      if (formatUsed && formatUsed !== quality) {
        setDlMsg(`Fallback: ${quality} unavailable — downloaded at ${formatUsed}.`);
      } else {
        setDlMsg('');
      }

      const blob    = await res.blob();
      const dlUrl   = URL.createObjectURL(blob);
      const anchor  = document.createElement('a');
      anchor.href   = dlUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setTimeout(() => URL.revokeObjectURL(dlUrl), 10000);

      setDlStatus('success');
    } catch (err) {
      setDlStatus('error');
      setDlError(err.message);
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>YouTube Downloader</h1>
        <p>Download YouTube videos as MP4 or extract audio. Highest quality with automatic fallback.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">

        {/* ── URL form ─────────────────────────────────────────────────── */}
        <form onSubmit={handleGetInfo} className="ytd-url-form">
          <div className="ytd-input-wrap glass-panel">
            <Link2 size={18} className="ytd-input-icon" />
            <input
              type="url"
              placeholder="Paste YouTube URL…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="ytd-input"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={infoStatus === 'processing'}>
            <Search size={16} /> Get Info
          </button>
        </form>

        {/* ── Info fetch status ─────────────────────────────────────────── */}
        <ProcessingState
          status={infoStatus}
          error={infoError}
          message={infoStatus === 'success' ? 'Video info loaded.' : 'Fetching video info…'}
        />

        {/* ── Video card ────────────────────────────────────────────────── */}
        {info && (
          <div className="ytd-card glass-panel animate-fade-in">
            {info.thumbnail && (
              <img src={info.thumbnail} alt="Thumbnail" className="ytd-thumb" />
            )}
            <div className="ytd-meta">
              <p className="ytd-title">{info.title}</p>
              {info.channel && <p className="ytd-channel">{info.channel}</p>}
              {info.duration > 0 && (
                <p className="ytd-duration">
                  <Clock size={13} /> {formatDuration(info.duration)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Quality selector + Download ───────────────────────────────── */}
        {info && (
          <div className="ytd-controls animate-fade-in">
            <div className="ytd-quality-wrap">
              <label className="ytd-quality-label">Quality</label>
              <div className="ytd-quality-pills">
                {info.formats?.map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    className={`ytd-pill ${quality === fmt ? 'active' : ''}`}
                    onClick={() => setQuality(fmt)}
                  >
                    {fmt === 'audio' ? '🎵 Audio (MP3)' : fmt}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownload}
              className="btn-primary ytd-dl-btn"
              disabled={dlStatus === 'processing'}
            >
              <ArrowDown size={18} />
              {dlStatus === 'processing' ? 'Downloading…' : `Download ${quality === 'audio' ? 'Audio' : quality + ' MP4'}`}
            </button>
          </div>
        )}

        {/* ── Download status ───────────────────────────────────────────── */}
        {(dlStatus !== 'idle' || dlMsg) && (
          <ProcessingState
            status={dlStatus}
            error={dlError}
            message={dlStatus === 'success' ? 'Download complete!' : dlMsg || 'Processing…'}
          />
        )}

        {/* ── Disclaimer ────────────────────────────────────────────────── */}
        <p className="ytd-disclaimer">
          For personal use only. Downloading copyrighted content without permission may violate YouTube's Terms of Service.
          Live streams, private, and age-restricted videos are not supported.
        </p>
      </div>

      {info && <AdPlaceholder className="mt-5" />}
    </div>
  );
};

export default YouTubeDownloader;
