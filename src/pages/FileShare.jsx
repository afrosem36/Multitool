import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { UploadCloud, Link as LinkIcon, Copy, Check, ExternalLink, BarChart2, TimerReset } from 'lucide-react';
import { Link } from 'react-router-dom';

const MAX_FILE_SIZE = 250 * 1024 * 1024;
const ACCEPTED_FILE_TYPES = 'audio/*,video/*,.pdf,application/pdf';
const EXTENSION_FALLBACKS = ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg', '.oga', '.weba', '.mp4', '.m4v', '.mov', '.avi', '.mkv', '.wmv', '.webm', '.mpeg', '.mpg', '.3gp', '.pdf'];
const CUSTOM_UNITS = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
};

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const Header = styled.div`
  text-align: center;
  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    background: linear-gradient(to right, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  p {
    color: var(--text-secondary);
    font-size: 1.1rem;
  }
`;

const DropZone = styled.div`
  border: 2px dashed \${props => props.$isDragActive ? 'var(--primary-color)' : 'var(--border-color)'};
  border-radius: 1rem;
  padding: 4rem 2rem;
  text-align: center;
  background: \${props => props.$isDragActive ? 'rgba(96, 165, 250, 0.05)' : 'var(--surface-color)'};
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: var(--primary-color);
    background: rgba(96, 165, 250, 0.05);
  }
`;

const UploadIcon = styled(UploadCloud)`
  width: 48px;
  height: 48px;
  color: var(--primary-color);
  margin-bottom: 1rem;
`;

const HiddenInput = styled.input`
  display: none;
`;

const ResultCard = styled.div`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  animation: slideUp 0.3s ease;

  @keyframes slideUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const UrlBox = styled.div`
  display: flex;
  align-items: center;
  background: rgba(0,0,0,0.2);
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--border-color);

  .url {
    flex: 1;
    color: var(--text-primary);
    font-family: monospace;
    font-size: 1.1rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  button {
    background: none;
    border: none;
    color: var(--primary-color);
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;

    &:hover {
      background: rgba(96, 165, 250, 0.1);
    }
  }
`;

const ErrorBox = styled.div`
  padding: 1rem;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
  border-radius: 0.5rem;
  text-align: center;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 1rem;

  div {
    height: 100%;
    background: var(--primary-color);
    transition: width 0.3s ease;
  }
`;

const OptionCard = styled.div`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const SelectRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;

  label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-secondary);
    font-weight: 500;
  }

  select {
    min-width: 220px;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border-color);
    background: rgba(0,0,0,0.2);
    color: var(--text-primary);
    outline: none;
  }

  input {
    width: 140px;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border-color);
    background: rgba(0,0,0,0.2);
    color: var(--text-primary);
    outline: none;
  }
`;

const Button = styled(Link)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: 0.5rem;
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s;
  justify-content: center;

  &:hover {
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
`;

