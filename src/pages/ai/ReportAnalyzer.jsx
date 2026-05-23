import React, { useState, useRef } from 'react';
import { API_BASE_URL } from '../../config';
import {
  Upload,
  FileText,
  Droplet,
  Heart,
  AlertCircle,
  Loader,
  Copy,
  Check,
  Download,
  Image as ImageIcon,
  Trash2,
  Clock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import SeoHead from '../../components/seo/SEOHead';
import './ReportAnalyzer.css';
import { useAiRateLimit } from '../../hooks/useAiRateLimit';
import { AiLoginGate, AiRateLimitBanner } from '../../components/shared/AiRateLimitGate';

const ReportAnalyzer = () => {
  const rateLimit   = useAiRateLimit('report-analyzer');
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [reportType, setReportType] = useState('medical');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);

  const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const validateFile = (file) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Please upload an image (PNG, JPEG, WebP) or PDF file.');
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10MB.');
      return false;
    }
    return true;
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragActive(false);
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (selectedFile) => {
    setError(null);
    if (!validateFile(selectedFile)) {
      return;
    }

    setFile(selectedFile);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  };

  const handleInputChange = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFileSelect(files[0]);
    }
  };

  const generateAnalysis = (type) => {
    // Mock AI analysis for demonstration
    const analyses = {
      blood: {
        summary: 'Your blood test results show generally normal values across most parameters. Hemoglobin levels are within the healthy range (13.5-17.5 g/dL), and white blood cell count indicates a strong immune system. Blood sugar levels are normal, suggesting good glucose metabolism.',
        keyFindings: [
          'Hemoglobin: 14.8 g/dL - Normal range',
          'White Blood Cells: 6.5 K/µL - Healthy immune function',
          'Platelets: 250 K/µL - Normal clotting ability',
          'Glucose: 95 mg/dL - Excellent blood sugar control',
          'Total Cholesterol: 185 mg/dL - Borderline healthy',
          'HDL (Good Cholesterol): 52 mg/dL - Above average'
        ],
        tips: [
          'Maintain your current exercise routine - it\'s working well',
          'Continue a balanced diet rich in whole grains and vegetables',
          'Increase fiber intake to help manage cholesterol naturally',
          'Stay hydrated - drink at least 8 glasses of water daily',
          'Consider reducing salt intake to 5g or less per day',
          'Get 7-9 hours of quality sleep each night',
          'Schedule follow-up testing in 12 months to monitor trends'
        ]
      },
      medical: {
        summary: 'Your medical report indicates normal vital signs and general health status. All major organs appear to be functioning within expected parameters. No acute conditions were detected. Recommend maintaining current lifestyle habits and scheduling annual check-ups.',
        keyFindings: [
          'Blood Pressure: 120/80 mmHg - Optimal',
          'Heart Rate: 72 bpm - Normal resting rate',
          'Body Mass Index: 23.5 - Healthy weight range',
          'Respiratory Rate: 16 breaths/min - Normal',
          'Temperature: 98.6°F - Normal body temperature',
          'Oxygen Saturation: 98% - Excellent'
        ],
        tips: [
          'Continue with regular physical activity (150 min/week of moderate exercise)',
          'Maintain a balanced, nutrient-rich diet',
          'Manage stress through meditation, yoga, or other relaxation techniques',
          'Limit alcohol consumption to moderate levels',
          'Avoid smoking and secondhand smoke exposure',
          'Schedule preventive health screenings based on age and gender',
          'Keep immunizations up to date'
        ]
      }
    };

    return analyses[type] || analyses.medical;
  };

  const analyzeReport = async () => {
    if (!file) {
      setError('Please upload a file first.');
      return;
    }

    // Client-side rate gate
    if (!rateLimit.consume()) {
      toast.error(`Hourly limit reached. Resets in ${rateLimit.resetIn}.`);
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);

    try {
      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      let disabled = [];
      try { disabled = JSON.parse(localStorage.getItem('ai_disabled_providers') || '[]'); } catch {}

      const response = await fetch(`${API_BASE_URL}/api/analyze-report`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ base64, mimeType: file.type, reportType, disabledProviders: disabled }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setAnalysis(data.data);
          toast.success(`Report analyzed via ${data.source === 'openai' ? 'OpenAI' : 'Gemini'}!`);
          return;
        }
      }

      // Fallback to mock if all AI providers fail
      const mockAnalysis = generateAnalysis(reportType);
      setAnalysis(mockAnalysis);
      toast.success('Report analyzed (demo mode — AI providers unavailable)');
    } catch (err) {
      setError(err.message || 'Failed to analyze the report. Please try again.');
      toast.error(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const copyToClipboard = () => {
    if (!analysis) return;
    const text = `
Report Analysis Summary
=======================
Type: ${reportType === 'blood' ? 'Blood Report' : 'Medical Report'}

${analysis.summary}

Key Findings:
${analysis.keyFindings?.map((f) => `- ${f}`).join('\n')}

Tips & Recommendations:
${analysis.tips?.map((t) => `✓ ${t}`).join('\n')}

Note: This is an AI-powered analysis for informational purposes only.
Please consult with a healthcare professional for medical advice.
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Analysis copied to clipboard!');
  };

  const clearForm = () => {
    setFile(null);
    setFilePreview(null);
    setAnalysis(null);
    setError(null);
  };

  const downloadAnalysis = () => {
    if (!analysis) return;

    const text = `
Report Analysis - ${new Date().toLocaleDateString()}
=====================================================

Report Type: ${reportType === 'blood' ? 'Blood Report' : 'Medical Report'}

SUMMARY
-------
${analysis.summary}

KEY FINDINGS
------------
${analysis.keyFindings?.map((f) => `• ${f}`).join('\n')}

RECOMMENDATIONS & TIPS
----------------------
${analysis.tips?.map((t) => `✓ ${t}`).join('\n')}

IMPORTANT DISCLAIMER
-------------------
This analysis is powered by AI and is for informational purposes only.
It should not be used as a substitute for professional medical advice.
Always consult with a qualified healthcare professional for proper diagnosis and treatment.

Generated: ${new Date().toLocaleString()}
    `.trim();

    const blob = new Blob([text], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-analysis-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Analysis downloaded!');
  };

  return (
    <>
      <SeoHead
        title="Medical & Blood Report Analyzer"
        description="AI-powered report analysis tool. Upload medical or blood test reports to get instant analysis with human-readable summaries and health tips."
      />

      {/* Login gate — must be signed in to use this AI tool */}
      {!rateLimit.isLoggedIn && <AiLoginGate toolName="Report Analyzer" />}

      <div className="report-analyzer-container">
        <div className="report-analyzer-header">
          <h1 className="text-gradient">Medical & Blood Report Analyzer</h1>
          <p>Upload your medical or blood test reports to get instant AI-powered analysis with insights and recommendations.</p>
        </div>

        <div className="report-analyzer-grid">
          {/* Left: Upload Section */}
          <div className="upload-section">
            <div className="report-type-selector">
              <label>Report Type</label>
              <div className="type-buttons">
                <button
                  className={`type-btn ${reportType === 'medical' ? 'active' : ''}`}
                  onClick={() => setReportType('medical')}
                >
                  <Heart size={20} />
                  Medical Report
                </button>
                <button
                  className={`type-btn ${reportType === 'blood' ? 'active' : ''}`}
                  onClick={() => setReportType('blood')}
                >
                  <Droplet size={20} />
                  Blood Report
                </button>
              </div>
            </div>

            <div
              className={`drop-zone ${isDragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {filePreview ? (
                <div className="file-preview">
                  <img src={filePreview} alt="Preview" />
                  <p className="file-name">{file.name}</p>
                </div>
              ) : file ? (
                <div className="file-info">
                  <FileText size={48} />
                  <p className="file-name">{file.name}</p>
                  <small>PDF Document</small>
                </div>
              ) : (
                <>
                  <Upload size={48} className="upload-icon" />
                  <h3>Drag & Drop Your Report</h3>
                  <p>or click to browse files</p>
                  <small>PNG, JPEG, WebP, or PDF • Max 10MB</small>
                </>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleInputChange}
                accept=".png,.jpg,.jpeg,.webp,.pdf"
                style={{ display: 'none' }}
              />
            </div>

            {file && (
              <button className="btn-clear" onClick={clearForm}>
                <Trash2 size={16} />
                Clear & Upload Different File
              </button>
            )}

            {error && (
              <div className="error-box">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <AiRateLimitBanner hook={rateLimit} />

            <button
              className="btn-analyze"
              onClick={analyzeReport}
              disabled={!file || isAnalyzing || !rateLimit.allowed}
              style={{ opacity: !rateLimit.allowed ? 0.5 : 1, cursor: !rateLimit.allowed ? 'not-allowed' : 'pointer' }}
            >
              {isAnalyzing ? (
                <>
                  <Loader size={18} className="spin" />
                  Analyzing...
                </>
              ) : !rateLimit.allowed ? (
                <>
                  <Clock size={18} />
                  Limit reached · resets in {rateLimit.resetIn}
                </>
              ) : (
                <>
                  <ImageIcon size={18} />
                  Analyze Report
                </>
              )}
            </button>
          </div>

          {/* Right: Analysis Results */}
          <div className="analysis-section">
            {!analysis && !isAnalyzing && (
              <div className="empty-state">
                <FileText size={64} />
                <h3>Upload a report to get started</h3>
                <p>Your analysis results will appear here once you upload and analyze a file.</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="loading-state">
                <div className="spinner"></div>
                <h3>Analyzing your report...</h3>
                <p>Our AI is processing your document to provide detailed insights.</p>
              </div>
            )}

            {analysis && (
              <div className="analysis-result">
                <div className="result-header">
                  <h2>Analysis Results</h2>
                  <div className="result-actions">
                    <button
                      className="btn-icon"
                      onClick={copyToClipboard}
                      title="Copy analysis"
                    >
                      {copied ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    <button
                      className="btn-icon"
                      onClick={downloadAnalysis}
                      title="Download analysis"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>

                <div className="summary-box">
                  <h3>Summary</h3>
                  <p>{analysis.summary}</p>
                </div>

                {analysis.keyFindings && analysis.keyFindings.length > 0 && (
                  <div className="findings-box">
                    <h3>Key Findings</h3>
                    <ul>
                      {analysis.keyFindings.map((finding, idx) => (
                        <li key={idx}>{finding}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {analysis.tips && analysis.tips.length > 0 && (
                  <div className="tips-box">
                    <h3>Health Tips & Recommendations</h3>
                    <ul>
                      {analysis.tips.map((tip, idx) => (
                        <li key={idx}>
                          <span className="check-mark">✓</span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="disclaimer">
                  <AlertCircle size={16} />
                  <p>
                    <strong>Medical Disclaimer:</strong> This AI-powered analysis is for informational purposes only
                    and should not be used as a substitute for professional medical advice. Always consult with a
                    qualified healthcare professional for proper diagnosis and treatment.
                  </p>
                </div>

                <button className="btn-new-analysis" onClick={clearForm}>
                  Analyze Another Report
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ReportAnalyzer;
