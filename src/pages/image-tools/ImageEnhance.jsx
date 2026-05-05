import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, Wand2, Zap, Settings2, Monitor } from 'lucide-react';
import FileUpload from '../../components/shared/FileUpload';
import ProcessingState from '../../components/shared/ProcessingState';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import BeforeAfterSlider from '../../components/shared/BeforeAfterSlider';
import { useFileValidation } from '../../hooks/useFileValidation';
import { useToolHistory } from '../../hooks/useToolHistory';
import { canvasToBlob, downloadBlob, loadImageFromFile, renameWithExtension } from '../../utils/imageTools';
import { analyzeImage, processEnhancement } from '../../utils/imageEnhancement';
import '../styles/ToolStyles.css';
import '../styles/ImageEnhance.css';

// ─── Slider row ───────────────────────────────────────────────────────────────

const SliderRow = ({ label, value, min, max, step = 0.01, onChange, hint }) => (
  <label className="ie-slider-row">
    <div className="ie-slider-meta">
      <span>{label}</span>
      <span className="ie-slider-val">{typeof value === 'number' && value % 1 !== 0 ? value.toFixed(2) : value}</span>
    </div>
    {hint && <div className="ie-slider-hint">{hint}</div>}
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))} />
  </label>
);

// ─── Analysis badge ───────────────────────────────────────────────────────────

