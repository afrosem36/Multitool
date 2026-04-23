import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowRightLeft } from 'lucide-react';
import FileUpload from '../components/shared/FileUpload';
import ProcessingState from '../components/shared/ProcessingState';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import { useFileValidation } from '../hooks/useFileValidation';
import { useToolHistory } from '../hooks/useToolHistory';
import { canvasToBlob, downloadBlob, loadImageFromFile, renameWithExtension, renderFilteredCanvas } from '../utils/imageTools';
import './ToolStyles.css';

const PngToJpg = () => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [background, setBackground] = useState('#ffffff');
  const [quality, setQuality] = useState(92);
  const [resultBlob, setResultBlob] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/image/png-to-jpg', 'PNG to JPG', 'image');
  }, [addHistory]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFilesSelected = (selectedFiles) => {
    const { validFiles, error } = validateFiles(selectedFiles, {
      allowedTypes: ['image/png'],
      maxFiles: 1,
      maxSizeMB: 25
    });

    setStatus('idle');
    setErrorMessage('');
    setResultBlob(null);

    if (error) {
      setStatus('error');
      setErrorMessage(error);
      return;
    }

    if (!validFiles.length) return;

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextFile = validFiles[0];
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
  };

  const convert = async () => {
    if (!file) return;

    setStatus('processing');

    try {
      const { image } = await loadImageFromFile(file);
      const canvas = renderFilteredCanvas({ image, background });
      const blob = await canvasToBlob(canvas, 'image/jpeg', quality / 100);
      setResultBlob(blob);
      setStatus('success');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMessage('Unable to convert this PNG file.');
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>PNG to JPG</h1>
        <p>Convert PNG images to JPG and choose the background color used behind transparent areas.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        {!file ? (
          <FileUpload
            onFilesSelected={handleFilesSelected}
            accept="image/png"
            multiple={false}
            title="Click or drag to upload a PNG file"
          />
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span>Background Color</span>
                  <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} style={{ width: '100%', minHeight: '44px', borderRadius: '12px' }} />
                </label>

                <label>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>JPG Quality</span>
                    <strong>{quality}%</strong>
                  </div>
                  <input type="range" min="60" max="100" value={quality} onChange={(e) => setQuality(Number(e.target.value))} style={{ width: '100%' }} />
                </label>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
              <img src={previewUrl} alt="PNG preview" style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '12px' }} />
            </div>

            <ProcessingState
              status={status}
              error={errorMessage}
              message={status === 'success' ? 'JPG file is ready.' : 'Converting PNG to JPG...'}
            />

            <div className="action-area text-center">
              <button onClick={convert} className="btn-primary">
                <ArrowRightLeft size={18} /> Convert to JPG
              </button>
              {resultBlob && (
                <button onClick={() => downloadBlob(resultBlob, renameWithExtension(file.name, 'jpg'))} className="btn-secondary" style={{ marginLeft: '1rem' }}>
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

export default PngToJpg;
