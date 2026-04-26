import React, { useState, useRef } from 'react';
import styled from 'styled-components';
import { Upload, Download, Trash2, Settings, Loader2, Image as ImageIcon } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import heic2any from 'heic2any';

const Container = styled.div`
  max-width: 1000px;
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
    background: linear-gradient(to right, #ec4899, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  p { color: var(--text-secondary); font-size: 1.1rem; }
`;

const DropZone = styled.div`
  border: 2px dashed ${props => props.$active ? 'var(--primary-color)' : 'var(--border-color)'};
  border-radius: 1rem;
  padding: 4rem 2rem;
  text-align: center;
  background: ${props => props.$active ? 'rgba(236, 72, 153, 0.05)' : 'var(--surface-color)'};
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    border-color: var(--primary-color);
    background: rgba(236, 72, 153, 0.05);
  }
`;

const FileGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
`;

const FileCard = styled.div`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
  overflow: hidden;

  .thumbnail-container {
    width: 100%;
    height: 150px;
    background: rgba(0,0,0,0.1);
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;

    img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;

    .name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stats {
      font-size: 0.85rem;
      color: var(--text-secondary);
      display: flex;
      justify-content: space-between;
    }
  }

  .status {
    position: absolute;
    top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,0,0,0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 10;
    
    .progress-bar {
      width: 80%;
      height: 6px;
      background: rgba(255,255,255,0.2);
      border-radius: 3px;
      margin-top: 1rem;
      overflow: hidden;

      div {
        height: 100%;
        background: var(--primary-color);
        transition: width 0.3s;
      }
    }
  }
`;

const Controls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  flex-wrap: wrap;
  gap: 1rem;

  .quality {
    display: flex;
    align-items: center;
    gap: 1rem;
    
    input { width: 100px; }
  }
`;

const Button = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: ${props => props.$primary ? 'var(--primary-color)' : 'var(--surface-color)'};
  color: ${props => props.$primary ? 'white' : 'var(--text-primary)'};
  border: 1px solid ${props => props.$primary ? 'transparent' : 'var(--border-color)'};
  border-radius: 0.5rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    opacity: 0.9;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Badge = styled.span`
  background: ${props => props.$error ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'};
  color: ${props => props.$error ? '#ef4444' : '#10b981'};
  padding: 0.25rem 0.5rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: 600;
  margin-left: 0.5rem;
`;

