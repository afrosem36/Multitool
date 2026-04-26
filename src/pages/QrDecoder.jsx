import React, { useState, useEffect, useRef } from 'react';
import { ScanLine, ArrowLeft, Upload, Copy, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import jsQR from 'jsqr';
import './ToolStyles.css';

const QrDecoder = () => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [decodedText, setDecodedText] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [useCamera, setUseCamera] = useState(false);
  
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const isScanning = useRef(false);
  const streamRef = useRef(null);
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/utilities/qr-decoder', 'QR Code Decoder', 'scanLine');
    return () => {
      stopCamera();
    };
  }, [addHistory]);

  const stopCamera = () => {
    isScanning.current = false;
    if (streamRef.current) {
      const tracks = streamRef.current.getTracks();
      tracks.forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
    setUseCamera(false);
  };

  useEffect(() => {
    if (!useCamera || !videoRef.current || !streamRef.current) return;

    const video = videoRef.current;
    video.srcObject = streamRef.current;
    video.setAttribute('playsinline', 'true');
    video.muted = true;
    video.autoplay = true;

    const startScan = async () => {
      try {
        await video.play();
        requestAnimationFrame(tick);
      } catch (playError) {
        console.error(playError);
        setError('Camera access was granted, but the preview could not start.');
      }
    };

    if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
      startScan();
    } else {
      video.onloadedmetadata = startScan;
    }

    return () => {
      if (video) {
        video.onloadedmetadata = null;
      }
    };
  }, [useCamera]);

  const startCamera = async () => {
    setFile(null);
    setPreview('');
    setDecodedText('');
    setError('');
    setCopied(false);
    
    try {
      let stream;
      try {
        // Attempt to get the rear camera with ideal high resolution
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (err) {
        console.warn("Primary camera request failed, attempting fallback...", err);
        // Fallback to any available camera if the specific constraints fail
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }
      streamRef.current = stream;
      setUseCamera(true);
      isScanning.current = true;
    } catch (err) {
      console.error("Camera access failed completely:", err);
      setError('Unable to access camera. Please ensure permissions are granted in your browser settings.');
    }
  };

  const tick = () => {
    if (!isScanning.current) return;
    
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvasElement = canvasRef.current;
      if (!canvasElement) return;
      const canvas = canvasElement.getContext("2d");
      
      canvasElement.height = videoRef.current.videoHeight;
      canvasElement.width = videoRef.current.videoWidth;
      
      canvas.drawImage(videoRef.current, 0, 0, canvasElement.width, canvasElement.height);
      const imageData = canvas.getImageData(0, 0, canvasElement.width, canvasElement.height);
      
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
      });
      
      if (code && code.data) {
        setDecodedText(code.data);
        stopCamera();
        return;
      }
    }
    
    if (isScanning.current) {
      requestAnimationFrame(tick);
    }
  };

  const decodeQRFromFile = (selectedFile) => {
    setIsDecoding(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvasElement = document.createElement("canvas");
        const canvas = canvasElement.getContext("2d");
        
        let width = img.width;
        let height = img.height;
        const maxDimension = 1000;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        
        canvasElement.width = width;
        canvasElement.height = height;
        canvas.drawImage(img, 0, 0, width, height);
        
        const imageData = canvas.getImageData(0, 0, width, height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });
        
        if (code && code.data) {
          setDecodedText(code.data);
        } else {
          setError('No QR code found in this image. Try another image or scan with the camera.');
        }
        setIsDecoding(false);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(selectedFile);
  };
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      stopCamera();
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setDecodedText('');
      setError('');
      setCopied(false);
      decodeQRFromFile(selectedFile);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      stopCamera();
      if (preview) {
        URL.revokeObjectURL(preview);
      }
      setFile(droppedFile);
      setPreview(URL.createObjectURL(droppedFile));
      setDecodedText('');
      setError('');
      setCopied(false);
      decodeQRFromFile(droppedFile);
    } else {
      setError('Please upload a valid image file.');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview);
      }
    };
  }, [preview]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(decodedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <Link to="/utilities" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Utilities
      </Link>
      
      <div className="tool-header text-center animate-fade-in">
        <ScanLine size={48} className="text-gradient mx-auto mb-4" />
        <h1>QR Code Decoder</h1>
        <p>Upload a QR code image to quickly extract and read its hidden data.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '2rem' }}>
          {!useCamera ? (
            <button onClick={startCamera} className="btn-primary" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.1) 100%)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <ScanLine size={20} /> Scan with Camera
            </button>
          ) : (
            <button onClick={stopCamera} className="btn-secondary" style={{ width: '100%' }}>
              Stop Camera
            </button>
          )}
        </div>

        {useCamera && (
          <div style={{ marginBottom: '2rem', position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '2px solid rgba(16, 185, 129, 0.5)' }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', display: 'block', minHeight: '280px', background: '#000' }}></video>
            <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.2)', pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '200px', height: '200px', border: '2px dashed rgba(16, 185, 129, 0.8)', borderRadius: '12px' }}></div>
            </div>
          </div>
        )}

        <div 
          className="upload-area" 
          onDrop={handleDrop} 
          onDragOver={handleDragOver}
          onClick={() => fileInputRef.current.click()}
          style={{ cursor: 'pointer', border: '2px dashed rgba(255,255,255,0.2)', padding: '2rem', borderRadius: '12px', textAlign: 'center', marginBottom: '2rem', transition: 'all 0.3s ease' }}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
          <Upload size={36} style={{ color: 'var(--text-secondary)', marginBottom: '1rem', margin: '0 auto' }} />
          <h3 style={{ marginBottom: '0.5rem', fontSize: '1.2rem' }}>Upload QR Image</h3>
          <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Drag & drop or click to browse</p>
        </div>

        {preview && !useCamera && (
          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
            <img src={preview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} />
          </div>
        )}

        {isDecoding && (
          <div style={{ textAlign: 'center', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
            <p>Decoding image...</p>
          </div>
        )}

        {error && (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', borderRadius: '4px', marginBottom: '1.5rem' }}>
            <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
          </div>
        )}

        {decodedText && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, color: '#10b981' }}>Decoded Result:</h3>
              <button onClick={copyToClipboard} className="btn-secondary" style={{ padding: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {copied ? <CheckCircle size={16} color="#10b981" /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', wordBreak: 'break-all' }}>
              <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: '1.5' }}>{decodedText}</p>
            </div>
          </div>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default QrDecoder;
