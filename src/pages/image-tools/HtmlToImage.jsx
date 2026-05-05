import React, { useEffect, useState } from 'react';
import { ArrowDown, FileImage } from 'lucide-react';
import ProcessingState from '../../components/shared/ProcessingState';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import { useToolHistory } from '../../hooks/useToolHistory';
import { canvasToBlob, downloadBlob } from '../../utils/imageTools';
import '../styles/ToolStyles.css';

const starterHtml = `<div style="font-family: Georgia, serif; background: linear-gradient(135deg, #fde68a, #f97316); color: #111827; padding: 32px; border-radius: 24px;">
  <p style="letter-spacing: 0.18em; text-transform: uppercase; font-size: 12px; margin: 0 0 12px;">HTML to Image</p>
  <h1 style="font-size: 42px; margin: 0 0 12px;">Design a quick social card</h1>
  <p style="font-size: 18px; line-height: 1.6; margin: 0;">Use inline HTML and CSS, then export the block as a PNG or JPG image.</p>
</div>`;

const HtmlToImage = () => {
  const [html, setHtml] = useState(starterHtml);
  const [width, setWidth] = useState(1080);
  const [background, setBackground] = useState('#ffffff');
  const [format, setFormat] = useState('png');
  const [previewUrl, setPreviewUrl] = useState('');
  const [resultBlob, setResultBlob] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/image/html-to-image', 'HTML to Image', 'image');
  }, [addHistory]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const generateImage = async () => {
    setStatus('processing');
    setErrorMessage('');

    try {
      const mount = document.createElement('div');
      mount.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      mount.style.position = 'fixed';
      mount.style.left = '-10000px';
      mount.style.top = '0';
      mount.style.width = `${width}px`;
      mount.style.padding = '24px';
      mount.style.background = background;
      mount.style.boxSizing = 'border-box';
      mount.innerHTML = html;
      document.body.appendChild(mount);

      const height = Math.max(200, mount.scrollHeight);
      const serialized = new XMLSerializer().serializeToString(mount);
      document.body.removeChild(mount);

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
          <foreignObject width="100%" height="100%">${serialized}</foreignObject>
        </svg>
      `;

      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const svgUrl = URL.createObjectURL(svgBlob);

      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = svgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0);

      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const blob = await canvasToBlob(canvas, mimeType, 0.95);
      const url = URL.createObjectURL(blob);

      URL.revokeObjectURL(svgUrl);
      if (previewUrl) URL.revokeObjectURL(previewUrl);

      setResultBlob(blob);
      setPreviewUrl(url);
      setStatus('success');
    } catch (error) {
      console.error(error);
      setStatus('error');
      setErrorMessage('Could not render that HTML. Inline styles usually work best here.');
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '1000px' }}>
      <div className="tool-header text-center animate-fade-in">
        <h1>HTML to Image</h1>
        <p>Render HTML and inline CSS into a downloadable PNG or JPG image.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1rem' }}>
          <label>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span>Canvas Width</span>
              <strong>{width}px</strong>
            </div>
            <input type="range" min="400" max="1600" step="20" value={width} onChange={(e) => setWidth(Number(e.target.value))} style={{ width: '100%' }} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span>Background</span>
            <input type="color" value={background} onChange={(e) => setBackground(e.target.value)} style={{ width: '100%', minHeight: '44px', borderRadius: '12px' }} />
          </label>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <span>Format</span>
            <select value={format} onChange={(e) => setFormat(e.target.value)} style={{ padding: '0.75rem', borderRadius: '12px' }}>
              <option value="png">PNG</option>
              <option value="jpg">JPG</option>
            </select>
          </label>
        </div>

        <textarea
          value={html}
          onChange={(e) => setHtml(e.target.value)}
          spellCheck="false"
          style={{
            width: '100%',
            minHeight: '280px',
            borderRadius: '16px',
            padding: '1rem',
            marginBottom: '1rem',
            background: 'rgba(15, 23, 42, 0.15)',
            color: 'var(--text-primary)',
            border: '1px solid rgba(148, 163, 184, 0.25)'
          }}
        />

        <ProcessingState
          status={status}
          error={errorMessage}
          message={status === 'success' ? 'Image export is ready.' : 'Rendering HTML to image...'}
        />

        <div className="action-area text-center">
          <button onClick={generateImage} className="btn-primary">
            <FileImage size={18} /> Generate Image
          </button>
          {resultBlob && (
            <button onClick={() => downloadBlob(resultBlob, `html-export.${format}`)} className="btn-secondary" style={{ marginLeft: '1rem' }}>
              <ArrowDown size={18} /> Download
            </button>
          )}
        </div>

        {previewUrl && (
          <div className="glass-panel" style={{ padding: '1rem', marginTop: '1.5rem' }}>
            <img src={previewUrl} alt="Generated HTML preview" style={{ width: '100%', borderRadius: '12px' }} />
          </div>
        )}
      </div>

      {(previewUrl || resultBlob) && <AdPlaceholder className="mt-5" />}
    </div>
  );
};

export default HtmlToImage;
