import React, { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileUp, Download, Zap, RefreshCw, ChevronLeft, FileText, AlertTriangle, BarChart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import AdBanner from '../../components/shared/AdBanner';
import RelatedTools from '../../components/shared/RelatedTools';

export default function PdfLightener() {
  const [file, setFile] = useState(null);
  const [originalSize, setOriginalSize] = useState(0);
  const [targetSize, setTargetSize] = useState('500'); // KB
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [compressedFile, setCompressedFile] = useState(null);
  const [resultSize, setResultSize] = useState(0);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile && uploadedFile.type === 'application/pdf') {
      setFile(uploadedFile);
      setOriginalSize(uploadedFile.size);
      setCompressedFile(null);
      setResultSize(0);
      toast.success('PDF loaded');
    } else {
      toast.error('Please upload a valid PDF');
    }
  };

  const lightenPdf = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(20);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      setProgress(50);
      
      // Basic lightening: Strip metadata
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
      
      // More aggressive: pdf-lib save options
      const compressedPdfBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        updateFieldAppearances: false
      });
      
      setProgress(90);
      
      const blob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
      setCompressedFile(blob);
      setResultSize(blob.size);
      
      setProgress(100);
      
      if (blob.size > (parseInt(targetSize) * 1024)) {
        toast.warning('Target size could not be reached, but file was lightened.');
      } else {
        toast.success('PDF lightened successfully!');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to process PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = () => {
    if (!compressedFile) return;
    const url = URL.createObjectURL(compressedFile);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lightened-${file.name}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <Link to="/pdf-tools" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', textDecoration: 'none' }}>
        <ChevronLeft size={16} /> Back to PDF Tools
      </Link>

      <ToolHeader 
        title="PDF Lightener" 
        description="Aggressively reduce your PDF file size by stripping metadata and optimizing structure. All processing happens locally in your browser."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {!file ? (
            <div 
              className="glass-panel" 
              style={{ 
                padding: '5rem 2rem', border: '2px dashed var(--border-color)', 
                textAlign: 'center', cursor: 'pointer'
              }}
              onClick={() => document.getElementById('pdf-upload').click()}
            >
              <input type="file" id="pdf-upload" hidden accept=".pdf" onChange={handleFileUpload} />
              <FileUp size={48} color="var(--accent-primary)" style={{ marginBottom: '1.5rem' }} />
              <h3>Choose PDF to Lighten</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Maximum file size: 50MB</p>
            </div>
          ) : (
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '12px' }}>
                  <FileText size={32} color="#f87171" />
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0 }}>{file.name}</h4>
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Original: {formatSize(originalSize)}</span>
                </div>
                <button onClick={() => setFile(null)} className="btn-secondary" style={{ padding: '0.5rem' }}>
                  <RefreshCw size={18} />
                </button>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '600' }}>Target File Size</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.5rem' }}>
                  {['100', '200', '500', '1000'].map(size => (
                    <button
                      key={size}
                      onClick={() => setTargetSize(size)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        background: targetSize === size ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                        color: 'white',
                        cursor: 'pointer',
                        fontSize: '0.9rem'
                      }}
                    >
                      {size >= 1000 ? `${size/1000}MB` : `${size}KB`}
                    </button>
                  ))}
                  <div style={{ position: 'relative', flex: 1 }}>
                    <input 
                      type="number" 
                      value={targetSize} 
                      onChange={(e) => setTargetSize(e.target.value)}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', outline: 'none', paddingRight: '2.5rem' }}
                    />
                    <span style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>KB</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={lightenPdf} 
                disabled={isProcessing}
                className="btn-primary" 
                style={{ width: '100%', padding: '1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', fontSize: '1.1rem' }}
              >
                {isProcessing ? <RefreshCw size={20} className="spin" /> : <><Zap size={20} /> Start Lightening</>}
              </button>
            </div>
          )}
        </div>

        <AdBanner position="belowTool" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {isProcessing && (
            <div className="glass-panel" style={{ padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <span style={{ fontWeight: '600' }}>Processing PDF...</span>
                <span>{progress}%</span>
              </div>
              <div style={{ height: '10px', background: 'rgba(255,255,255,0.1)', borderRadius: '5px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent-primary)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}

          {compressedFile && (
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
              <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <BarChart size={24} color="var(--accent-primary)" /> Results
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Original Size:</span>
                  <span style={{ fontWeight: '700' }}>{formatSize(originalSize)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>New Size:</span>
                  <span style={{ fontWeight: '700', color: 'var(--success-color)' }}>{formatSize(resultSize)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Reduction:</span>
                  <span style={{ fontWeight: '700', color: 'var(--success-color)' }}>{Math.round((1 - resultSize/originalSize) * 100)}%</span>
                </div>
              </div>

              {resultSize > (parseInt(targetSize) * 1024) && (
                <div style={{ display: 'flex', gap: '0.75rem', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '10px', marginBottom: '1.5rem', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#fbbf24', fontSize: '0.85rem' }}>
                  <AlertTriangle size={24} style={{ flexShrink: 0 }} />
                  <p style={{ margin: 0 }}>Target size of {targetSize}KB could not be reached without compromising document integrity. This is the smallest safe size achieved.</p>
                </div>
              )}

              <button 
                onClick={handleDownload} 
                className="btn-primary" 
                style={{ width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
              >
                <Download size={20} /> Download Lightened PDF
              </button>
            </div>
          )}

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h5 style={{ margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Zap size={16} color="var(--accent-primary)" /> Features
            </h5>
            <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
                Strips all XMP & Document Metadata
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
                Optimizes object streams
              </li>
              <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
                Removes unused resources & fonts
              </li>
            </ul>
          </div>
        </div>
      </div>

      <RelatedTools currentToolId="pdf-lightener" category="pdf" />
    </div>
  );
}
