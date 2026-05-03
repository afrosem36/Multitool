import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, Clock, Link2, Search, ShieldCheck, TimerReset, X, Zap, AlertCircle, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import { useToolHistory } from '../../hooks/useToolHistory';
import '../ToolStyles.css';
import './YouTubeDownloader.css';

const POLL_INTERVAL = 1500;
const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const WORKER_SECRET = import.meta.env.VITE_WORKER_SECRET || '';

/**
 * Add WORKER_SECRET header to protected routes only
 * Protected routes: /api/video-info, /api/download, /api/progress
 */
const addWorkerSecret = (headers = {}) => ({
  ...headers,
  ...(WORKER_SECRET ? { Authorization: `Bearer ${WORKER_SECRET}` } : {}),
});

const parseJsonSafely = async (response) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'Server returned an unexpected response.' };
  }
};

const apiJson = async (endpoint, options = {}) => {
  if (!API_BASE_URL) {
    throw new Error('Missing VITE_API_URL environment variable.');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    // Protected routes: /api/video-info, /api/download require WORKER_SECRET
    headers: addWorkerSecret(options.headers || {}),
  });
  const data = await parseJsonSafely(response);
  if (!response.ok) throw new Error(data.error || data.message || 'Request failed');
  return data;
};

const getDownloadFilename = (disposition) => {
  const match = disposition?.match(/filename="?([^"]+)"?/i);
  return match?.[1] || 'youtube-video.mp4';
};

const apiBlob = async (endpoint) => {
  if (!API_BASE_URL) {
    throw new Error('Missing VITE_API_URL environment variable.');
  }

  // Protected routes: /api/download/:id/file requires WORKER_SECRET
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    headers: addWorkerSecret(),
  });

  if (!response.ok) {
    const data = await parseJsonSafely(response);
    throw new Error(data.error || 'Download failed');
  }

  return {
    blob: await response.blob(),
    filename: getDownloadFilename(response.headers.get('content-disposition')),
  };
};

