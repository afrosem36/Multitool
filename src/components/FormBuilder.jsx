import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Layout, Type, Palette, Upload, Video, Image as ImageIcon, X } from 'lucide-react';
import ToggleSwitch from './ui/ToggleSwitch';
import styled from 'styled-components';
import { useAuth } from '../context/AuthContext';

const BuilderContainer = styled.div`
  background: var(--bg-panel);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 1.5rem;
  margin-top: 1rem;
  animation: slideDownFade 0.3s ease;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 1rem;

  h3 {
    margin: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.1rem;
    color: var(--text-primary);
  }
`;

const Section = styled.div`
  margin-bottom: 1.5rem;

  h4 {
    font-size: 0.9rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

const FieldRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: rgba(0,0,0,0.2);
  padding: 1.25rem;
  border-radius: 8px;
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-color);
  position: relative;
`;

const InputGroup = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;

  @media (max-width: 640px) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const StyledInput = styled.input`
  flex: 2;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  
  &:focus {
    border-color: var(--accent-primary);
  }
`;

const StyledSelect = styled.select`
  flex: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 0.6rem 0.8rem;
  color: var(--text-primary);
  font-size: 0.9rem;
  outline: none;
  cursor: pointer;
`;

const RemoveButton = styled.button`
  position: absolute;
  top: -10px;
  right: -10px;
  background: #ef4444;
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  opacity: 0;
  transition: opacity 0.2s;

  ${FieldRow}:hover & {
    opacity: 1;
  }
`;

const ColorGrid = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;

  button {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.2s;

    &:hover {
      transform: scale(1.1);
    }
    
    &.active {
      border-color: #fff;
      box-shadow: 0 0 0 2px var(--accent-primary);
    }
  }
