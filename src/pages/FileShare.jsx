import React, { useState, useRef, useEffect } from 'react';
import styled from 'styled-components';
import { UploadCloud, Link as LinkIcon, Copy, Check, ExternalLink, Activity, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';

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
  const [isDragActive, setIsDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shortUrl, setShortUrl] = useState(null);
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

  const handleFile = async (selectedFile) => {
    setFile(selectedFile);
    setUploading(true);
    setError(null);
    setShortUrl(null);
    setProgress(20);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      // Simulate progress since fetch doesn't natively support upload progress well
      const interval = setInterval(() => {
        setProgress(p => Math.min(p + 10, 90));
      }, 200);

      const response = await fetch('/api/share/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(interval);
      setProgress(100);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setShortUrl(data.data.shortUrl);
    } catch (err) {
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
            or click to browse (Max 50MB)
          </p>
          <HiddenInput
            type="file"
            ref={inputRef}
            onChange={handleFileChange}
          />
        </DropZone>
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
          <Button to="/analytics">
            <BarChart2 size={18} /> View Analytics Dashboard
          </Button>
          <Button as="button" onClick={() => { setShortUrl(null); setFile(null); }} style={{ background: 'none', border: 'none', color: 'var(--primary-color)' }}>
            Upload another file
          </Button>
        </ResultCard>
      )}
    </Container>
  );
}
