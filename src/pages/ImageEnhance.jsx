import React, { useEffect, useState } from 'react';
import { ArrowDown, Wand2 } from 'lucide-react';
import FileUpload from '../components/shared/FileUpload';
import ProcessingState from '../components/shared/ProcessingState';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import { useFileValidation } from '../hooks/useFileValidation';
import { useToolHistory } from '../hooks/useToolHistory';
import { canvasToBlob, downloadBlob, loadImageFromFile, renameWithExtension, renderFilteredCanvas } from '../utils/imageTools';
import './ToolStyles.css';

const ImageEnhance = () => {
  const [file, setFile] = useState(null);
  const [sourceUrl, setSourceUrl] = useState('');
  const [resultBlob, setResultBlob] = useState(null);
  const [resultUrl, setResultUrl] = useState('');
  const [brightness, setBrightness] = useState(105);
  const [contrast, setContrast] = useState(108);
  const [saturation, setSaturation] = useState(115);
  const [sharpness, setSharpness] = useState(18);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/image/enhance', 'Image Enhance', 'image');
  }, [addHistory]);

  useEffect(() => () => {
    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);
  }, [sourceUrl, resultUrl]);

  const handleFilesSelected = (selectedFiles) => {
    const { validFiles, error } = validateFiles(selectedFiles, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFiles: 1,
      maxSizeMB: 25
    });

    setStatus('idle');
    setErrorMessage('');

    if (error) {
      setStatus('error');
      setErrorMessage(error);
      return;
    }

    if (!validFiles.length) return;

    if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    if (resultUrl) URL.revokeObjectURL(resultUrl);

    const nextFile = validFiles[0];
    setFile(nextFile);
    setSourceUrl(URL.createObjectURL(nextFile));
    setResultBlob(null);
    setResultUrl('');
  };

  const enhanceImage = async () => {
    if (!file) return;

    setStatus('processing');
    setErrorMessage('');

    try {
      const { image } = await loadImageFromFile(file);
      const canvas = renderFilteredCanvas({
        image,
        width: image.width,
        height: image.height,
        background: file.type === 'image/png' ? '#ffffff' : null,
        brightness,
        contrast,
        saturation,
        sharpness
      });
      const blob = await canvasToBlob(canvas, file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.95);
      const url = URL.createObjectURL(blob);

      if (resultUrl) URL.revokeObjectURL(resultUrl);

      setResultBlob(blob);
      setResultUrl(url);
      setStatus('success');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMessage('Unable to enhance this image.');
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>Image Enhance</h1>
        <p>Improve brightness, contrast, saturation, and sharpness with quick adjustment sliders.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        {!file ? (
          <FileUpload
            onFilesSelected={handleFilesSelected}
            accept="image/jpeg,image/png,image/webp"
            multiple={false}
            title="Click or drag to upload an image"
          />
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {[
                  ['Brightness', brightness, setBrightness, 50, 160],
                  ['Contrast', contrast, setContrast, 50, 180],
                  ['Saturation', saturation, setSaturation, 0, 200],
                  ['Sharpness', sharpness, setSharpness, 0, 100]
                ].map(([label, value, setter, min, max]) => (
                  <label key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span>{label}</span>
                      <strong>{value}%</strong>
                    </div>
                    <input type="range" min={min} max={max} value={value} onChange={(e) => setter(Number(e.target.value))} style={{ width: '100%' }} />
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Original</h3>
                <img src={sourceUrl} alt="Original" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '12px' }} />
              </div>

              <div className="glass-panel" style={{ padding: '1rem' }}>
                <h3 style={{ marginBottom: '0.75rem' }}>Enhanced</h3>
                {resultUrl ? (
                  <img src={resultUrl} alt="Enhanced" style={{ width: '100%', maxHeight: '320px', objectFit: 'contain', borderRadius: '12px' }} />
                ) : (
                  <div style={{ minHeight: '240px', display: 'grid', placeItems: 'center', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    Tune the adjustments, then enhance the image.
                  </div>
                )}
              </div>
            </div>

            <ProcessingState
              status={status}
              error={errorMessage}
              message={status === 'success' ? 'Enhanced image is ready.' : 'Enhancing image...'}
            />

            <div className="action-area text-center">
              <button onClick={enhanceImage} className="btn-primary">
                <Wand2 size={18} /> Enhance Image
              </button>
              {resultBlob && (
                <button
                  onClick={() => downloadBlob(resultBlob, renameWithExtension(file.name, file.type === 'image/png' ? 'enhanced.png' : 'enhanced.jpg'))}
                  className="btn-secondary"
                  style={{ marginLeft: '1rem' }}
                >
                  <ArrowDown size={18} /> Download
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {(file || resultBlob) && <AdPlaceholder className="mt-5" />}
    </div>
  );
};

export default ImageEnhance;