`;

const defaultColors = [
  { name: 'Default Dark', bg: '', btn: 'var(--primary-color)' },
  { name: 'Ocean Blue', bg: 'linear-gradient(to right, #4facfe 0%, #00f2fe 100%)', btn: '#00f2fe' },
  { name: 'Sunset Purple', bg: 'linear-gradient(to right, #fa709a 0%, #fee140 100%)', btn: '#fa709a' },
  { name: 'Forest Green', bg: 'linear-gradient(to right, #43e97b 0%, #38f9d7 100%)', btn: '#43e97b' },
  { name: 'Midnight', bg: 'linear-gradient(to right, #141e30 0%, #243b55 100%)', btn: '#4facfe' }
];

export default function FormBuilder({ onChange, onBackgroundUpload }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [fields, setFields] = useState([
    { id: 'field_' + Date.now(), label: 'Your Name', type: 'text', required: true }
  ]);
  const [design, setDesign] = useState(defaultColors[0]);
  const [bgFile, setBgFile] = useState(null);
  const [bgPreview, setBgPreview] = useState(null);

  useEffect(() => {
    if (isEnabled) {
      onChange({ fields, design: { background: design.bg, buttonColor: design.btn } });
    } else {
      onChange(null);
    }
  }, [isEnabled, fields, design, onChange]);

  const addField = () => {
    if (fields.length >= 5) return;
    setFields([...fields, { 
      id: 'field_' + Date.now() + Math.random().toString(36).substr(2, 5), 
      label: '', 
      type: 'text', 
      required: true 
    }]);
  };

  const updateField = (id, updates) => {
    setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeField = (id) => {
    if (fields.length <= 1) return;
    setFields(fields.filter(f => f.id !== id));
  };

  const handleBgChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 30 * 1024 * 1024 : 5 * 1024 * 1024;

    if (file.size > maxSize) {
      alert(`File is too large. Max size for ${isVideo ? 'videos' : 'images'} is ${isVideo ? '30MB' : '5MB'}.`);
      return;
    }

    setBgFile(file);
    setBgPreview(URL.createObjectURL(file));
    if (onBackgroundUpload) onBackgroundUpload(file);
  };

  return (
    <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-color)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Settings size={20} color="var(--accent-primary)" />
          <div>
            <strong style={{ display: 'block' }}>Require Visitor Details (Lead Gate)</strong>
            <small style={{ color: 'var(--text-secondary)' }}>Visitors must fill out a form before accessing the link.</small>
          </div>
        </div>
        <ToggleSwitch checked={isEnabled} onChange={(val) => setIsEnabled(val)} />
      </div>

      {isEnabled && (
        <BuilderContainer>
          <Header>
            <h3><Layout size={18} /> Form Configuration</h3>
          </Header>

          <Section>
            <h4><Type size={16} /> Custom Fields (Max 5)</h4>
            {fields.map((f) => (
              <FieldRow key={f.id}>
                <RemoveButton type="button" onClick={() => removeField(f.id)}><X size={14} /></RemoveButton>
                <InputGroup>
                  <StyledInput 
                    type="text" 
                    placeholder="Field Label (e.g. Your Company)" 
                    value={f.label} 
                    onChange={(e) => updateField(f.id, { label: e.target.value })}
                  />
                  <StyledSelect 
                    value={f.type} 
                    onChange={(e) => updateField(f.id, { type: e.target.value })}
                  >
                    <option value="text">Text</option>
                    <option value="dropdown">Dropdown</option>
                    <option value="number">Number</option>
                  </StyledSelect>
                </InputGroup>
                
                {f.type === 'dropdown' && (
                  <StyledInput 
                    type="text" 
                    placeholder="Options (comma separated: Option A, Option B)" 
                    value={f.options ? f.options.join(', ') : ''} 
                    onChange={(e) => updateField(f.id, { options: e.target.value.split(',').map(s => s.trim()) })}
                  />
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <span>Mandatory Field</span>
                  <ToggleSwitch checked={f.required} onChange={(val) => updateField(f.id, { required: val })} />
                </div>
              </FieldRow>
            ))}

            {fields.length < 5 && (
              <button 
                type="button"
                onClick={addField}
                style={{ background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', width: '100%', padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer' }}
              >
                <Plus size={16} /> Add Custom Field
              </button>
            )}
          </Section>

          <Section>
            <h4><Upload size={16} /> Custom Gate Background</h4>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ flex: 1, height: '100px', border: '2px dashed var(--border-color)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: 'rgba(0,0,0,0.1)', transition: 'all 0.2s' }}>
                <input type="file" hidden accept="image/*,video/*" onChange={handleBgChange} />
                <Upload size={24} style={{ marginBottom: '0.5rem', color: 'var(--text-secondary)' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Click to Upload</span>
              </label>

              {bgPreview && (
                <div style={{ width: '100px', height: '100px', borderRadius: '12px', overflow: 'hidden', position: 'relative', border: '1px solid var(--border-color)' }}>
                  {bgFile?.type.startsWith('video/') ? (
                    <video src={bgPreview} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <img src={bgPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  <button 
                    type="button" 
                    onClick={() => { setBgFile(null); setBgPreview(null); if (onBackgroundUpload) onBackgroundUpload(null); }}
                    style={{ position: 'absolute', top: '5px', right: '5px', background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', color: 'white', padding: '2px', cursor: 'pointer' }}
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
              Supports: JPG, PNG, WebP, GIF (5MB) or MP4, WebM (30MB)
            </p>
          </Section>

          <Section style={{ marginBottom: 0 }}>
            <h4><Palette size={16} /> Theme Presets</h4>
            <ColorGrid>
              {defaultColors.map((color, idx) => (
                <button
                  key={idx}
                  type="button"
                  title={color.name}
                  className={design.name === color.name ? 'active' : ''}
                  onClick={() => setDesign(color)}
                  style={{ background: color.bg || '#1e1e1e' }}
                />
              ))}
            </ColorGrid>
          </Section>

        </BuilderContainer>
      )}
    </div>
  );
}
