import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const DurationCalculator = () => {
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [result, setResult] = useState(null);
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/duration', 'Duration Calculator', 'clock');
  }, [addHistory]);

  const calculateDuration = () => {
    if (!startTime || !endTime) {
      setResult(null);
      return;
    }

    const start = new Date(`1970-01-01T${startTime}:00`);
    let end = new Date(`1970-01-01T${endTime}:00`);

    if (end < start) {
      // If end time is earlier than start time, assume it's the next day
      end = new Date(`1970-01-02T${endTime}:00`);
    }

    const diffMs = end - start;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    setResult({ hours: diffHrs, minutes: diffMins });
  };

  useEffect(() => {
    calculateDuration();
  }, [startTime, endTime]);

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <div className="tool-header text-center animate-fade-in">
        <Clock size={48} className="text-gradient mx-auto mb-4" />
        <h1>Duration Calculator</h1>
        <p>Calculate the exact duration between two specific times.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Start Time</label>
            <input 
              type="time" 
              value={startTime} 
              onChange={(e) => setStartTime(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>End Time</label>
            <input 
              type="time" 
              value={endTime} 
              onChange={(e) => setEndTime(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
        </div>

        {result && (
          <div className="glass-panel text-center" style={{ padding: '2rem', background: 'rgba(249, 115, 22, 0.05)', border: '1px solid rgba(249, 115, 22, 0.2)' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>Duration</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '3rem', margin: '0 0 0.5rem 0', color: 'var(--accent-primary)' }}>{result.hours}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Hours</p>
              </div>
              <div>
                <h2 style={{ fontSize: '3rem', margin: '0 0 0.5rem 0', color: 'var(--accent-primary)' }}>{result.minutes}</h2>
                <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Minutes</p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default DurationCalculator;
