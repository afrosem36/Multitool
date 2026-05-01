import React, { useState, useRef } from 'react';
import { Copy, RotateCcw, Wand2, ChevronDown, Upload, Download, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

// Fix mojibake on a JS string: treat each char as a raw byte, decode with toEncoding
function fixMojibakeString(text, toEncoding) {
  try {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
    return new TextDecoder(toEncoding, { fatal: false }).decode(bytes);
  } catch {
    return text;
  }
}

// Decode a raw ArrayBuffer using a specific encoding → UTF-8 string
function decodeBuffer(buffer, fromEncoding) {
  return new TextDecoder(fromEncoding, { fatal: false }).decode(buffer);
}

// Recursively fix mojibake in all string values of an XLSX workbook
function fixWorkbook(wb, toEncoding) {
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    for (const key of Object.keys(ws)) {
      if (key.startsWith('!')) continue;
      const cell = ws[key];
      if (cell && cell.t === 's' && typeof cell.v === 'string') {
        cell.v = fixMojibakeString(cell.v, toEncoding);
        cell.w = cell.v;
      }
    }
  }
  return wb;
}

const PRESETS = [
  { label: 'Windows-1252 → UTF-8', description: "Most common: Ã©→é, Ã£→ã", from: 'windows-1252', to: 'utf-8', example: 'Ã©lÃ¨ve Ã  lâ€™Ã©cole' },
  { label: 'ISO-8859-1 → UTF-8', description: 'Western European Latin-1', from: 'iso-8859-1', to: 'utf-8', example: 'café résumé' },
  { label: 'ISO-8859-2 → UTF-8', description: 'Central/Eastern European (Polish, Czech)', from: 'iso-8859-2', to: 'utf-8', example: 'zółw' },
  { label: 'KOI8-R → UTF-8', description: 'Russian text misread as Latin', from: 'koi8-r', to: 'utf-8', example: 'пРиВеТ' },
];

