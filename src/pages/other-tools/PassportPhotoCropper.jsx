import React, { useState, useRef, useEffect } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Upload, Download, RefreshCw, ChevronLeft, Crop, Maximize } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

const PASSPORT_SIZES = [
  { id: 'uk', name: 'UK/EU (35x45mm)', aspect: 35 / 45, width: 35, height: 45 },
  { id: 'us', name: 'US (2x2 inch)', aspect: 1, width: 2, height: 2 },
  { id: 'pk', name: 'Pakistan/India (3.5x4.5cm)', aspect: 3.5 / 4.5, width: 3.5, height: 4.5 },
];

export default function PassportPhotoCropper() {
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState();
  const [aspect, setAspect] = useState(35 / 45);
  const [completedCrop, setCompletedCrop] = useState();
  const imgRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);

  function onSelectFile(e) {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => setImgSrc(reader.result?.toString() || ''));
      reader.readAsDataURL(e.target.files[0]);
    }
  }

  function onImageLoad(e) {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop(
        { unit: '%', width: 90 },
        aspect,
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
  }

  const handleAspectChange = (newAspect) => {
    setAspect(newAspect);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const newCrop = centerCrop(
        makeAspectCrop(
          { unit: '%', width: 90 },
          newAspect,
          width,
          height
        ),
        width,
        height
      );
      setCrop(newCrop);
    }
  };

  const downloadCrop = async () => {
    if (!completedCrop || !imgRef.current) return;

    setIsProcessing(true);
    const canvas = document.createElement('canvas');
    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    // Minimum 600x600 as requested, or original crop size if larger
    const targetWidth = Math.max(600, completedCrop.width * scaleX);
    const targetHeight = targetWidth / aspect;

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      targetWidth,
      targetHeight
    );

    const base64Image = canvas.toDataURL('image/jpeg', 0.9);
    const link = document.createElement('a');
    link.download = 'passport-photo.jpg';
    link.href = base64Image;
    link.click();
    setIsProcessing(false);
    toast.success('Passport photo downloaded!');
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <Link to="/image-tools" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', textDecoration: 'none' }}>
        <ChevronLeft size={16} /> Back to Image Tools
      </Link>

      <ToolHeader 
        title="Passport Photo Cropper" 
        description="Crop your photos to official passport dimensions for UK, US, and other regions. All processing happens in your browser for 100% privacy."
      />

      {!imgSrc ? (
        <div 
          className="glass-panel" 
          style={{ 
            padding: '5rem 2rem', border: '2px dashed var(--border-color)', 
            textAlign: 'center', cursor: 'pointer'
          }}
          onClick={() => document.getElementById('photo-upload').click()}
        >
          <input type="file" id="photo-upload" hidden accept="image/*" onChange={onSelectFile} />
          <Upload size={48} color="var(--accent-primary)" style={{ marginBottom: '1.5rem' }} />
          <h3>Upload your photo to start cropping</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Supports JPG, PNG, and WebP</p>
        </div>
      ) : (
        <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '1rem', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', background: '#000' }}>
            <ReactCrop
              crop={crop}
              onChange={(c) => setCrop(c)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              style={{ maxHeight: '70vh' }}
            >
              <img
                ref={imgRef}
                alt="Crop me"
                src={imgSrc}
                onLoad={onImageLoad}
                style={{ maxWidth: '100%' }}
              />
            </ReactCrop>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Maximize size={18} /> Select Size
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {PASSPORT_SIZES.map((size) => (
                  <button
                    key={size.id}
                    onClick={() => handleAspectChange(size.aspect)}
                    style={{
                      padding: '1rem',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)',
                      background: aspect === size.aspect ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                      color: 'white',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: aspect === size.aspect ? '700' : '400',
                      transition: 'all 0.2s'
                    }}
                  >
                    {size.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <button 
                onClick={downloadCrop}
                disabled={!completedCrop || isProcessing}
                className="btn-primary" 
                style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
              >
                <Download size={20} /> {isProcessing ? 'Processing...' : 'Download JPG'}
              </button>
              <button 
                onClick={() => setImgSrc('')}
                className="btn-secondary" 
                style={{ width: '100%', padding: '1rem', marginTop: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
              >
                <RefreshCw size={18} /> Start Over
              </button>
            </div>

            <div className="glass-panel" style={{ padding: '1.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <h5 style={{ color: 'white', marginBottom: '0.5rem' }}>Tips for a good photo:</h5>
              <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <li>Even lighting on face</li>
                <li>Plain white or off-white background</li>
                <li>Directly face the camera</li>
                <li>No glasses or headwear</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <RelatedTools currentToolId="passport-photo" category="image" />
    </div>
  );
}
