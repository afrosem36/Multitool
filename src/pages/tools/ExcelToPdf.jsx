import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { FileSpreadsheet, Upload, Download, RefreshCw, Eye, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import SeoHead from '../../components/seo/SEOHead';

export default function ExcelToPdf() {
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const tableRef = useRef(null);

  const handleFileUpload = (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        
        const parsedSheets = wb.SheetNames.map(name => ({
          name,
          data: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1 })
        }));

        setWorkbook(wb);
        setSheets(parsedSheets);
        setFile(uploadedFile);
        setActiveSheet(0);
        setIsPreviewing(true);
        toast.success('Excel file loaded successfully');
      } catch (err) {
        toast.error('Failed to parse Excel file');
        console.error(err);
      }
    };
    reader.readAsArrayBuffer(uploadedFile);
  };

  const convertToPdf = async () => {
    if (!tableRef.current) return;

    setIsProcessing(true);
    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'l' : 'p',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${file.name.split('.')[0]}.pdf`);
      toast.success('PDF generated and downloaded!');
    } catch (err) {
      toast.error('Failed to generate PDF');
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setWorkbook(null);
    setSheets([]);
    setActiveSheet(0);
    setIsPreviewing(false);
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <SeoHead 
        title="Excel to PDF Converter" 
        description="Convert your Excel spreadsheets (.xlsx, .xls) to high-quality PDF documents online instantly."
      />

      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="text-gradient" style={{ fontSize: '3rem', marginBottom: '1rem' }}>Excel to PDF</h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-secondary)' }}>
          Convert spreadsheet sheets into organized PDF files purely in your browser.
        </p>
      </div>

      {!file ? (
        <div 
          className="glass-panel" 
          style={{ 
            padding: '4rem 2rem', border: '2px dashed var(--border-color)', 
            textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s' 
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFileUpload({ target: { files: e.dataTransfer.files } }); }}
          onClick={() => document.getElementById('excel-upload').click()}
        >
          <input type="file" id="excel-upload" hidden accept=".xlsx, .xls" onChange={handleFileUpload} />
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <FileSpreadsheet size={40} color="var(--accent-primary)" />
          </div>
          <h3>Click or Drag & Drop Excel File</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Supports .xlsx and .xls formats</p>
        </div>
      ) : (
        <div className="animate-fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'var(--surface-color)', padding: '0.75rem 1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <FileSpreadsheet size={20} color="var(--success-color)" />
                <span style={{ fontWeight: '600' }}>{file.name}</span>
              </div>
              <button onClick={reset} className="btn-secondary" style={{ padding: '0.75rem' }}>
                <RefreshCw size={18} />
              </button>
            </div>

            <button 
              onClick={convertToPdf} 
              disabled={isProcessing}
              className="btn-primary" 
              style={{ padding: '0.75rem 2rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
            >
              {isProcessing ? <Loader2 size={20} className="spin" /> : <><Download size={20} /> Convert to PDF</>}
            </button>
          </div>

          {/* Sheet Selector */}
          {sheets.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
              {sheets.map((sheet, index) => (
                <button
                  key={index}
                  onClick={() => setActiveSheet(index)}
                  style={{
                    padding: '0.6rem 1.2rem', borderRadius: '8px', border: '1px solid var(--border-color)',
                    background: activeSheet === index ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                    color: activeSheet === index ? '#fff' : 'var(--text-secondary)',
                    whiteSpace: 'nowrap', cursor: 'pointer', fontWeight: '500'
                  }}
                >
                  {sheet.name}
                </button>
              ))}
            </div>
          )}

          {/* Preview Container */}
          <div className="glass-panel" style={{ padding: '2rem', overflow: 'auto', background: '#fff', borderRadius: '12px' }}>
            <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#666' }}>
              <Eye size={18} />
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>Preview: {sheets[activeSheet]?.name}</span>
            </div>
            
            <div ref={tableRef} style={{ background: '#fff', padding: '20px', minWidth: 'fit-content' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', color: '#333', fontFamily: 'sans-serif', fontSize: '12px' }}>
                <tbody>
                  {sheets[activeSheet]?.data.map((row, rowIndex) => (
                    <tr key={rowIndex}>
                      {row.map((cell, cellIndex) => (
                        <td 
                          key={cellIndex} 
                          style={{ 
                            border: '1px solid #ddd', 
                            padding: '8px', 
                            textAlign: 'left',
                            whiteSpace: 'nowrap',
                            backgroundColor: rowIndex === 0 ? '#f8f9fa' : 'transparent',
                            fontWeight: rowIndex === 0 ? 'bold' : 'normal'
                          }}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div style={{ marginTop: '4rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ color: 'var(--accent-primary)', marginBottom: '1rem' }}><FileText size={32} /></div>
          <h3 style={{ marginBottom: '0.5rem' }}>100% Client-Side</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Your data never leaves your computer. We process everything locally in your browser using advanced libraries.
          </p>
        </div>
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ color: 'var(--success-color)', marginBottom: '1rem' }}><FileSpreadsheet size={32} /></div>
          <h3 style={{ marginBottom: '0.5rem' }}>Sheet Selection</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
            Easily toggle between different sheets in your workbook and convert exactly what you need.
          </p>
        </div>
      </div>
    </div>
  );
}