export default function FileShare() {
  const expiryOptions = [
    { value: 'never', label: 'Never expire', seconds: 0 },
    { value: '1h', label: '1 hour', seconds: 3600 },
    { value: '24h', label: '24 hours', seconds: 86400 },
    { value: '7d', label: '7 days', seconds: 604800 },
    { value: '30d', label: '30 days', seconds: 2592000 },
    { value: 'custom', label: 'Custom time', seconds: null },
  ];
  const [isDragActive, setIsDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shortUrl, setShortUrl] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [expiryOption, setExpiryOption] = useState('never');
  const [customDuration, setCustomDuration] = useState('30');
  const [customUnit, setCustomUnit] = useState('minutes');
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  
  const inputRef = useRef(null);

  const handleDragEnter = (e) => { e.preventDefault(); setIsDragActive(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragActive(false); };
  const handleDragOver = (e) => { e.preventDefault(); };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const getExpiryInSeconds = () => {
    const selected = expiryOptions.find((option) => option.value === expiryOption);
    if (!selected) return null;
    if (selected.value !== 'custom') return selected.seconds;

    const parsedDuration = Number(customDuration);
    if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
      return null;
    }

    return parsedDuration * CUSTOM_UNITS[customUnit];
  };

  const validateFile = (selectedFile) => {
    const isSupportedType = selectedFile.type.startsWith('audio/')
      || selectedFile.type.startsWith('video/')
      || selectedFile.type === 'application/pdf'
      || EXTENSION_FALLBACKS.some((extension) => selectedFile.name.toLowerCase().endsWith(extension));

    if (!isSupportedType) {
      return 'Only audio, video, and PDF files are supported.';
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      return 'File size exceeds the 250 MB limit.';
    }

    return null;
  };

  const uploadToSignedUrl = (uploadUrl, selectedFile) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', selectedFile.type || 'application/octet-stream');

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 90);
      setProgress(Math.max(percent, 5));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
        return;
      }
      reject(new Error('Direct upload to storage failed'));
    };

    xhr.onerror = () => reject(new Error('Direct upload to storage failed'));
    xhr.send(selectedFile);
  });

  const uploadThroughServer = async (selectedFile, expiresInSeconds) => {
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('expiresInSeconds', String(expiresInSeconds || 0));

    const response = await fetch('/api/share/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Upload failed');
    }

    return data.data;
  };

  const uploadDirectToR2 = async (selectedFile, expiresInSeconds) => {
    setProgress(5);
    const initResponse = await fetch('/api/share/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalName: selectedFile.name,
        mimeType: selectedFile.type || 'application/octet-stream',
        size: selectedFile.size,
        expiresInSeconds,
      }),
    });

    const initData = await initResponse.json();
    if (!initResponse.ok) {
      throw new Error(initData.error || 'Unable to prepare upload');
    }

    await uploadToSignedUrl(initData.data.uploadUrl, selectedFile);
    setProgress(95);

    const completeResponse = await fetch('/api/share/complete-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug: initData.data.slug,
        key: initData.data.key,
        originalName: selectedFile.name,
        mimeType: selectedFile.type || 'application/octet-stream',
        size: selectedFile.size,
        expiresInSeconds,
      }),
    });

    const completeData = await completeResponse.json();
    if (!completeResponse.ok) {
      throw new Error(completeData.error || 'Unable to finish upload');
    }

    return completeData.data;
  };

  const handleFile = async (selectedFile) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    const expiresInSeconds = getExpiryInSeconds();
    if (expiryOption === 'custom' && !expiresInSeconds) {
      setError('Enter a valid custom expiry time.');
      return;
    }

    setFile(selectedFile);
    setUploading(true);
    setError(null);
    setShortUrl(null);
    setExpiresAt(null);
    setProgress(0);

    try {
      const data = await uploadDirectToR2(selectedFile, expiresInSeconds);
      setProgress(100);
      setShortUrl(data.shortUrl);
      setExpiresAt(data.expiresAt || null);
    } catch (err) {
      try {
        if (window.location.hostname === 'localhost') {
          const fallbackData = await uploadThroughServer(selectedFile, expiresInSeconds);
          setProgress(100);
          setShortUrl(fallbackData.shortUrl);
          setExpiresAt(fallbackData.expiresAt || null);
          return;
        }
      } catch (fallbackError) {
        setError(fallbackError.message);
        return;
      }

      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!shortUrl) return;
    try {
      await navigator.clipboard.writeText(shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  return (
    <Container>
      <Header>
        <h1>File Sharing & URL Shortener</h1>
        <p>Securely upload files and generate a short URL instantly.</p>
      </Header>

      {!uploading && !shortUrl && (
        <>
          <OptionCard>
            <SelectRow>
              <label htmlFor="expiry-select">
                <TimerReset size={18} />
                Link expiry
              </label>
              <select id="expiry-select" value={expiryOption} onChange={(e) => setExpiryOption(e.target.value)}>
                {expiryOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              {expiryOption === 'custom' && (
                <>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={customDuration}
                    onChange={(e) => setCustomDuration(e.target.value)}
                    placeholder="Duration"
                  />
                  <select value={customUnit} onChange={(e) => setCustomUnit(e.target.value)}>
                    <option value="seconds">Seconds</option>
                    <option value="minutes">Minutes</option>
                    <option value="hours">Hours</option>
                    <option value="days">Days</option>
                  </select>
                </>
              )}
            </SelectRow>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              After expiry, visitors will see "Link expired" and be asked to contact the creator for access.
            </p>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Supports PDF, MP3, MP4, and most audio or video formats up to 250 MB.
            </p>
          </OptionCard>

          <DropZone
            $isDragActive={isDragActive}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon />
            <h3>Drag & Drop your file here</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              or click to browse audio, video, or PDF files (Max 250MB)
            </p>
            <HiddenInput
              type="file"
              ref={inputRef}
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileChange}
            />
          </DropZone>
        </>
      )}

      {uploading && (
        <ResultCard>
          <h3>Uploading {file?.name}...</h3>
          <ProgressBar>
            <div style={{ width: `${progress}%` }} />
          </ProgressBar>
        </ResultCard>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}

      {shortUrl && (
        <ResultCard>
          <h3>File Uploaded Successfully!</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Your secure short link is ready to share.</p>
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            {expiresAt ? `Expires on ${new Date(expiresAt).toLocaleString()}` : 'This link does not expire.'}
          </p>
          <UrlBox>
            <LinkIcon size={20} style={{ marginRight: '1rem', color: 'var(--text-secondary)' }} />
            <div className="url">{shortUrl}</div>
            <button onClick={copyToClipboard} title="Copy to clipboard">
              {copied ? <Check size={20} /> : <Copy size={20} />}
            </button>
            <a href={shortUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', marginLeft: '0.5rem' }}>
              <button title="Open link"><ExternalLink size={20} /></button>
            </a>
          </UrlBox>
          <Button to="/analytics?type=files">
            <BarChart2 size={18} /> View Analytics Dashboard
          </Button>
          <Button as="button" onClick={() => { setShortUrl(null); setFile(null); setExpiresAt(null); setProgress(0); }} style={{ background: 'none', border: 'none', color: 'var(--primary-color)' }}>
            Upload another file
          </Button>
        </ResultCard>
      )}
    </Container>
  );
}
