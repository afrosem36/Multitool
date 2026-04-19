import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRightLeft, Ruler, Weight, Thermometer, Scaling, Beaker } from 'lucide-react';
import ToolHeader from '../components/shared/ToolHeader';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const conversionTypes = {
  length: {
    icon: Ruler,
    name: 'Length',
    units: { m: 1, km: 0.001, cm: 100, mm: 1000, in: 39.3701, ft: 3.28084, yd: 1.09361, mi: 0.000621371 }
  },
  weight: {
    icon: Weight,
    name: 'Weight',
    units: { kg: 1, g: 1000, mg: 1000000, lb: 2.20462, oz: 35.274 }
  },
  area: {
    icon: Scaling,
    name: 'Area',
    units: { sqm: 1, sqkm: 0.000001, sqft: 10.7639, sqyd: 1.19599, acre: 0.000247105, hectare: 0.0001 }
  },
  volume: {
    icon: Beaker,
    name: 'Volume',
    units: { l: 1, ml: 1000, gal: 0.264172, qt: 1.05669, pt: 2.11338, cup: 4.22675, fl_oz: 33.814 }
  }
};

const UnitConverter = () => {
  const [activeType, setActiveType] = useState('length');
  const [amount, setAmount] = useState('1');
  const [fromUnit, setFromUnit] = useState('m');
  const [toUnit, setToUnit] = useState('ft');
  const [result, setResult] = useState('');

  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/utilities/unit-converter', 'Unit Converter', 'arrowRightLeft');
  }, [addHistory]);

  // Reset units when type changes
  useEffect(() => {
    if (activeType === 'temperature') {
      setFromUnit('c');
      setToUnit('f');
    } else {
      const units = Object.keys(conversionTypes[activeType].units);
      setFromUnit(units[0]);
      setToUnit(units[1] || units[0]);
    }
  }, [activeType]);

  useEffect(() => {
    calculate();
  }, [amount, fromUnit, toUnit, activeType]);

  const calculate = () => {
    const val = parseFloat(amount);
    if (isNaN(val)) {
      setResult('');
      return;
    }

    if (activeType === 'temperature') {
      let c = 0;
      // Convert to Celsius first
      if (fromUnit === 'c') c = val;
      if (fromUnit === 'f') c = (val - 32) * 5/9;
      if (fromUnit === 'k') c = val - 273.15;

      // Convert from Celsius to Target
      let res = 0;
      if (toUnit === 'c') res = c;
      if (toUnit === 'f') res = (c * 9/5) + 32;
      if (toUnit === 'k') res = c + 273.15;
      
      setResult(res.toFixed(4).replace(/\.?0+$/, ''));
      return;
    }

    const typeData = conversionTypes[activeType].units;
    if (!typeData[fromUnit] || !typeData[toUnit]) return;

    // Convert to base unit then to target unit
    const inBase = val / typeData[fromUnit];
    const final = inBase * typeData[toUnit];
    
    // Format to avoid long decimals but keep precision
    let formatted = final.toFixed(6);
    formatted = parseFloat(formatted).toString(); // Removes trailing zeros
    setResult(formatted);
  };

  const handleSwap = () => {
    const temp = fromUnit;
    setFromUnit(toUnit);
    setToUnit(temp);
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <ToolHeader 
        title="Unit Converter"
        description="Convert seamlessly between length, weight, temperature, volume, and area."
        icon={ArrowRightLeft}
        toolId="unit-converter"
      />

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '1rem', marginBottom: '1.5rem', scrollbarWidth: 'none' }}>
          {Object.entries(conversionTypes).map(([key, data]) => (
            <button
              key={key}
              onClick={() => setActiveType(key)}
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: activeType === key ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.1)',
                background: activeType === key ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.2)',
                color: activeType === key ? '#60a5fa' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              <data.icon size={16} />
              {data.name}
            </button>
          ))}
          <button
            onClick={() => setActiveType('temperature')}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              border: '1px solid',
              borderColor: activeType === 'temperature' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255,255,255,0.1)',
              background: activeType === 'temperature' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(0,0,0,0.2)',
              color: activeType === 'temperature' ? '#60a5fa' : 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            <Thermometer size={16} />
            Temperature
          </button>
        </div>

        <div className="unit-inputs-grid">
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>From</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: '60%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
              />
              <select 
                value={fromUnit} 
                onChange={(e) => setFromUnit(e.target.value)}
                style={{ width: '40%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(30,30,40,1)', color: 'white', outline: 'none', cursor: 'pointer' }}
              >
                {activeType === 'temperature' ? (
                  <>
                    <option value="c">°C</option>
                    <option value="f">°F</option>
                    <option value="k">K</option>
                  </>
                ) : (
                  Object.keys(conversionTypes[activeType].units).map(u => (
                    <option key={u} value={u}>{u.toUpperCase()}</option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="swap-btn-container" style={{ paddingBottom: '0.75rem', display: 'flex', justifyContent: 'center' }}>
            <button onClick={handleSwap} className="btn-secondary" style={{ padding: '0.75rem', borderRadius: '50%' }}>
              <ArrowRightLeft size={16} />
            </button>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>To</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={result} 
                readOnly
                style={{ width: '60%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.05)', color: '#60a5fa', outline: 'none', fontWeight: 'bold' }}
              />
              <select 
                value={toUnit} 
                onChange={(e) => setToUnit(e.target.value)}
                style={{ width: '40%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(30,30,40,1)', color: 'white', outline: 'none', cursor: 'pointer' }}
              >
                {activeType === 'temperature' ? (
                  <>
                    <option value="c">°C</option>
                    <option value="f">°F</option>
                    <option value="k">K</option>
                  </>
                ) : (
                  Object.keys(conversionTypes[activeType].units).map(u => (
                    <option key={u} value={u}>{u.toUpperCase()}</option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default UnitConverter;
