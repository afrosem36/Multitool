import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { ArrowRightLeft, Info, Copy, Check } from 'lucide-react';

const Container = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const Header = styled.div`
  text-align: center;
  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 0.5rem;
    background: linear-gradient(to right, #f59e0b, #ec4899);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
  p { color: var(--text-secondary); font-size: 1.1rem; }
`;

const ConverterCard = styled.div`
  background: var(--surface-color);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
`;

const InputRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 1.5rem;
  align-items: end;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    align-items: center;
  }
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;

  label {
    font-weight: 500;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  select, input {
    width: 100%;
    padding: 1rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    background: rgba(0,0,0,0.1);
    color: var(--text-primary);
    font-size: 1.1rem;
    outline: none;
    transition: border-color 0.2s;

    &:focus { border-color: var(--primary-color); }
  }

  input {
    font-family: monospace;
  }
`;

const SwapButton = styled.button`
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
  border: 1px solid rgba(245, 158, 11, 0.2);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(245, 158, 11, 0.2);
    transform: scale(1.05);
  }

  @media (max-width: 768px) {
    transform: rotate(90deg);
    &:hover { transform: scale(1.05) rotate(90deg); }
  }
`;

const ResultBox = styled.div`
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--border-color);
  border-radius: 1rem;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  min-height: 150px;

  .primary {
    font-size: 2.5rem;
    font-weight: 700;
    font-family: monospace;
    word-break: break-all;
    background: linear-gradient(to right, #f59e0b, #ec4899);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .secondary {
    margin-top: 0.5rem;
    font-size: 1rem;
    color: var(--text-secondary);
    font-family: monospace;
  }
  
  .copy-btn {
    position: absolute;
    top: 1rem;
    right: 1rem;
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.2s;
    &:hover { color: var(--primary-color); }
  }
`;

const Tooltip = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;

  .tooltip-text {
    visibility: hidden;
    width: 250px;
    background-color: var(--surface-color);
    color: var(--text-primary);
    text-align: center;
    border-radius: 0.5rem;
    border: 1px solid var(--border-color);
    padding: 0.75rem;
    position: absolute;
    z-index: 1;
    bottom: 150%;
    left: 50%;
    margin-left: -125px;
    opacity: 0;
    transition: opacity 0.3s;
    font-size: 0.85rem;
    font-weight: normal;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);

    &::after {
      content: "";
      position: absolute;
      top: 100%;
      left: 50%;
      margin-left: -5px;
      border-width: 5px;
      border-style: solid;
      border-color: var(--border-color) transparent transparent transparent;
    }
  }

  &:hover .tooltip-text {
    visibility: visible;
    opacity: 1;
  }
`;

const CONSTANTS = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
  months: 2629746, // 365.2425 / 12 * 86400
  years: 31557600, // 365.2425 * 86400
  decades: 315576000,
  centuries: 3155760000
};

const UNITS = Object.keys(CONSTANTS);

export default function TimeUnitConverter() {
  const [fromUnit, setFromUnit] = useState('days');
  const [toUnit, setToUnit] = useState('hours');
  const [inputValue, setInputValue] = useState('1');
  const [result, setResult] = useState('24');
  const [sciResult, setSciResult] = useState('');
  const [copied, setCopied] = useState(false);

  const calculate = useCallback((val, from, to) => {
    if (val === '' || val === '-' || val === undefined) {
      setResult('0');
      setSciResult('');
      return;
    }

    const num = parseFloat(val);
    if (isNaN(num)) {
      setResult('0');
      setSciResult('');
      return;
    }

    if (num === 0) {
      setResult('0');
      setSciResult('');
      return;
    }

    // Anchor method
    const inSeconds = num * CONSTANTS[from];
    const finalValue = inSeconds / CONSTANTS[to];
    
    const isNegative = num < 0;
    const absVal = Math.abs(finalValue);

    // Format output
    let display = '';
    let sciDisplay = '';

    if (absVal > 1e15 || (absVal < 1e-4 && absVal > 0)) {
      // Very large or small, use sci notation
      display = absVal.toExponential(4).replace(/\\.?0+e/, 'e');
      sciDisplay = finalValue.toLocaleString('en-US', { maximumFractionDigits: 4 });
    } else {
      // Normal display
      display = parseFloat(absVal.toFixed(4)).toString();
      sciDisplay = absVal.toExponential(4).replace(/\\.?0+e/, 'e');
    }

    if (isNegative) {
      display = '-' + display;
      if (sciDisplay && !sciDisplay.startsWith('-')) sciDisplay = '-' + sciDisplay;
    }

    // Add commas for large non-sci numbers
    if (!display.includes('e')) {
      const parts = display.split('.');
      parts[0] = parts[0].replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");
      display = parts.join('.');
    }

    setResult(display);
    setSciResult(sciDisplay);
  }, []);

  // Debounce input to prevent UI freezing on rapid typing
  useEffect(() => {
    const handler = setTimeout(() => {
      calculate(inputValue, fromUnit, toUnit);
    }, 150);
    return () => clearTimeout(handler);
  }, [inputValue, fromUnit, toUnit, calculate]);

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result.replace(/,/g, ''));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy');
    }
  };

  const hasPrecisionNote = (unit) => ['months', 'years', 'decades', 'centuries'].includes(unit);

  return (
    <Container>
      <Header>
        <h1>Precision Time Converter</h1>
        <p>Zero-drift time unit conversions using the Anchor Method.</p>
      </Header>

      <ConverterCard>
        <InputRow>
          <Field>
            <label>Input Value</label>
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.replace(/[^\\d.-]/g, ''))}
              placeholder="0"
            />
          </Field>

          <Field style={{ visibility: 'hidden' }}><input /></Field>

          <Field style={{ display: 'none' }}></Field>
        </InputRow>

        <InputRow style={{ alignItems: 'center' }}>
          <Field>
            <label>
              From Unit
              {hasPrecisionNote(fromUnit) && (
                <Tooltip>
                  <Info size={14} color="var(--primary-color)" />
                  <span className="tooltip-text">Based on the Gregorian average year length (365.2425 days).</span>
                </Tooltip>
              )}
            </label>
            <select value={fromUnit} onChange={e => setFromUnit(e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
            </select>
          </Field>

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <SwapButton onClick={handleSwap} title="Swap units">
              <ArrowRightLeft size={20} />
            </SwapButton>
          </div>

          <Field>
            <label>
              To Unit
              {hasPrecisionNote(toUnit) && (
                <Tooltip>
                  <Info size={14} color="var(--primary-color)" />
                  <span className="tooltip-text">Based on the Gregorian average year length (365.2425 days).</span>
                </Tooltip>
              )}
            </label>
            <select value={toUnit} onChange={e => setToUnit(e.target.value)}>
              {UNITS.map(u => <option key={u} value={u}>{u.charAt(0).toUpperCase() + u.slice(1)}</option>)}
            </select>
          </Field>
        </InputRow>

        <ResultBox>
          <button className="copy-btn" onClick={copyToClipboard} title="Copy raw value">
            {copied ? <Check size={20} /> : <Copy size={20} />}
          </button>
          
          <div className="primary">
            {result} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>{toUnit}</span>
          </div>
          
          {sciResult && (
            <div className="secondary">
              Also: {sciResult}
            </div>
          )}
        </ResultBox>
      </ConverterCard>
    </Container>
  );
}
