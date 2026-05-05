import React, { useState } from 'react';
import yaml from 'js-yaml';
import { ArrowRightLeft, Copy, Download, RefreshCw, ChevronLeft, FileCode, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

const FORMATS = ['JSON', 'CSV', 'XML', 'YAML', 'TOML'];

export default function DataConverter() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [fromFormat, setFromFormat] = useState('JSON');
  const [toFormat, setToFormat] = useState('YAML');
  const [error, setError] = useState('');

  const handleConvert = () => {
    setError('');
    if (!input.trim()) {
      setOutput('');
      return;
    }

    try {
      let data;
      // Step 1: Parse Input to JS Object
      switch (fromFormat) {
        case 'JSON':
          data = JSON.parse(input);
          break;
        case 'YAML':
          data = yaml.load(input);
          break;
        case 'CSV':
          data = csvToJson(input);
          break;
        case 'XML':
          data = xmlToJson(input);
          break;
        case 'TOML':
          data = tomlToJson(input);
          break;
        default:
          throw new Error('Unsupported input format');
      }

      // Step 2: Convert JS Object to Output Format
      let result;
      switch (toFormat) {
        case 'JSON':
          result = JSON.stringify(data, null, 2);
          break;
        case 'YAML':
          result = yaml.dump(data);
          break;
        case 'CSV':
          result = jsonToCsv(data);
          break;
        case 'XML':
          result = jsonToXml(data);
          break;
        case 'TOML':
          result = jsonToToml(data);
          break;
        default:
          throw new Error('Unsupported output format');
      }
      setOutput(result);
    } catch (err) {
      setError(err.message);
      setOutput('');
      toast.error('Conversion failed');
    }
  };

  // --- MANUAL CONVERSION UTILS ---

  const csvToJson = (csv) => {
    const lines = csv.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      const values = line.split(',');
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index]?.trim();
        return obj;
      }, {});
    });
  };

  const jsonToCsv = (json) => {
    const array = Array.isArray(json) ? json : [json];
    if (array.length === 0) return '';
    const headers = Object.keys(array[0]);
    const rows = array.map(obj => headers.map(h => obj[h]).join(','));
    return [headers.join(','), ...rows].join('\n');
  };

  const jsonToXml = (obj, rootName = 'root') => {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n`;
    const convert = (o, indent = '  ') => {
      for (let key in o) {
        if (typeof o[key] === 'object' && o[key] !== null) {
          xml += `${indent}<${key}>\n`;
          convert(o[key], indent + '  ');
          xml += `${indent}</${key}>\n`;
        } else {
          xml += `${indent}<${key}>${o[key]}</${key}>\n`;
        }
      }
    };
    convert(obj);
    xml += `</${rootName}>`;
    return xml;
  };

  const xmlToJson = (xml) => {
    // Very naive XML parser for simple structures
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, 'text/xml');
    const parseNode = (node) => {
      if (node.nodeType === 3) return node.nodeValue.trim();
      const obj = {};
      if (node.childNodes.length > 0) {
        for (let i = 0; i < node.childNodes.length; i++) {
          const item = node.childNodes.item(i);
          const nodeName = item.nodeName;
          if (nodeName === '#text') {
            const val = item.nodeValue.trim();
            if (val) return val;
            continue;
          }
          if (typeof obj[nodeName] === 'undefined') {
            obj[nodeName] = parseNode(item);
          } else {
            if (!Array.isArray(obj[nodeName])) obj[nodeName] = [obj[nodeName]];
            obj[nodeName].push(parseNode(item));
          }
        }
      }
      return obj;
    };
    return parseNode(xmlDoc.documentElement);
  };

  const jsonToToml = (obj) => {
    // Naive TOML generator
    let toml = '';
    for (let key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        toml += `[${key}]\n`;
        for (let subKey in obj[key]) {
          toml += `${subKey} = "${obj[key][subKey]}"\n`;
        }
        toml += '\n';
      } else {
        toml += `${key} = "${obj[key]}"\n`;
      }
    }
    return toml;
  };

  const tomlToJson = (toml) => {
    // Naive TOML parser
    const obj = {};
    let currentSection = obj;
    toml.split('\n').forEach(line => {
      line = line.trim();
      if (line.startsWith('[') && line.endsWith(']')) {
        const sectionName = line.substring(1, line.length - 1);
        obj[sectionName] = {};
        currentSection = obj[sectionName];
      } else if (line.includes('=')) {
        const [key, value] = line.split('=').map(s => s.trim().replace(/^"|"$/g, ''));
        currentSection[key] = value;
      }
    });
    return obj;
  };

  const handleDownload = () => {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted-data.${toFormat.toLowerCase()}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <Link to="/utilities" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', textDecoration: 'none' }}>
        <ChevronLeft size={16} /> Back to Utilities
      </Link>

      <ToolHeader 
        title="Data Format Converter" 
        description="Seamlessly convert your data between JSON, CSV, XML, YAML, and TOML. High performance, 100% private, and browser-based."
      />

      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>CONVERT FROM</label>
            <select 
              value={fromFormat} 
              onChange={(e) => setFromFormat(e.target.value)}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', fontWeight: '700', outline: 'none' }}
            >
              {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '50%' }}>
            <ArrowRightLeft size={24} color="var(--accent-primary)" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600' }}>CONVERT TO</label>
            <select 
              value={toFormat} 
              onChange={(e) => setToFormat(e.target.value)}
              style={{ padding: '0.75rem 1.5rem', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border-color)', color: 'white', fontWeight: '700', outline: 'none' }}
            >
              {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>

          <button onClick={handleConvert} className="btn-primary" style={{ padding: '0.75rem 2.5rem', height: 'fit-content', marginTop: '1.4rem' }}>
            Convert Now
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '1.5rem', height: '500px' }}>
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>INPUT ({fromFormat})</span>
            <button onClick={() => setInput('')} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem' }}>
              <RefreshCw size={14} /> Clear
            </button>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Paste your ${fromFormat} data here...`}
            style={{ flex: 1, padding: '1.5rem', background: 'transparent', border: 'none', color: 'white', fontFamily: 'monospace', fontSize: '0.9rem', outline: 'none', resize: 'none' }}
          />
        </div>

        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', border: error ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: '700', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>OUTPUT ({toFormat})</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => { navigator.clipboard.writeText(output); toast.success('Copied!'); }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem 0.8rem', color: 'white', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Copy size={14} /> Copy
              </button>
              <button onClick={handleDownload} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.4rem 0.8rem', color: 'white', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Download size={14} /> Save
              </button>
            </div>
          </div>
          {error ? (
            <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#f87171', background: 'rgba(239, 68, 68, 0.05)' }}>
              <AlertCircle size={40} style={{ marginBottom: '1rem' }} />
              <h4 style={{ margin: '0 0 0.5rem' }}>Conversion Failed</h4>
              <p style={{ fontSize: '0.9rem' }}>{error}</p>
            </div>
          ) : (
            <textarea
              value={output}
              readOnly
              placeholder="Result will appear here..."
              style={{ flex: 1, padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: 'none', color: 'white', fontFamily: 'monospace', fontSize: '0.9rem', outline: 'none', resize: 'none' }}
            />
          )}
        </div>
      </div>

      <RelatedTools currentToolId="data-converter" category="utilities" />
    </div>
  );
}
