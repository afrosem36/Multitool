import React, { useState } from 'react';
import { Table, ArrowRightLeft, FileDown, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import ToolHeader from '../components/shared/ToolHeader';
import FileUpload from '../components/shared/FileUpload';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const ExcelConverter = () => {
  const [file, setFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetFormat, setTargetFormat] = useState('csv'); // 'csv' or 'xlsx'

  const handleFilesSelected = (newFiles) => {
    if (newFiles.length > 0) {
      setFile(newFiles[0]); // Only handle one file at a time for conversion
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const handleConvert = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      let outputFileName = file.name.split('.')[0];

      if (targetFormat === 'csv') {
        const csvData = XLSX.utils.sheet_to_csv(worksheet, { forceQuotes: true });
        // Add BOM for UTF-8 Excel support
        const blob = new Blob(["\uFEFF" + csvData], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${outputFileName}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else if (targetFormat === 'xlsx') {
        XLSX.writeFile(workbook, `${outputFileName}.xlsx`);
      }
    } catch (error) {
      console.error("Error converting file:", error);
      alert("An error occurred during conversion.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <ToolHeader 
        title="Excel Converter"
        description="Convert between XLSX, CSV, and other spreadsheet formats."
        icon={ArrowRightLeft}
        toolId="excel-convert"
      />

      <div className="tool-content glass-panel animate-fade-in">
        {!file ? (
          <FileUpload 
            onFilesSelected={handleFilesSelected}
            accept=".xlsx,.xls,.csv"
            multiple={false}
            label="Upload an Excel or CSV file to convert"
          />
        ) : (
          <div>
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Table size={24} color="var(--accent-primary)" />
                <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>{file.name}</span>
              </div>
              <button onClick={removeFile} className="btn-icon" style={{ background: 'transparent', border: 'none', color: 'var(--error-color)', cursor: 'pointer' }}>
                <Trash2 size={20} />
              </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Convert to Format:</label>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => setTargetFormat('csv')}
                  className={targetFormat === 'csv' ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: 1, padding: '0.75rem' }}
                >
                  CSV (UTF-8)
                </button>
                <button 
                  onClick={() => setTargetFormat('xlsx')}
                  className={targetFormat === 'xlsx' ? 'btn-primary' : 'btn-secondary'}
                  style={{ flex: 1, padding: '0.75rem' }}
                >
                  Excel (XLSX)
                </button>
              </div>
            </div>

            <button 
              onClick={handleConvert} 
              disabled={isProcessing}
              className="btn-primary w-full"
              style={{ padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}
            >
              <FileDown size={20} /> 
              {isProcessing ? 'Converting...' : `Download as ${targetFormat.toUpperCase()}`}
            </button>
          </div>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default ExcelConverter;
