import React, { useState, useEffect } from 'react';
import { Home, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const HomeLoanCalculator = () => {
  const [principal, setPrincipal] = useState('300000');
  const [interestRate, setInterestRate] = useState('5.5');
  const [years, setYears] = useState('30');
  const [downPayment, setDownPayment] = useState('60000');
  const [result, setResult] = useState(null);

  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/home-loan', 'Home Loan Calculator', 'home');
  }, [addHistory]);

  const calculateMortgage = () => {
    const p = parseFloat(principal);
    const dp = parseFloat(downPayment) || 0;
    const r = parseFloat(interestRate);
    const y = parseFloat(years);

    if (isNaN(p) || isNaN(r) || isNaN(y) || p <= 0 || r < 0 || y <= 0) {
      setResult(null);
      return;
    }

    const loanAmount = p - dp;
    if (loanAmount <= 0) {
      setResult({
        monthlyPayment: "0.00",
        totalPayment: "0.00",
        totalInterest: "0.00",
        loanAmount: "0.00"
      });
      return;
    }

    const monthlyRate = (r / 100) / 12;
    const totalPayments = y * 12;
    
    let monthlyPayment = 0;
    if (monthlyRate === 0) {
      monthlyPayment = loanAmount / totalPayments;
    } else {
      monthlyPayment = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / (Math.pow(1 + monthlyRate, totalPayments) - 1);
    }

    const totalPayment = monthlyPayment * totalPayments;
    const totalInterest = totalPayment - loanAmount;

    setResult({
      monthlyPayment: monthlyPayment.toFixed(2),
      totalPayment: totalPayment.toFixed(2),
      totalInterest: totalInterest.toFixed(2),
      loanAmount: loanAmount.toFixed(2)
    });
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Calculators
      </Link>
      
      <div className="tool-header text-center animate-fade-in">
        <Home size={48} className="text-gradient mx-auto mb-4" />
        <h1>Home Loan Calculator</h1>
        <p>Calculate your monthly mortgage payments, total interest, and loan amortization.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Home Price</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>$</span>
              <input 
                type="number" 
                value={principal} 
                onChange={(e) => setPrincipal(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Down Payment</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>$</span>
              <input 
                type="number" 
                value={downPayment} 
                onChange={(e) => setDownPayment(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Interest Rate (%)</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="number" 
                value={interestRate} 
                onChange={(e) => setInterestRate(e.target.value)}
                style={{ width: '100%', padding: '0.75rem 2rem 0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
              />
              <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>%</span>
            </div>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Loan Term (Years)</label>
            <input 
              type="number" 
              value={years} 
              onChange={(e) => setYears(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
        </div>

        <button 
          onClick={calculateMortgage}
          className="btn-primary"
          style={{ width: '100%', marginBottom: '2rem' }}
          disabled={!principal || !interestRate || !years}
        >
          Calculate Mortgage
        </button>

        {result && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>Estimated Monthly Payment</p>
              <h2 style={{ color: '#10b981', margin: 0, fontSize: '2.5rem' }}>${result.monthlyPayment}</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Principal Loan Amount:</span>
                <span style={{ fontWeight: '500' }}>${result.loanAmount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#f87171' }}>Total Interest Paid:</span>
                <span style={{ fontWeight: '500', color: '#f87171' }}>${result.totalInterest}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.5rem' }}>
                <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>Total Cost of Loan:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>${result.totalPayment}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default HomeLoanCalculator;
