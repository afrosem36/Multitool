import React, { useEffect, useState } from 'react';
import { ArrowDown, SlidersHorizontal } from 'lucide-react';
import FileUpload from '../../components/shared/FileUpload';
import ProcessingState from '../../components/shared/ProcessingState';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import { useFileValidation } from '../../hooks/useFileValidation';
import { useToolHistory } from '../../hooks/useToolHistory';
import { canvasToBlob, downloadBlob, loadImageFromFile, renameWithExtension, renderFilteredCanvas } from '../../utils/imageTools';
import '../styles/ToolStyles.css';

const ImageCompress = () => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [compressedBlob, setCompressedBlob] = useState(null);
  const [compressedUrl, setCompressedUrl] = useState('');
  const [quality, setQuality] = useState(75);
  const [scale, setScale] = useState(100);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/image/compress', 'Image Compress', 'image');
  }, [addHistory]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (compressedUrl) URL.revokeObjectURL(compressedUrl);
  }, [previewUrl, compressedUrl]);

  const resetResult = () => {
    if (compressedUrl) {
      URL.revokeObjectURL(compressedUrl);
    }
    setCompressedBlob(null);
    setCompressedUrl('');
    setStatus('idle');
    setErrorMessage('');
  };

  const handleFilesSelected = (selectedFiles) => {
    const { validFiles, error } = validateFiles(selectedFiles, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFiles: 1,
      maxSizeMB: 25
    });

    resetResult();

    if (error) {
      setStatus('error');
      setErrorMessage(error);
      return;
    }

    if (!validFiles.length) return;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    const nextFile = validFiles[0];
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const processCompression = async () => {
    if (!file) return;

    setStatus('processing');
    setErrorMessage('');

    try {
      const { image } = await loadImageFromFile(file);
      const width = Math.max(1, Math.round(image.width * (scale / 100)));
      const height = Math.max(1, Math.round(image.height * (scale / 100)));
      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const canvas = renderFilteredCanvas({ image, width, height });
      const blob = await canvasToBlob(canvas, outputType, quality / 100);
      const url = URL.createObjectURL(blob);

      if (compressedUrl) {
        URL.revokeObjectURL(compressedUrl);
      }

      setCompressedBlob(blob);
      setCompressedUrl(url);
      setStatus('success');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMessage('Unable to compress this image. Please try another file.');
    }
  };

  const handleDownload = () => {
    if (!compressedBlob || !file) return;

    const extension = file.type === 'image/png' ? 'png' : 'jpg';
    downloadBlob(compressedBlob, renameWithExtension(file.name, `compressed.${extension}`));
  };

  const savings =
    file && compressedBlob ? Math.max(0, Math.round((1 - compressedBlob.size / file.size) * 100)) : 0;

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>Image Compress</h1>
        <p>Compress JPG, PNG, or WebP images with adjustable quality and resize controls.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        {!file ? (
          <FileUpload
            onFilesSelected={handleFilesSelected}
            accept="image/jpeg,image/png,image/webp"
            multiple={false}
            title="Click or drag to upload an image"
            subtitle="Supports JPG, PNG, and WebP"
          />
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                <label>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Compression Quality</span>
                    <strong>{quality}%</strong>
                  </div>
                  <input type="range" min="20" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ width: '100%' }} />
                </label>

                <label>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Resize Scale</span>
                    <strong>{scale}%</strong>
                  </div>
                  <input type="range" min="25" max="100" value={scale} onChange={(e) => setScale(Number(e.target.value))} style={{ width: '100%' }} />
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Original</h3>
                <img src={previewUrl} alt="Original preview" style={{ width: '100%', borderRadius: '12px', maxHeight: '320px', objectFit: 'contain' }} />
                <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>

              <div className="glass-panel" style={{ padding: '1rem' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Compressed Preview</h3>
                {compressedUrl ? (
                  <>
                    <img src={compressedUrl} alt="Compressed preview" style={{ width: '100%', borderRadius: '12px', maxHeight: '320px', objectFit: 'contain' }} />
                    <p style={{ marginTop: '0.75rem', color: 'var(--text-secondary)' }}>
                      {(compressedBlob.size / 1024 / 1024).toFixed(2)} MB • {savings}% smaller
                    </p>
                  </>
                ) : (
                  <div style={{ minHeight: '240px', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)', textAlign: 'center' }}>
                    Move the adjust bars, then compress to generate a preview.
                  </div>
                )}
              </div>
            </div>

            <ProcessingState
              status={status}
              error={errorMessage}
              message={status === 'success' ? 'Compressed image is ready.' : 'Compressing image...'}
            />

            <div className="action-area text-center">
              <button onClick={processCompression} className="btn-primary">
                <SlidersHorizontal size={18} /> Compress Image
              </button>
              {compressedBlob && (
                <button onClick={handleDownload} className="btn-secondary" style={{ marginLeft: '1rem' }}>
                  <ArrowDown size={18} /> Download
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {(file || compressedBlob) && <AdPlaceholder className="mt-5" />}
    </div>
  );
};

export default ImageCompress;