const AnalysisBadge = ({ label, value, good, warn }) => {
  const cls = value <= warn ? 'ie-badge-warn' : value <= good ? 'ie-badge-ok' : 'ie-badge-good';
  return (
    <div className={`ie-badge ${cls}`}>
      <span className="ie-badge-label">{label}</span>
      <span className="ie-badge-value">{value.toFixed(1)}</span>
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const ImageEnhance = () => {
  const [file, setFile]           = useState(null);
  const [srcCanvas, setSrcCanvas] = useState(null);
  const [srcUrl, setSrcUrl]       = useState('');
  const [resultUrl, setResultUrl] = useState('');
  const [resultBlob, setResultBlob] = useState(null);
  const [status, setStatus]       = useState('idle');
  const [errorMsg, setErrorMsg]   = useState('');
  const [analysis, setAnalysis]   = useState(null);

  // Mode
  const [mode, setMode]           = useState('auto'); // 'auto' | 'manual'
  const [superRes, setSuperRes]   = useState(false);

  // Manual knobs
  const [sharpAmount, setSharpAmount]     = useState(1.5);
  const [sharpSigma,  setSharpSigma]      = useState(0.9);
  const [clarity,     setClarity]         = useState(0.3);
  const [noiseStr,    setNoiseStr]        = useState(0.3);
  const [brightness,  setBrightness]      = useState(1.0);
  const [contrast,    setContrast]        = useState(1.05);
  const [saturation,  setSaturation]      = useState(1.1);

  const prevSrcUrl    = useRef('');
  const prevResultUrl = useRef('');

  const { validateFiles } = useFileValidation();
  const { addHistory }    = useToolHistory();

  useEffect(() => { addHistory('/image/enhance', 'Image Enhance', 'image'); }, [addHistory]);

  useEffect(() => () => {
    if (prevSrcUrl.current)    URL.revokeObjectURL(prevSrcUrl.current);
    if (prevResultUrl.current) URL.revokeObjectURL(prevResultUrl.current);
  }, []);

  const handleFilesSelected = async (selectedFiles) => {
    const { validFiles, error } = validateFiles(selectedFiles, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxFiles: 1,
      maxSizeMB: 50,
    });
    setStatus('idle');
    setErrorMsg('');
    setResultUrl('');
    setResultBlob(null);
    setAnalysis(null);

    if (error) { setStatus('error'); setErrorMsg(error); return; }
    if (!validFiles.length) return;

    if (prevSrcUrl.current)    URL.revokeObjectURL(prevSrcUrl.current);
    if (prevResultUrl.current) URL.revokeObjectURL(prevResultUrl.current);

    const f = validFiles[0];
    setFile(f);

    try {
      const { image } = await loadImageFromFile(f);
      const c = document.createElement('canvas');
      c.width = image.width; c.height = image.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(image, 0, 0);
      setSrcCanvas(c);

      const url = URL.createObjectURL(f);
      setSrcUrl(url);
      prevSrcUrl.current = url;

      // Analyse in background
      const id   = ctx.getImageData(0, 0, c.width, c.height);
      const data = new Float32Array(id.data.length);
      for (let i = 0; i < id.data.length; i++) data[i] = id.data[i];
      setAnalysis(analyzeImage(data, c.width, c.height));
    } catch {
      setStatus('error');
      setErrorMsg('Could not load this image.');
    }
  };

  const handleEnhance = async () => {
    if (!srcCanvas) return;
    setStatus('processing');
    setErrorMsg('');

    try {
      const options = mode === 'auto'
        ? { mode: 'auto', superRes }
        : { mode: 'manual', sharpAmount, sharpSigma, clarity, noiseStrength: noiseStr,
            brightness, contrast, saturation, superRes };

      const enhanced = await processEnhancement(srcCanvas, options);
      const mimeType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      const blob     = await canvasToBlob(enhanced, mimeType, 0.97);
      const url      = URL.createObjectURL(blob);

      if (prevResultUrl.current) URL.revokeObjectURL(prevResultUrl.current);
      prevResultUrl.current = url;

      setResultUrl(url);
      setResultBlob(blob);
      setStatus('success');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setErrorMsg('Enhancement failed. Try a smaller image.');
    }
  };

  const handleDownload = () => {
    if (!resultBlob || !file) return;
    const ext = file.type === 'image/png' ? 'png' : 'jpg';
    downloadBlob(resultBlob, renameWithExtension(file.name, `enhanced.${ext}`));
  };

  const handleReset = () => {
    if (prevSrcUrl.current)    URL.revokeObjectURL(prevSrcUrl.current);
    if (prevResultUrl.current) URL.revokeObjectURL(prevResultUrl.current);
    setFile(null); setSrcCanvas(null); setSrcUrl('');
    setResultUrl(''); setResultBlob(null);
    setStatus('idle'); setErrorMsg(''); setAnalysis(null);
    prevSrcUrl.current = ''; prevResultUrl.current = '';
  };

  // ── Blur label ──────────────────────────────────────────────────────────────
  const blurLabel = () => {
    if (!analysis) return null;
    const s = analysis.blurScore;
    if (s < 4)  return 'Very blurry';
    if (s < 10) return 'Blurry';
    if (s < 20) return 'Moderate';
    return 'Sharp';
  };

  return (
    <div className="tool-container container">
      <div className="tool-header text-center animate-fade-in">
        <h1>Image Enhance</h1>
        <p>Real pixel-level sharpening, noise reduction, clarity and colour correction — adapts to each image.</p>
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
            {/* ── Image analysis strip ─────────────────────────────────────── */}
            {analysis && (
              <div className="ie-analysis">
                <AnalysisBadge label="Blur score"   value={analysis.blurScore} warn={4}  good={15} />
                <AnalysisBadge label="Brightness"   value={analysis.meanLum}  warn={60}  good={180} />
                <AnalysisBadge label="Contrast σ"   value={analysis.stdDev}   warn={20}  good={50} />
                <span className="ie-blur-label">{blurLabel()}</span>
              </div>
            )}

            {/* ── Mode tabs ────────────────────────────────────────────────── */}
            <div className="ie-tabs">
              <button className={`ie-tab ${mode === 'auto' ? 'active' : ''}`}
                onClick={() => setMode('auto')}>
                <Zap size={15} /> Auto Enhance
              </button>
              <button className={`ie-tab ${mode === 'manual' ? 'active' : ''}`}
                onClick={() => setMode('manual')}>
                <Settings2 size={15} /> Manual
              </button>
            </div>

            {/* ── Manual controls ──────────────────────────────────────────── */}
            {mode === 'manual' && (
              <div className="glass-panel ie-manual-panel">
                <div className="ie-manual-cols">
                  <div>
                    <p className="ie-group-title">Sharpening</p>
                    <SliderRow label="Amount"    value={sharpAmount} min={0}   max={4}   onChange={setSharpAmount}
                      hint="Strength of edge enhancement" />
                    <SliderRow label="Radius σ"  value={sharpSigma}  min={0.3} max={2.5} onChange={setSharpSigma}
                      hint="Smaller = fine detail, larger = broad edges" />
                    <SliderRow label="Clarity"   value={clarity}     min={0}   max={1}   onChange={setClarity}
                      hint="Mid-tone local contrast (like Lightroom Clarity)" />
                  </div>
                  <div>
                    <p className="ie-group-title">Tone &amp; Colour</p>
                    <SliderRow label="Noise reduction" value={noiseStr}   min={0} max={1} onChange={setNoiseStr}
                      hint="Edge-preserving smoothing" />
                    <SliderRow label="Brightness"      value={brightness} min={0.5} max={1.8} onChange={setBrightness} />
                    <SliderRow label="Contrast"        value={contrast}   min={0.7} max={1.8} onChange={setContrast} />
                    <SliderRow label="Saturation"      value={saturation} min={0.5} max={2.0} onChange={setSaturation} />
                  </div>
                </div>
              </div>
            )}

            {/* ── Super-res toggle ─────────────────────────────────────────── */}
            <label className="ie-toggle-row">
              <input type="checkbox" checked={superRes} onChange={(e) => setSuperRes(e.target.checked)} />
              <Monitor size={15} />
              <span>2× Super Resolution — upscale then sharpen at double size</span>
            </label>

            {/* ── Before / After slider ─────────────────────────────────────── */}
            {resultUrl ? (
              <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
                <BeforeAfterSlider beforeSrc={srcUrl} afterSrc={resultUrl} />
              </div>
            ) : (
              <div className="glass-panel ie-preview-placeholder" style={{ marginTop: '1.5rem' }}>
                <img src={srcUrl} alt="Original" style={{ width: '100%', maxHeight: '360px', objectFit: 'contain', borderRadius: '8px' }} />
              </div>
            )}

            <ProcessingState
              status={status}
              error={errorMsg}
              message={status === 'success' ? 'Enhancement complete — drag the slider to compare.' : 'Applying pixel-level enhancement…'}
            />

            {/* ── Actions ───────────────────────────────────────────────────── */}
            <div className="action-area text-center" style={{ gap: '0.75rem', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
              <button onClick={handleEnhance} className="btn-primary" disabled={status === 'processing'}>
                <Wand2 size={18} /> {mode === 'auto' ? 'Auto Enhance' : 'Enhance Image'}
              </button>
              {resultBlob && (
                <button onClick={handleDownload} className="btn-secondary">
                  <ArrowDown size={18} /> Download
                </button>
              )}
              <button onClick={handleReset} className="btn-secondary" style={{ opacity: 0.7 }}>
                New Image
              </button>
            </div>
          </>
        )}
      </div>

      {file && <AdPlaceholder className="mt-5" />}
    </div>
  );
};

export default ImageEnhance;
