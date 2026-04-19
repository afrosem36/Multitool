import React, { useState, useEffect } from 'react';
import { Calendar, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const WorkingDayCalculator = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [result, setResult] = useState(null);

  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/working-days', 'Working Day Calculator', 'calendar');
  }, [addHistory]);

  const calculateDays = () => {
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Normalize times to midnight
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (start > end) {
      setResult({ error: 'Start date must be before or equal to End date.' });
      return;
    }

    let totalDays = 0;
    let workingDays = 0;
    let weekendDays = 0;

    let current = new Date(start);
    while (current <= end) {
      totalDays++;
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday

      if (isWeekend) {
        weekendDays++;
      } else {
        workingDays++;
      }

      current.setDate(current.getDate() + 1);
    }

    setResult({
      totalDays,
      workingDays,
      weekendDays,
      error: null
    });
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Calculators
      </Link>
      
      <div className="tool-header text-center animate-fade-in">
        <Calendar size={48} className="text-gradient mx-auto mb-4" />
        <h1>Working Day Calculator</h1>
        <p>Calculate the exact number of business days between two dates, automatically excluding weekends.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full"
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full"
              style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
        </div>

        <button 
          onClick={calculateDays}
          className="btn-primary"
          style={{ width: '100%', marginBottom: '2rem' }}
          disabled={!startDate || !endDate}
        >
          Calculate Working Days
        </button>

        {result && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', background: result.error ? 'rgba(239, 68, 68, 0.05)' : 'rgba(59, 130, 246, 0.05)', border: `1px solid ${result.error ? 'rgba(239, 68, 68, 0.2)' : 'rgba(59, 130, 246, 0.2)'}` }}>
            {result.error ? (
              <p style={{ color: '#ef4444', margin: 0, textAlign: 'center' }}>{result.error}</p>
            ) : (
              <div style={{ textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>Calculation Result</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Total Days</p>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{result.totalDays}</p>
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '1rem', borderRadius: '8px' }}>
                    <p style={{ color: '#4ade80', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Working Days</p>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80' }}>{result.workingDays}</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Weekends</p>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{result.weekendDays}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default WorkingDayCalculator;