export default function MojibakeDecoder() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [preset, setPreset] = useState(PRESETS[0]);
  const [showPresets, setShowPresets] = useState(false);
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState(''); // 'text' | 'xlsx'
  const [xlsxFixed, setXlsxFixed] = useState(null); // fixed XLSX workbook bytes
  const fileInputRef = useRef(null);

  const handleFix = () => {
    if (!input.trim()) { toast.error('Paste some broken text first'); return; }
    const fixed = fixMojibakeString(input, preset.to);
    setOutput(fixed);
    setXlsxFixed(null);
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    setFileName(file.name);
    setOutput('');
    setXlsxFixed(null);

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      // Fix XLSX cells
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      fixWorkbook(wb, preset.to);
      const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      setXlsxFixed(out);
      setFileType('xlsx');
      setInput('');
      // Preview first 20 cells as text
      const preview = [];
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        rows.slice(0, 5).forEach(row => preview.push(row.join('\t')));
        if (preview.length >= 10) break;
      }
      setOutput(preview.join('\n'));
      toast.success(`Decoded ${file.name} — ${wb.SheetNames.length} sheet(s)`);
    } else {
      // .txt or .csv: read raw bytes and decode with the "from" encoding
      const buf = await file.arrayBuffer();
      const decoded = decodeBuffer(buf, preset.from);
      setInput(decoded);
      setOutput(decoded);
      setFileType('text');
      toast.success(`Loaded ${file.name}`);
    }
  };

  const handleDownload = () => {
    if (fileType === 'xlsx' && xlsxFixed) {
      const blob = new Blob([new Uint8Array(xlsxFixed)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `fixed_${fileName || 'file.xlsx'}` });
      a.click(); URL.revokeObjectURL(a.href);
      toast.success('Fixed XLSX downloaded');
    } else if (output) {
      const ext = fileName ? fileName.split('.').pop() : 'txt';
      const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `fixed_${fileName || `output.${ext}`}` });
      a.click(); URL.revokeObjectURL(a.href);
      toast.success('Fixed file downloaded');
    }
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    toast.success('Copied to clipboard!');
  };

  const handleReset = () => {
    setInput(''); setOutput(''); setFileName(''); setFileType(''); setXlsxFixed(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="container" style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem 1rem' }}>
      <style>{`
        .moji-panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; overflow: hidden; }
        .moji-panel-header { padding: 0.6rem 1rem; background: rgba(0,0,0,0.2); border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; justify-content: space-between; }
        .moji-textarea { width: 100%; min-height: 140px; padding: 0.85rem 1rem; background: transparent; border: none; color: var(--text-primary); font-family: inherit; font-size: 0.9rem; line-height: 1.6; resize: vertical; outline: none; }
        .moji-preset-dropdown { position: relative; }
        .moji-preset-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: var(--text-primary); font-size: 0.875rem; cursor: pointer; width: 100%; transition: background 0.15s; }
        .moji-preset-btn:hover { background: rgba(255,255,255,0.08); }
        .moji-dropdown-menu { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: #1a1a28; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; z-index: 100; box-shadow: 0 8px 32px rgba(0,0,0,0.4); overflow: hidden; }
        .moji-dropdown-item { padding: 0.75rem 1rem; cursor: pointer; transition: background 0.15s; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .moji-dropdown-item:last-child { border-bottom: none; }
        .moji-dropdown-item:hover { background: rgba(255,255,255,0.05); }
        .moji-dropdown-item.active { background: rgba(99,102,241,0.1); }
        .moji-upload-zone { border: 2px dashed rgba(99,102,241,0.3); border-radius: 10px; padding: 1rem 1.25rem; display: flex; align-items: center; gap: 0.75rem; cursor: pointer; transition: border-color 0.2s, background 0.2s; font-size: 0.875rem; }
        .moji-upload-zone:hover { border-color: rgba(99,102,241,0.6); background: rgba(99,102,241,0.04); }
      `}</style>

      <ToolHeader
        title="Mojibake Decoder"
        description="Fix broken text caused by encoding mismatches — turn 'Ã©' back into 'é'. Supports .txt, .csv, and .xlsx files."
        icon={Wand2}
        toolId="mojibake-decoder"
      />

      {/* Preset selector */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.4rem' }}>Encoding Fix</label>
        <div className="moji-preset-dropdown">
          <button className="moji-preset-btn" onClick={() => setShowPresets(s => !s)}>
            <Wand2 size={15} style={{ color: 'var(--accent-primary)' }} />
            <span style={{ flex: 1, textAlign: 'left' }}>{preset.label}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{preset.description}</span>
            <ChevronDown size={14} style={{ flexShrink: 0, transform: showPresets ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {showPresets && (
            <div className="moji-dropdown-menu">
              {PRESETS.map(p => (
                <div key={p.label} className={`moji-dropdown-item${preset.label === p.label ? ' active' : ''}`}
                  onClick={() => { setPreset(p); setShowPresets(false); setOutput(''); setXlsxFixed(null); }}>
                  <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>{p.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File upload strip */}
      <div style={{ marginBottom: '1rem' }}>
        <div className="moji-upload-zone" onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]); }}>
          <Upload size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
          <span>
            {fileName
              ? <><strong>{fileName}</strong> — <span style={{ color: 'var(--text-secondary)' }}>click to replace</span></>
              : <><strong>Upload a file</strong> <span style={{ color: 'var(--text-secondary)' }}>(.txt, .csv, .xlsx) — your data never leaves your browser</span></>}
          </span>
        </div>
        <input ref={fileInputRef} type="file" accept=".txt,.csv,.xlsx,.xls" hidden onChange={e => handleFileUpload(e.target.files[0])} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <div className="moji-panel">
          <div className="moji-panel-header">
            <span>Broken Text (Input)</span>
            <button onClick={() => { setInput(preset.example); setOutput(''); setFileName(''); }}
              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem' }}>
              Load example
            </button>
          </div>
          <textarea className="moji-textarea" value={input} onChange={e => { setInput(e.target.value); setOutput(''); setXlsxFixed(null); }}
            placeholder={`Paste broken text here...\ne.g. ${preset.example}`} />
        </div>

        <div className="moji-panel">
          <div className="moji-panel-header">
            <span>Fixed Text {fileType === 'xlsx' ? '(Preview)' : '(Output)'}</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {output && (
                <button onClick={handleCopy} style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Copy size={12} /> Copy
                </button>
              )}
              {(output || xlsxFixed) && fileName && (
                <button onClick={handleDownload} style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Download size={12} /> Download
                </button>
              )}
            </div>
          </div>
          <textarea className="moji-textarea" value={output} readOnly
            placeholder={fileType === 'xlsx' ? 'Upload an XLSX file to see a preview of fixed cells...' : 'Fixed text will appear here after clicking Fix...'}
            style={{ color: output ? 'var(--text-primary)' : 'var(--text-secondary)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        {!fileType && (
          <button className="btn-primary" onClick={handleFix} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.5rem' }}>
            <Wand2 size={16} /> Fix Encoding
          </button>
        )}
        {(output || xlsxFixed) && fileName && (
          <button className="btn-primary" onClick={handleDownload} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.5rem' }}>
            <Download size={16} /> Download Fixed File
          </button>
        )}
        <button className="btn-secondary" onClick={handleReset} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RotateCcw size={16} /> Reset
        </button>
      </div>

      <div style={{ marginTop: '1.5rem', padding: '0.85rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>What is Mojibake?</strong> It happens when text is saved with one character encoding (e.g. UTF-8) but read with another (e.g. Latin-1). Common symptoms: accented characters replaced by <code>Ã©</code>, <code>Ã</code>, or diamond question marks. Select the right encoding preset, paste or upload your file, and click Fix.
      </div>

      <RelatedTools currentToolId="mojibake-decoder" category="excel" />
    </div>
  );
}
