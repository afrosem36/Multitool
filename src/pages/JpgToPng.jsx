import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowRightLeft } from 'lucide-react';
import FileUpload from '../components/shared/FileUpload';
import ProcessingState from '../components/shared/ProcessingState';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import { useFileValidation } from '../hooks/useFileValidation';
import { useToolHistory } from '../hooks/useToolHistory';
import { canvasToBlob, downloadBlob, loadImageFromFile, renameWithExtension, renderFilteredCanvas } from '../utils/imageTools';
import './ToolStyles.css';

const JpgToPng = () => {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [resultBlob, setResultBlob] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { validateFiles } = useFileValidation();
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/image/jpg-to-png', 'JPG to PNG', 'image');
  }, [addHistory]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleFilesSelected = (selectedFiles) => {
    const { validFiles, error } = validateFiles(selectedFiles, {
      allowedTypes: ['image/jpeg'],
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
      const canvas = renderFilteredCanvas({ image });
      const blob = await canvasToBlob(canvas, 'image/png');
      setResultBlob(blob);
      setStatus('success');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMessage('Unable to convert this JPG file.');
    }
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>JPG to PNG</h1>
        <p>Convert JPEG images into PNG format right in your browser.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        {!file ? (
          <FileUpload
            onFilesSelected={handleFilesSelected}
            accept="image/jpeg"
            multiple={false}
            title="Click or drag to upload a JPG file"
          />
        ) : (
          <>
            <div className="glass-panel" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
              <img src={previewUrl} alt="JPG preview" style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '12px' }} />
            </div>

            <ProcessingState
              status={status}
              error={errorMessage}
              message={status === 'success' ? 'PNG file is ready.' : 'Converting JPG to PNG...'}
            />

            <div className="action-area text-center">
              <button onClick={convert} className="btn-primary">
                <ArrowRightLeft size={18} /> Convert to PNG
              </button>
              {resultBlob && (
                <button onClick={() => downloadBlob(resultBlob, renameWithExtension(file.name, 'png'))} className="btn-secondary" style={{ marginLeft: '1rem' }}>
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

export default JpgToPng;
