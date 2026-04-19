import React, { useState, useEffect } from 'react';
import { Calculator, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const AgeCalculator = () => {
  const [birthDate, setBirthDate] = useState('');
  const [result, setResult] = useState(null);
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/age', 'Age Calculator', 'calculator');
  }, [addHistory]);

  const calculateAge = () => {
    if (!birthDate) {
      setResult(null);
      return;
    }

    const birth = new Date(birthDate);
    const now = new Date();

    if (birth > now) {
      setResult(null);
      return;
    }

    let years = now.getFullYear() - birth.getFullYear();
    let months = now.getMonth() - birth.getMonth();
    let days = now.getDate() - birth.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      days += prevMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    const diffMs = now - birth;
    const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    // Live clock duration components
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = now.getSeconds();

    // Remaining lifespan calculation
    const endOfLife = new Date(birth);
    endOfLife.setFullYear(birth.getFullYear() + 63);
    const remainingMs = endOfLife - now;
    
    let remaining = null;
    let hasExceeded = remainingMs <= 0;
    
    if (!hasExceeded) {
      const rYears = Math.floor(remainingMs / (1000 * 60 * 60 * 24 * 365.25));
      const rMonths = Math.floor((remainingMs % (1000 * 60 * 60 * 24 * 365.25)) / (1000 * 60 * 60 * 24 * 30.44));
      const rDays = Math.floor((remainingMs % (1000 * 60 * 60 * 24 * 30.44)) / (1000 * 60 * 60 * 24));
      const rHours = Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const rMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      const rSeconds = Math.floor((remainingMs % (1000 * 60)) / 1000);
      
      remaining = { rYears, rMonths, rDays, rHours, rMinutes, rSeconds };
    }

    setResult({ years, months, days, hours, minutes, seconds, totalDays, totalHours, remaining, hasExceeded });
  };

  useEffect(() => {
    calculateAge();
    const interval = setInterval(calculateAge, 1000);
    return () => clearInterval(interval);
  }, [birthDate]);

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Calculators
      </Link>
      <div className="tool-header text-center animate-fade-in">
        <Calculator size={48} className="text-gradient mx-auto mb-4" />
        <h1>Age Calculator</h1>
        <p>Calculate your exact age in years, months, and days.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Date of Birth</label>
          <input 
            type="date" 
            value={birthDate} 
            onChange={(e) => setBirthDate(e.target.value)} 
            max={new Date().toISOString().split('T')[0]}
            style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
          />
        </div>

        {result && (
          <div className="glass-panel text-center" style={{ padding: '2rem', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>You have lived for exactly:</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
              <div>
                <h2 style={{ fontSize: '2rem', margin: '0 0 0.25rem 0', color: 'var(--accent-primary)' }}>{result.years}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.8rem' }}>Years</p>
              </div>
              <div>
                <h2 style={{ fontSize: '2rem', margin: '0 0 0.25rem 0', color: 'var(--accent-primary)' }}>{result.months}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.8rem' }}>Months</p>
              </div>
              <div>
                <h2 style={{ fontSize: '2rem', margin: '0 0 0.25rem 0', color: 'var(--accent-primary)' }}>{result.days}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.8rem' }}>Days</p>
              </div>
              <div>
                <h2 style={{ fontSize: '2rem', margin: '0 0 0.25rem 0', color: 'var(--accent-primary)' }}>{result.hours}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.8rem' }}>Hours</p>
              </div>
              <div>
                <h2 style={{ fontSize: '2rem', margin: '0 0 0.25rem 0', color: 'var(--accent-primary)' }}>{result.minutes}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.8rem' }}>Mins</p>
              </div>
              <div>
                <h2 style={{ fontSize: '2rem', margin: '0 0 0.25rem 0', color: 'var(--accent-primary)' }}>{result.seconds}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.8rem' }}>Secs</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginTop: '1.5rem', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 0.25rem 0' }}>{result.totalDays.toLocaleString()}</p>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Total Days Lived</p>
              </div>
              <div>
                <p style={{ fontSize: '1.2rem', fontWeight: 'bold', margin: '0 0 0.25rem 0' }}>{result.totalHours.toLocaleString()}</p>
                <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>Total Hours Lived</p>
              </div>
            </div>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>Time Remaining (Based on 63-year average lifespan)</p>
              {result.hasExceeded ? (
                <p style={{ fontSize: '1.1rem', margin: 0, color: '#10b981' }}>You have exceeded the average lifespan! Every day is a gift.</p>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', color: '#f59e0b' }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'block' }}>{result.remaining.rYears}</span>
                    <span style={{ fontSize: '0.75rem' }}>Years</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'block' }}>{result.remaining.rMonths}</span>
                    <span style={{ fontSize: '0.75rem' }}>Months</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'block' }}>{result.remaining.rDays}</span>
                    <span style={{ fontSize: '0.75rem' }}>Days</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'block' }}>{result.remaining.rHours}</span>
                    <span style={{ fontSize: '0.75rem' }}>Hours</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'block' }}>{result.remaining.rMinutes}</span>
                    <span style={{ fontSize: '0.75rem' }}>Mins</span>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'block' }}>{result.remaining.rSeconds}</span>
                    <span style={{ fontSize: '0.75rem' }}>Secs</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default AgeCalculator;
