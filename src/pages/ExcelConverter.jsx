import React, { useState } from 'react';
import { Table, ArrowRightLeft, FileDown, Trash2, Layers, Download, CheckSquare, Square } from 'lucide-react';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { toast } from 'react-hot-toast';
import ToolHeader from '../components/shared/ToolHeader';
import FileUpload from '../components/shared/FileUpload';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const MODES = ['Convert', 'Split Sheets'];

const ExcelConverter = () => {
  const [file, setFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [targetFormat, setTargetFormat] = useState('csv');
  const [mode, setMode] = useState('Convert');
  const [selectedSheets, setSelectedSheets] = useState([]);

  const handleFilesSelected = async (newFiles) => {
    if (newFiles.length === 0) return;
    const f = newFiles[0];
    setFile(f);
    setWorkbook(null);
    setSelectedSheets([]);
    try {
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      setWorkbook(wb);
      setSelectedSheets(wb.SheetNames); // select all by default
    } catch {
      toast.error('Could not read file');
    }
  };

  const removeFile = () => {
    setFile(null);
    setWorkbook(null);
    setSelectedSheets([]);
  };

  const toggleSheet = (name) => {
    setSelectedSheets(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    );
  };

  const toggleAll = () => {
    if (workbook) {
      setSelectedSheets(prev =>
        prev.length === workbook.SheetNames.length ? [] : [...workbook.SheetNames]
      );
    }
  };

  const handleConvert = async () => {
    if (!file || !workbook) return;
    setIsProcessing(true);
    try {
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const baseName = file.name.replace(/\.[^.]+$/, '');

      if (targetFormat === 'csv') {
        const csvData = XLSX.utils.sheet_to_csv(worksheet, { forceQuotes: true });
        const blob = new Blob(['﻿' + csvData], { type: 'text/csv;charset=utf-8;' });
        const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${baseName}.csv` });
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        XLSX.writeFile(workbook, `${baseName}.xlsx`);
      }
      toast.success('File converted!');
    } catch {
      toast.error('Conversion failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const sheetToXlsxBlob = (sheetName) => {
    const newWb = XLSX.utils.book_new();
    // Deep-clone the sheet so XLSX.write can't mutate it between iterations
    const ws = workbook.Sheets[sheetName];
    const cloned = Object.fromEntries(
      Object.entries(ws).map(([k, v]) => [k, typeof v === 'object' && v !== null ? { ...v } : v])
    );
    XLSX.utils.book_append_sheet(newWb, cloned, sheetName);
    const arr = XLSX.write(newWb, { type: 'array', bookType: 'xlsx' });
    return new Blob([arr], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  };

  const handleSplitSheets = async () => {
    if (!workbook || selectedSheets.length === 0) {
      toast.error('Select at least one sheet');
      return;
    }
    setIsProcessing(true);
    try {
      const baseName = file.name.replace(/\.[^.]+$/, '');
      if (selectedSheets.length === 1) {
        // Single sheet: download directly as XLSX blob
        const blob = sheetToXlsxBlob(selectedSheets[0]);
        const a = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(blob),
          download: `${baseName}_${selectedSheets[0]}.xlsx`
        });
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success('Sheet exported!');
      } else {
        // Multiple sheets: bundle into ZIP
        const zip = new JSZip();
        for (const sheetName of selectedSheets) {
          const blob = sheetToXlsxBlob(sheetName);
          zip.file(`${sheetName}.xlsx`, blob);
        }
        const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
        const a = Object.assign(document.createElement('a'), {
          href: URL.createObjectURL(zipBlob),
          download: `${baseName}_sheets.zip`
        });
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success(`Exported ${selectedSheets.length} sheets as ZIP`);
      }
    } catch (e) {
      console.error('Split sheets error:', e);
      toast.error('Export failed: ' + (e.message || 'unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '640px' }}>
      <ToolHeader
        title="Excel Converter"
        description="Convert between XLSX & CSV, or split a multi-sheet workbook into separate files."
        icon={ArrowRightLeft}
        toolId="excel-convert"
      />

      <div className="tool-content glass-panel animate-fade-in">
        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {MODES.map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={mode === m ? 'btn-primary' : 'btn-secondary'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            >
              {m === 'Split Sheets' ? <Layers size={15} /> : <ArrowRightLeft size={15} />}
              {m}
            </button>
          ))}
        </div>

        {!file ? (
          <FileUpload
            onFilesSelected={handleFilesSelected}
            accept=".xlsx,.xls,.csv"
            multiple={false}
            label={mode === 'Split Sheets' ? 'Upload a multi-sheet Excel file to split' : 'Upload an Excel or CSV file to convert'}
          />
        ) : (
          <div>
            {/* File info */}
            <div className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Table size={22} color="var(--accent-primary)" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{file.name}</div>
                  {workbook && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {workbook.SheetNames.length} sheet{workbook.SheetNames.length !== 1 ? 's' : ''}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={removeFile} className="btn-icon" title="Remove file">
                <Trash2 size={18} />
              </button>
            </div>

            {mode === 'Convert' && (
              <>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Convert to:</label>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem' }}>
                  <button onClick={() => setTargetFormat('csv')} className={targetFormat === 'csv' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '0.7rem' }}>
                    CSV (UTF-8)
                  </button>
                  <button onClick={() => setTargetFormat('xlsx')} className={targetFormat === 'xlsx' ? 'btn-primary' : 'btn-secondary'} style={{ flex: 1, padding: '0.7rem' }}>
                    Excel (XLSX)
                  </button>
                </div>
                <button onClick={handleConvert} disabled={isProcessing} className="btn-primary" style={{ width: '100%', padding: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <FileDown size={18} />
                  {isProcessing ? 'Converting...' : `Download as ${targetFormat.toUpperCase()}`}
                </button>
              </>
            )}

            {mode === 'Split Sheets' && workbook && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <label style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Select sheets to export:</label>
                  <button onClick={toggleAll} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.8rem' }}>
                    {selectedSheets.length === workbook.SheetNames.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1.25rem' }}>
                  {workbook.SheetNames.map(name => (
                    <button
                      key={name}
                      onClick={() => toggleSheet(name)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.65rem 0.85rem', background: selectedSheets.includes(name) ? 'rgba(99,102,241,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedSheets.includes(name) ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`, borderRadius: 8, cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left', fontSize: '0.875rem', transition: 'all 0.15s' }}
                    >
                      {selectedSheets.includes(name) ? <CheckSquare size={16} color="var(--accent-primary)" /> : <Square size={16} color="var(--text-secondary)" />}
                      {name}
                    </button>
                  ))}
                </div>
                <button onClick={handleSplitSheets} disabled={isProcessing || selectedSheets.length === 0} className="btn-primary" style={{ width: '100%', padding: '0.85rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <Download size={18} />
                  {isProcessing ? 'Exporting...' : selectedSheets.length > 1 ? `Download ${selectedSheets.length} Sheets as ZIP` : 'Download Sheet as XLSX'}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default ExcelConverter;
