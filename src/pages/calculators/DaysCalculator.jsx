import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { useToolHistory } from '../../hooks/useToolHistory';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import '../styles/ToolStyles.css';

const DaysCalculator = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [result, setResult] = useState(null);
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/days', 'Days Calculator', 'calendar');
  }, [addHistory]);

  const calculateDays = () => {
    if (!startDate || !endDate) {
      setResult(null);
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

    setResult(diffDays);
  };

  useEffect(() => {
    calculateDays();
  }, [startDate, endDate]);

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <div className="tool-header text-center animate-fade-in">
        <Calendar size={48} className="text-gradient mx-auto mb-4" />
        <h1>Days Calculator</h1>
        <p>Calculate the exact number of days between two dates.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
        </div>

        {result !== null && (
          <div className="glass-panel text-center" style={{ padding: '2rem', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Difference</p>
            <h2 style={{ fontSize: '3rem', margin: '0 0 0.5rem 0', color: 'var(--accent-primary)' }}>{result}</h2>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-secondary)', margin: 0 }}>Days</p>
          </div>
        )}
      </div>
      
      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default DaysCalculator;
