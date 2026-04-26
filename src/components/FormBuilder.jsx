import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Layout, Type, Palette, Mail } from 'lucide-react';
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
  align-items: center;
  gap: 1rem;
  background: rgba(0,0,0,0.2);
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 0.5rem;
  border: 1px solid var(--border-color);

  input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--text-primary);
    outline: none;
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

export default function FormBuilder({ onChange }) {
  const { user } = useAuth();
  const [isEnabled, setIsEnabled] = useState(false);
  const [fields, setFields] = useState([
    { id: 'name', label: 'Full Name', type: 'text', required: true, icon: 'User' },
    { id: 'email', label: 'Email Address', type: 'email', required: true, icon: 'Mail' }
  ]);
  const [design, setDesign] = useState(defaultColors[0]);

  useEffect(() => {
    if (isEnabled) {
      onChange({ fields, design: { background: design.bg, buttonColor: design.btn } });
    } else {
      onChange(null);
    }
  }, [isEnabled, fields, design, onChange]);

  const toggleField = (type) => {
    if (type === 'phone') {
      const exists = fields.find(f => f.id === 'phone');
      if (exists) {
        setFields(fields.filter(f => f.id !== 'phone'));
      } else {
        setFields([...fields, { id: 'phone', label: 'Phone Number', type: 'tel', required: true, icon: 'Phone' }]);
      }
    }
  };

  const hasPhone = fields.some(f => f.id === 'phone');

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
            <h4><Type size={16} /> Fields</h4>
            {fields.map((f) => (
              <FieldRow key={f.id}>
                {f.icon === 'User' ? <user size={16} color="var(--text-secondary)" /> : 
                 f.icon === 'Mail' ? <Mail size={16} color="var(--text-secondary)" /> : 
                 <Settings size={16} color="var(--text-secondary)" />}
                <input type="text" value={f.label} readOnly />
                <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', padding: '2px 8px', background: 'rgba(99,102,241,0.1)', borderRadius: '12px' }}>
                  {f.required ? 'Required' : 'Optional'}
                </span>
              </FieldRow>
            ))}

            <button 
              type="button"
              onClick={() => toggleField('phone')}
              style={{ background: 'transparent', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', width: '100%', padding: '0.75rem', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginTop: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }}
              onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--primary-color)'; e.currentTarget.style.color = 'var(--primary-color)'; }}
              onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              {hasPhone ? <><Trash2 size={16} /> Remove Phone Number</> : <><Plus size={16} /> Add Phone Number Field</>}
            </button>
          </Section>

          <Section style={{ marginBottom: 0 }}>
            <h4><Palette size={16} /> Theme & Background</h4>
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
