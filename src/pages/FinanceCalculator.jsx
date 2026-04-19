import React, { useState, useEffect } from 'react';
import { DollarSign, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const FinanceCalculator = () => {
  const [amount, setAmount] = useState(100000);
  const [rate, setRate] = useState(5);
  const [years, setYears] = useState(30);
  const [result, setResult] = useState(null);
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/finance', 'Finance Calculator', 'dollarSign');
  }, [addHistory]);

  const calculateLoan = () => {
    const p = parseFloat(amount);
    const r = parseFloat(rate) / 100 / 12;
    const n = parseFloat(years) * 12;

    if (isNaN(p) || isNaN(r) || isNaN(n) || p <= 0 || r < 0 || n <= 0) {
      setResult(null);
      return;
    }

    let emi;
    let totalPayment;
    let totalInterest;

    if (r === 0) {
      emi = p / n;
      totalPayment = p;
      totalInterest = 0;
    } else {
      emi = p * r * (Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1));
      totalPayment = emi * n;
      totalInterest = totalPayment - p;
    }

    setResult({
      emi: emi.toFixed(2),
      totalPayment: totalPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      principal: p.toFixed(2)
    });
  };

  useEffect(() => {
    calculateLoan();
  }, [amount, rate, years]);

  return (
    <div className="tool-container container" style={{ maxWidth: '700px' }}>
      <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Calculators
      </Link>
      <div className="tool-header text-center animate-fade-in">
        <DollarSign size={48} className="text-gradient mx-auto mb-4" />
        <h1>Finance & Loan Calculator</h1>
        <p>Calculate your monthly EMI, total interest, and total payment.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Loan Amount (₹)</label>
            <input 
              type="number" 
              value={amount} 
              onChange={(e) => setAmount(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Interest Rate (% per year)</label>
            <input 
              type="number" 
              value={rate} 
              onChange={(e) => setRate(e.target.value)} 
              step="0.1"
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Loan Tenure (Years)</label>
            <input 
              type="number" 
              value={years} 
              onChange={(e) => setYears(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
        </div>

        {result && (
          <div className="glass-panel" style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <h3 style={{ marginBottom: '1.5rem', textAlign: 'center', color: 'var(--accent-primary)' }}>Loan Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', textAlign: 'center' }}>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Monthly EMI</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>₹{result.emi}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Total Interest</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>₹{result.totalInterest}</p>
              </div>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Total Payment</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>₹{result.totalPayment}</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default FinanceCalculator;
