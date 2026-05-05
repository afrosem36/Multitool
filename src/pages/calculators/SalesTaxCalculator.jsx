import React, { useState, useEffect } from 'react';
import { Receipt, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../../hooks/useToolHistory';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import { formatAmountINR } from '../../utils/formatters';
import '../styles/ToolStyles.css';

const SalesTaxCalculator = () => {
  const [price, setPrice] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [mode, setMode] = useState('add'); // 'add' or 'extract'
  const [result, setResult] = useState(null);

  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/sales-tax', 'Sales Tax Calculator', 'receipt');
  }, [addHistory]);

  const calculateTax = () => {
    const p = parseFloat(price);
    const r = parseFloat(taxRate);

    if (isNaN(p) || isNaN(r) || p < 0 || r < 0) {
      setResult(null);
      return;
    }

    if (mode === 'add') {
      const taxAmount = p * (r / 100);
      const total = p + taxAmount;
      setResult({
        preTax: p.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        postTax: total.toFixed(2)
      });
    } else {
      // Extract tax from total price
      const preTax = p / (1 + (r / 100));
      const taxAmount = p - preTax;
      setResult({
        preTax: preTax.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        postTax: p.toFixed(2)
      });
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Calculators
      </Link>
      
      <div className="tool-header text-center animate-fade-in">
        <Receipt size={48} className="text-gradient mx-auto mb-4" />
        <h1>Sales Tax Calculator</h1>
        <p>Easily add or extract sales tax from any price.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'rgba(0,0,0,0.2)', padding: '0.5rem', borderRadius: '8px' }}>
          <button
            onClick={() => { setMode('add'); setResult(null); }}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: '6px', border: 'none',
              background: mode === 'add' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: mode === 'add' ? '#60a5fa' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.2s', fontWeight: '500'
            }}
          >
            Add Tax to Price
          </button>
          <button
            onClick={() => { setMode('extract'); setResult(null); }}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: '6px', border: 'none',
              background: mode === 'extract' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: mode === 'extract' ? '#60a5fa' : 'var(--text-secondary)',
              cursor: 'pointer', transition: 'all 0.2s', fontWeight: '500'
            }}
          >
            Extract Tax from Total
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              {mode === 'add' ? 'Pre-Tax Price' : 'Total Price (with tax)'}
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>Rs.</span>
              <input 
                type="number" 
                value={price} 
                onChange={(e) => setPrice(e.target.value)}
                placeholder="10,000"
                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 3rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Tax Rate (%)</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                value={taxRate} 
                onChange={(e) => setTaxRate(e.target.value)}
                placeholder="8.5"
                style={{ width: '100%', padding: '0.75rem 2rem 0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
              />
              <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>%</span>
            </div>
          </div>
        </div>

        <button 
          onClick={calculateTax}
          className="btn-primary"
          style={{ width: '100%', marginBottom: '2rem' }}
          disabled={!price || !taxRate}
        >
          Calculate Tax
        </button>

        {result && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', textAlign: 'center' }}>Tax Summary</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Pre-Tax Amount:</span>
                <span style={{ fontWeight: '500' }}>{formatAmountINR(result.preTax, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#f87171' }}>Tax Amount (+):</span>
                <span style={{ fontWeight: '500', color: '#f87171' }}>{formatAmountINR(result.taxAmount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
                <span style={{ color: '#4ade80', fontSize: '1.2rem', fontWeight: 'bold' }}>Total Price:</span>
                <span style={{ color: '#4ade80', fontSize: '1.2rem', fontWeight: 'bold' }}>{formatAmountINR(result.postTax, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default SalesTaxCalculator;
