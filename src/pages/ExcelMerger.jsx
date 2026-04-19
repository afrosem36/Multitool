import React, { useState } from 'react';
import { Table, Upload, FileDown, Layers, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import ToolHeader from '../components/shared/ToolHeader';
import FileUpload from '../components/shared/FileUpload';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const ExcelMerger = () => {
  const [files, setFiles] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mergeMode, setMergeMode] = useState('sheets'); // 'sheets' or 'rows'

  const handleFilesSelected = (newFiles) => {
    // Filter for excel/csv files
    const validFiles = Array.from(newFiles).filter(file => 
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')
    );
    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    if (files.length < 2) return;
    setIsProcessing(true);

    try {
      const newWorkbook = XLSX.utils.book_new();

      if (mergeMode === 'sheets') {
        // Merge as separate sheets
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Grab the first sheet of each file
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Generate a valid, unique sheet name
          let sheetName = file.name.split('.')[0].substring(0, 31);
          if (newWorkbook.SheetNames.includes(sheetName)) {
            sheetName = `${sheetName}_${i}`.substring(0, 31);
          }
          
          XLSX.utils.book_append_sheet(newWorkbook, worksheet, sheetName);
        }
      } else {
        // Merge rows vertically into one sheet
        let combinedData = [];
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data, { type: 'array' });
          
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          
          // Convert sheet to json array
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // If not the first file, skip the header row if we assume they have the same headers
          if (i > 0 && jsonData.length > 0) {
            jsonData.shift(); // remove first row
          }
          
          combinedData = combinedData.concat(jsonData);
        }
        
        const combinedSheet = XLSX.utils.aoa_to_sheet(combinedData);
        XLSX.utils.book_append_sheet(newWorkbook, combinedSheet, "Merged Data");
      }

      // Download the merged file
      XLSX.writeFile(newWorkbook, "Merged_Excel.xlsx");
    } catch (error) {
      console.error("Error merging files:", error);
      alert("An error occurred while merging the files. Ensure they are valid Excel/CSV files.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '800px' }}>
      <ToolHeader 
        title="Excel Merger"
        description="Combine multiple Excel or CSV files into a single workbook."
        icon={Table}
        toolId="excel-merge"
      />

      <div className="tool-content glass-panel animate-fade-in">
        <FileUpload 
          onFilesSelected={handleFilesSelected}
          accept=".xlsx,.xls,.csv"
          multiple={true}
          label="Drop your Excel/CSV files here"
        />

        {files.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Selected Files ({files.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {files.map((file, index) => (
                <div key={index} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Table size={20} color="var(--accent-primary)" />
                    <span style={{ fontSize: '0.9rem' }}>{file.name}</span>
                  </div>
                  <button onClick={() => removeFile(index)} className="btn-icon" style={{ background: 'transparent', border: 'none', color: 'var(--error-color)', cursor: 'pointer' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
              <button 
                onClick={() => setMergeMode('sheets')}
                className={mergeMode === 'sheets' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}
              >
                <Layers size={18} /> Merge as Separate Sheets
              </button>
              <button 
                onClick={() => setMergeMode('rows')}
                className={mergeMode === 'rows' ? 'btn-primary' : 'btn-secondary'}
                style={{ flex: 1, padding: '0.75rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center' }}
              >
                <Table size={18} /> Merge Rows into One Sheet
              </button>
            </div>

            <button 
              onClick={handleMerge} 
              disabled={files.length < 2 || isProcessing}
              className="btn-primary w-full"
              style={{ padding: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', alignItems: 'center', opacity: files.length < 2 ? 0.5 : 1 }}
            >
              <FileDown size={20} /> 
              {isProcessing ? 'Processing...' : 'Merge Files & Download'}
            </button>
            {files.length < 2 && (
              <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                Please select at least 2 files to merge.
              </p>
            )}
          </div>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default ExcelMerger;
