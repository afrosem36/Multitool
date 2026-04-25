import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const CUSTOM_DAY_TYPES = [
  'Public Holiday',
  'Sick Leave',
  'Casual Leave',
  'Vacation',
  'Other',
];

const createCustomDay = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  date: '',
  type: 'Public Holiday',
  label: '',
});

const WorkingDayCalculator = () => {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [includeWeekends, setIncludeWeekends] = useState(false);
  const [customDays, setCustomDays] = useState([createCustomDay()]);
  const [result, setResult] = useState(null);

  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/working-days', 'Working Day Calculator', 'calendar');
  }, [addHistory]);

  const activeCustomDays = useMemo(
    () => customDays.filter((item) => item.date),
    [customDays]
  );

  const updateCustomDay = (id, field, value) => {
    setCustomDays((prev) => prev.map((item) => (
      item.id === id ? { ...item, [field]: value } : item
    )));
  };

  const addCustomDay = () => {
    setCustomDays((prev) => [...prev, createCustomDay()]);
  };

  const removeCustomDay = (id) => {
    setCustomDays((prev) => {
      if (prev.length === 1) {
        return [{ ...prev[0], date: '', type: 'Public Holiday', label: '' }];
      }
      return prev.filter((item) => item.id !== id);
    });
  };

  const calculateDays = () => {
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);

    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    if (start > end) {
      setResult({ error: 'Start date must be before or equal to End date.' });
      return;
    }

    const customDayMap = new Map(
      activeCustomDays.map((item) => [item.date, item])
    );

    let totalDays = 0;
    let countedWorkingDays = 0;
    let weekendDays = 0;
    let customExcludedDays = 0;
    const appliedCustomDays = [];

    const current = new Date(start);
    while (current <= end) {
      totalDays++;
      const isoDate = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const customDay = customDayMap.get(isoDate);

      if (customDay) {
        customExcludedDays++;
        appliedCustomDays.push({
          date: isoDate,
          type: customDay.type,
          label: customDay.label,
        });
      } else if (isWeekend && !includeWeekends) {
        weekendDays++;
      } else {
        countedWorkingDays++;
      }

      current.setDate(current.getDate() + 1);
    }

    setResult({
      totalDays,
      countedWorkingDays,
      weekendDays,
      customExcludedDays,
      includeWeekends,
      appliedCustomDays,
      error: null,
    });
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '760px' }}>
      <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Calculators
      </Link>

      <div className="tool-header text-center animate-fade-in">
        <Calendar size={48} className="text-gradient mx-auto mb-4" />
        <h1>Working Day Calculator</h1>
        <p>Calculate business days, exclude weekends, and subtract custom leave or holiday dates.</p>
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

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={includeWeekends}
            onChange={(e) => setIncludeWeekends(e.target.checked)}
          />
          Include weekends in counted working days
        </label>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ marginBottom: '0.25rem' }}>Custom excluded days</h3>
              <p style={{ margin: 0 }}>Add sick leave, public holidays, vacation, or any custom non-working day.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={addCustomDay}>
              <Plus size={16} /> Add Custom Day
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {customDays.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.2fr 1fr 1.4fr auto',
                  gap: '0.75rem',
                  alignItems: 'end',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '0.9rem',
                }}
              >
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Date</label>
                  <input
                    type="date"
                    value={item.date}
                    onChange={(e) => updateCustomDay(item.id, 'date', e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Type</label>
                  <select
                    value={item.type}
                    onChange={(e) => updateCustomDay(item.id, 'type', e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                  >
                    {CUSTOM_DAY_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>Label</label>
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) => updateCustomDay(item.id, 'label', e.target.value)}
                    placeholder="Optional note"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomDay(item.id)}
                  className="btn-danger"
                  style={{ padding: '0.75rem', alignSelf: 'center' }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
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

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Total Days</p>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{result.totalDays}</p>
                  </div>
                  <div style={{ background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(34, 197, 94, 0.1) 100%)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '1rem', borderRadius: '8px' }}>
                    <p style={{ color: '#4ade80', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>{result.includeWeekends ? 'Counted Days' : 'Working Days'}</p>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#4ade80' }}>{result.countedWorkingDays}</p>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Weekend Days</p>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold' }}>{result.weekendDays}</p>
                  </div>
                  <div style={{ background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1rem', borderRadius: '8px' }}>
                    <p style={{ color: '#fbbf24', fontSize: '0.9rem', margin: '0 0 0.5rem 0' }}>Custom Excluded</p>
                    <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 'bold', color: '#fbbf24' }}>{result.customExcludedDays}</p>
                  </div>
                </div>

                {result.appliedCustomDays.length > 0 && (
                  <div style={{ textAlign: 'left', marginTop: '1.5rem' }}>
                    <h4 style={{ marginBottom: '0.75rem' }}>Applied custom exclusions</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {result.appliedCustomDays.map((item) => (
                        <div key={`${item.date}-${item.type}-${item.label}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.18)', borderRadius: '8px', flexWrap: 'wrap' }}>
                          <span>{new Date(item.date).toLocaleDateString()}</span>
                          <span style={{ color: 'var(--text-secondary)' }}>{item.type}{item.label ? ` - ${item.label}` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