const formatDuration = (secs) => {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const formatQuality = (quality) => {
  if (quality === 'best') return 'Best';
  if (quality === '4k') return '4K';
  if (quality === '8k') return '8K';
  return `${quality}p`;
};

const formatWait = (wait) => wait || 'Calculating...';

const statusLabel = (job) => {
  if (!job) return '';
  const progress = Number(job.progress || job.percent || 0);
  switch (job.status) {
    case 'queued':
      return `⏳ Waiting in queue (Position: ${job.position || '?'})`;
    case 'downloading':
      return `📥 Downloading & merging ${progress.toFixed(1)}%${job.speed ? ` • ${job.speed}` : ''}${job.eta ? ` • ETA ${job.eta}` : ''}`;
    case 'merging':
      return '🔄 Merging video + audio...';
    case 'uploading':
      return '☁️ Uploading to CDN...';
    case 'ready':
      return job.cached ? '⚡ Ready to download (from cache)' : '✅ Ready - starting your download...';
    case 'retrying':
      return job.message || '🔁 Retrying with another server...';
    case 'starting':
      return '🚀 Starting your download...';
    case 'error':
      return `❌ ${job.error || 'Download failed.'}`;
    case 'cancelled':
      return '⊘ Cancelled.';
    default:
      return '';
  }
};

const YouTubeDownloader = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [info, setInfo] = useState(null);
  const [quality, setQuality] = useState('best');
  const [infoState, setInfoState] = useState({ status: 'idle', error: '' });
  const [job, setJob] = useState(null);
  const [isFetchingFile, setIsFetchingFile] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const pollRef = useRef(null);
  const jobIdRef = useRef(null);
  const notificationRef = useRef(null);

  const { addHistory } = useToolHistory();
  useEffect(() => {
    addHistory('/tools/youtube-downloader', 'YouTube Downloader', 'utility');
  }, [addHistory]);

  const showNotificationBar = (message, duration = 7000) => {
    setShowNotification(message);
    if (notificationRef.current) clearTimeout(notificationRef.current);
    notificationRef.current = setTimeout(() => setShowNotification(false), duration);
  };

  const handleNotificationMouseLeave = () => {
    if (showNotification && notificationRef.current) {
      clearTimeout(notificationRef.current);
    }
    notificationRef.current = setTimeout(() => setShowNotification(false), 7000);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  const stopPolling = () => {
    clearInterval(pollRef.current);
    pollRef.current = null;
  };

  const triggerDownload = async (jobId) => {
    setIsFetchingFile(true);
    const { blob, filename } = await apiBlob(`/api/download/${jobId}/file`);
    const fileUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(fileUrl), 10000);
    setIsFetchingFile(false);
  };

  const startPolling = (jobId) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiJson(`/api/progress/${jobId}`);
        setJob((prev) => ({ ...prev, ...data }));

        if (data.status === 'ready') {
          stopPolling();
          try {
            await triggerDownload(jobId);
          } catch (err) {
            setJob((prev) => prev ? { ...prev, status: 'error', error: err.message } : prev);
          }
        } else if (data.status === 'error' || data.status === 'cancelled') {
          stopPolling();
        }
      } catch (err) {
        setJob((prev) => prev ? { ...prev, error: err.message } : prev);
      }
    }, POLL_INTERVAL);
  };

  const handleGetInfo = async (e) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;

    stopPolling();
    setInfo(null);
    setJob(null);
    setIsFetchingFile(false);
    setInfoState({ status: 'processing', error: '' });

    try {
      const data = await apiJson('/api/video-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      setInfo(data);
      setQuality(data.formats?.[0] || 'best');
      setInfoState({ status: 'success', error: '' });
    } catch (err) {
      setInfoState({ status: 'error', error: err.message || 'Could not fetch info. Check the URL.' });
    }
  };

  const handleDownload = async () => {
    if (!info) return;
    stopPolling();
    setIsFetchingFile(false);
    setJob({
      status: 'queued',
      progress: 0,
      percent: 0,
      speed: '',
      eta: '',
      error: '',
      position: 0,
      estimatedWait: 'Calculating...',
      message: '⏳ Your video is being prepared...',
    });

    try {
      const data = await apiJson('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          quality,
          title: info.title,
          duration: info.duration,
          formats: info.formats,
        }),
      });

      // Check if video was cached (instant delivery)
      if (data.cached) {
        showNotificationBar('✨ Video already cached! Starting download...', 3000);
        setJob({
          status: 'ready',
          progress: 100,
          percent: 100,
          cached: true,
          message: 'Ready to download (from cache)',
        });
        setTimeout(() => {
          const fileUrl = data.url;
          const a = document.createElement('a');
          a.href = fileUrl;
          a.download = info.title || 'video.mp4';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }, 500);
        return;
      }

      jobIdRef.current = data.jobId;
      startPolling(data.jobId);
    } catch (err) {
      setJob({ status: 'error', progress: 0, percent: 0, speed: '', eta: '', error: err.message });
      showNotificationBar('❌ Something went wrong. Please try again — your video may still be processing.', 5000);
    }
  };

  const handleCancel = async () => {
    stopPolling();
    const jobId = jobIdRef.current;
    setIsFetchingFile(false);
    setJob(null);
    if (jobId) {
      apiJson(`/api/download/${jobId}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const isDownloading = job && ['queued', 'starting', 'downloading', 'merging', 'retrying'].includes(job.status);
  const isError = job?.status === 'error';
  const isReady = job?.status === 'ready';
  const progress = job?.progress || job?.percent || 0;
  const canDownload = info && !isDownloading && !isFetchingFile;

  return (
    <div className="tool-container container">
      {showNotification && (
        <div
          className="ytd-notification-bar"
          onMouseEnter={() => {
            if (notificationRef.current) clearTimeout(notificationRef.current);
          }}
          onMouseLeave={handleNotificationMouseLeave}
        >
          {showNotification}
        </div>
      )}

      <div className="tool-header text-center animate-fade-in">
        <button className="ytd-back-btn" onClick={() => navigate(-1)} title="Go back">
          <ChevronLeft size={20} />
        </button>
        <h1>YouTube Downloader</h1>
        <p>Queue-friendly video downloads with audio merging, retries, and progress tracking.</p>
      </div>

      <div className="ytd-dev-notice">
        <AlertCircle size={16} />
        <span>🚧 Under Development — Performance may vary. Downloads may take several seconds.</span>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div className="ytd-intro">
          <div className="ytd-highlight">
            <Zap size={16} />
            <span>Only resolutions the video actually supports are shown. Audio is always merged.</span>
          </div>
          <div className="ytd-highlight">
            <ShieldCheck size={16} />
            <span>Queued automatically when traffic is high so downloads stay stable.</span>
          </div>
        </div>

        <form onSubmit={handleGetInfo} className="ytd-url-form">
          <div className="ytd-input-wrap glass-panel">
            <Link2 size={18} className="ytd-input-icon" />
            <input
              type="url"
              placeholder="Paste YouTube URL..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="ytd-input"
              required
            />
          </div>
          <button type="submit" className="btn-primary" disabled={infoState.status === 'processing'}>
            <Search size={16} />
            {infoState.status === 'processing' ? 'Fetching...' : 'Get Info'}
          </button>
        </form>

        {infoState.status === 'error' && (
          <div className="ytd-error-box">{infoState.error}</div>
        )}

        {info && (
          <div className="ytd-card glass-panel animate-fade-in">
            {info.thumbnail && (
              <img src={info.thumbnail} alt="Thumbnail" className="ytd-thumb" draggable={false} />
            )}
            <div className="ytd-meta">
              <p className="ytd-title">{info.title}</p>
              <div className="ytd-meta-row">
                {info.channel && <p className="ytd-channel">{info.channel}</p>}
                {info.duration > 0 && (
                  <p className="ytd-duration"><Clock size={13} /> {formatDuration(info.duration)}</p>
                )}
              </div>
              <div className="ytd-meta-note">
                Audio is merged into the final MP4 automatically before download starts.
              </div>
            </div>
          </div>
        )}

        {info && !isDownloading && !isReady && (
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
                    {formatQuality(fmt)}
                  </button>
                ))}
              </div>
            </div>
            {(quality === '4k' || quality === '8k') && (
              <div className="ytd-warning-note">
                <AlertCircle size={13} />
                <span>
                  ⚠️ You selected <strong>{formatQuality(quality)}</strong> — this requires downloading separate video and audio streams and merging them. Please be patient, this may take several minutes for the best quality result.
                </span>
              </div>
            )}
            <button onClick={handleDownload} className="btn-primary ytd-dl-btn" disabled={!canDownload}>
              <ArrowDown size={18} />
              {isFetchingFile ? 'Preparing...' : `Download ${formatQuality(quality)} MP4`}
            </button>
          </div>
        )}

        {job && (
          <div className={`ytd-progress-wrap animate-fade-in ${isError ? 'ytd-progress-error' : ''}`}>
            <div className="ytd-progress-head">
              <div>
                <p className="ytd-progress-kicker">Download Status</p>
                <p className={`ytd-status-label ${isError ? 'ytd-status-error' : isReady ? 'ytd-status-done' : ''}`}>
                  {statusLabel(job)}
                </p>
              </div>
              {!isError && (
                <div className={`ytd-status-chip ytd-chip-${job.status || 'queued'}`}>
                  {job.status === 'queued' ? 'Queued' : job.status === 'retrying' ? 'Retrying' : job.status === 'merging' ? 'Merging' : job.status === 'ready' ? 'Ready' : 'Active'}
                </div>
              )}
            </div>

            {!isError && (
              <div className="ytd-bar-track">
                <div
                  className={`ytd-bar-fill ${isReady ? 'ytd-bar-done' : ''}`}
                  style={{ width: `${isReady ? 100 : progress}%` }}
                />
              </div>
            )}

            {isDownloading && (
              <div className="ytd-warning-note">
                <AlertCircle size={13} />
                <span>⚠️ The progress bar may appear paused — your video is still processing in the background.</span>
              </div>
            )}

            <div className="ytd-job-grid">
              <div className="ytd-job-stat">
                <span>Queue position</span>
                <strong>{job.position > 0 ? `#${job.position}` : 'Live'}</strong>
              </div>
              <div className="ytd-job-stat">
                <span>Estimated wait</span>
                <strong>{formatWait(job.estimatedWait)}</strong>
              </div>
              <div className="ytd-job-stat">
                <span>Worker</span>
                <strong>{job.worker || 'Assigning...'}</strong>
              </div>
              <div className="ytd-job-stat">
                <span>Quality</span>
                <strong>{job.formatUsed ? formatQuality(job.formatUsed) : formatQuality(quality)}</strong>
              </div>
            </div>

            {job.message && (
              <div className="ytd-helper-note">
                <TimerReset size={14} />
                <span>{job.message}</span>
              </div>
            )}

            {isDownloading && (
              <button className="ytd-cancel-btn" onClick={handleCancel}>
                <X size={14} /> Cancel
              </button>
            )}

            {isError && (
              <button className="btn-secondary" style={{ marginTop: '0.75rem' }} onClick={() => setJob(null)}>
                Try Again
              </button>
            )}
          </div>
        )}

        <p className="ytd-disclaimer">
          For personal use only. Downloading copyrighted content without permission may violate
          YouTube's Terms of Service. Live streams, private, and age-restricted videos are not supported.
        </p>
      </div>

      {info && <AdPlaceholder className="mt-5" />}
    </div>
  );
};

export default YouTubeDownloader;