export default function HeicConverter() {
  const [files, setFiles] = useState([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [quality, setQuality] = useState(90);
  const [converting, setConverting] = useState(false);
  
  const inputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setIsDragActive(true);
    else if (e.type === 'dragleave') setIsDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = (newFiles) => {
    if (files.length + newFiles.length > 20) {
      alert("Maximum 20 files allowed at once.");
      newFiles = newFiles.slice(0, 20 - files.length);
    }
    
    const mapped = newFiles.map(f => {
      const isHeic = f.type === 'image/heic' || f.type === 'image/heif' || f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif');
      const isLarge = f.size > 50 * 1024 * 1024;
      
      return {
        id: Math.random().toString(36).substr(2, 9),
        originalFile: f,
        name: f.name,
        size: f.size,
        isHeic,
        isLarge,
        status: isHeic ? 'pending' : 'error',
        errorMsg: isHeic ? (isLarge ? 'Warning: >50MB' : null) : 'Not HEIC',
        convertedBlob: null,
        convertedUrl: null,
        convertedSize: null,
        progress: 0
      };
    });
    setFiles(prev => [...prev, ...mapped]);
  };

  const removeFile = (id) => {
    setFiles(prev => {
      const f = prev.find(x => x.id === id);
      if (f && f.convertedUrl) URL.revokeObjectURL(f.convertedUrl);
      return prev.filter(x => x.id !== id);
    });
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024, dm = 2, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const convertFile = async (fileObj) => {
    setFiles(prev => prev.map(f => f.id === fileObj.id ? { ...f, status: 'converting', progress: 10 } : f));
    
    try {
      // Simulate progress since heic2any doesn't provide real progress hooks natively
      const interval = setInterval(() => {
        setFiles(prev => prev.map(f => {
          if (f.id === fileObj.id && f.progress < 90) return { ...f, progress: f.progress + 10 };
          return f;
        }));
      }, 500);

      const resultBlob = await heic2any({
        blob: fileObj.originalFile,
        toType: 'image/jpeg',
        quality: quality / 100
      });

      clearInterval(interval);

      // Handle multi-frame HEIC (returns array of blobs)
      const finalBlob = Array.isArray(resultBlob) ? resultBlob[0] : resultBlob;
      const url = URL.createObjectURL(finalBlob);

      setFiles(prev => prev.map(f => f.id === fileObj.id ? { 
        ...f, 
        status: 'done', 
        progress: 100,
        convertedBlob: finalBlob,
        convertedUrl: url,
        convertedSize: finalBlob.size
      } : f));

    } catch (err) {
      console.error(err);
      setFiles(prev => prev.map(f => f.id === fileObj.id ? { 
        ...f, 
        status: 'error', 
        errorMsg: 'Conversion failed'
      } : f));
    }
  };

  const convertAll = async () => {
    setConverting(true);
    const pending = files.filter(f => f.status === 'pending');
    
    // Process sequentially to not freeze browser completely
    for (const file of pending) {
      await convertFile(file);
    }
    setConverting(false);
  };

  const downloadAll = async () => {
    const doneFiles = files.filter(f => f.status === 'done' && f.convertedBlob);
    if (doneFiles.length === 0) return;

    if (doneFiles.length === 1) {
      saveAs(doneFiles[0].convertedBlob, doneFiles[0].name.replace(/\.hei[cf]$/i, '.jpg'));
      return;
    }

    const zip = new JSZip();
    doneFiles.forEach(f => {
      zip.file(f.name.replace(/\.hei[cf]$/i, '.jpg'), f.convertedBlob);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'converted-images.zip');
  };

  return (
    <Container>
      <Header>
        <h1>HEIC to JPG Converter</h1>
        <p>Convert Apple HEIC/HEIF photos to JPG entirely in your browser securely.</p>
      </Header>

      <DropZone
        $active={isDragActive}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={48} style={{ color: 'var(--primary-color)', marginBottom: '1rem' }} />
        <h3>Drop HEIC files here</h3>
        <p style={{ color: 'var(--text-secondary)' }}>(Up to 20 files at once)</p>
        <input 
          type="file" 
          multiple 
          accept=".heic,.heif,image/heic,image/heif" 
          style={{ display: 'none' }}
          ref={inputRef}
          onChange={(e) => addFiles(Array.from(e.target.files))}
        />
      </DropZone>

      {files.length > 0 && (
        <>
          <Controls>
            <div className="quality">
              <Settings size={20} color="var(--text-secondary)" />
              <label>JPG Quality: {quality}%</label>
              <input 
                type="range" 
                min="60" max="100" 
                value={quality} 
                onChange={e => setQuality(Number(e.target.value))}
                disabled={converting || files.some(f => f.status === 'converting')}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <Button onClick={() => setFiles([])} disabled={converting}>
                <Trash2 size={18} /> Clear All
              </Button>
              <Button $primary onClick={convertAll} disabled={converting || files.every(f => f.status !== 'pending')}>
                {converting ? <Loader2 size={18} className="spin" /> : <Settings size={18} />} 
                {converting ? 'Converting...' : 'Convert All'}
              </Button>
              <Button onClick={downloadAll} disabled={!files.some(f => f.status === 'done')} style={{ borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}>
                <Download size={18} /> Download ZIP
              </Button>
            </div>
          </Controls>

          <FileGrid>
            {files.map(file => (
              <FileCard key={file.id}>
                {file.status === 'converting' && (
                  <div className="status">
                    <Loader2 size={32} className="spin" />
                    <p style={{ marginTop: '1rem' }}>Converting...</p>
                    <div className="progress-bar"><div style={{ width: `${file.progress}%` }}/></div>
                  </div>
                )}
                
                <div className="thumbnail-container">
                  {file.convertedUrl ? (
                    <img src={file.convertedUrl} alt={file.name} />
                  ) : (
                    <ImageIcon size={48} color="var(--text-secondary)" opacity={0.5} />
                  )}
                </div>
                
                <div className="info">
                  <div className="name" title={file.name}>
                    {file.name}
                    {file.status === 'error' && <Badge $error>{file.errorMsg}</Badge>}
                  </div>
                  <div className="stats">
                    <span>{formatSize(file.size)} {file.convertedSize && `→ ${formatSize(file.convertedSize)}`}</span>
                    {file.convertedSize && (
                      <span style={{ color: 'var(--primary-color)' }}>
                        {(`-${Math.round((1 - (file.convertedSize / file.size)) * 100)}%`)}
                      </span>
                    )}
                  </div>
                </div>

                <button 
                  onClick={() => removeFile(file.id)}
                  style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <Trash2 size={14} />
                </button>
              </FileCard>
            ))}
          </FileGrid>
        </>
      )}
    </Container>
  );
}
