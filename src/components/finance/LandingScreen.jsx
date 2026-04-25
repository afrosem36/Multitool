import React from 'react';
import { Wallet, LineChart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useFinance } from './PersonalFinanceContext';

const cardStyle = (color) => ({
  borderTop: `4px solid ${color}`,
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  padding: '1.5rem',
  background: `linear-gradient(145deg, ${color}10 0%, rgba(0,0,0,0.35) 100%)`,
  boxShadow: `0 20px 45px -24px ${color}55`,
});

const bulletStyle = { display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.7rem' };

export default function LandingScreen() {
  const { setMode, setStep, resetData } = useFinance();

  const handleStart = (selectedMode) => {
    resetData();
    setMode(selectedMode);
    setStep(1);
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '980px' }}>
      <div className="text-center animate-fade-in mb-5">
        <h1 className="text-gradient mb-3" style={{ fontSize: 'clamp(2rem, 4vw, 2.8rem)' }}>
          Personal Finance Analyzer
        </h1>
        <p className="text-secondary" style={{ fontSize: '1.05rem', maxWidth: '720px', margin: '0 auto' }}>
          Pick the level of detail you want. Quick Check is fast and practical. Full Analysis digs deeper into
          cash flow, debt, projections, and decision support.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel hover-lift" style={cardStyle('#10b981')}>
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.25)', width: '74px', height: '74px', borderRadius: '18px', display: 'grid', placeItems: 'center' }}>
            <Wallet size={34} color="#10b981" />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Quick Finance Check</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.55rem 0 0' }}>
              Best for a fast monthly money check-up with clean next steps.
            </p>
          </div>
          <div style={{ width: 'fit-content', padding: '0.45rem 0.85rem', borderRadius: '999px', background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.2)', fontSize: '0.92rem' }}>
            3-5 minutes
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, flexGrow: 1 }}>
            <li style={bulletStyle}><span style={{ color: '#10b981' }}>•</span> Income, expenses, and surplus snapshot</li>
            <li style={bulletStyle}><span style={{ color: '#10b981' }}>•</span> Savings rate and emergency fund view</li>
            <li style={bulletStyle}><span style={{ color: '#10b981' }}>•</span> Actionable advice in plain language</li>
            <li style={bulletStyle}><span style={{ color: '#10b981' }}>•</span> Clean PDF export for your records</li>
          </ul>
          <button
            onClick={() => handleStart('normal')}
            style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.95rem 1.1rem', borderRadius: '12px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            Start Quick Check <ArrowRight size={18} />
          </button>
        </div>

        <div className="glass-panel hover-lift" style={cardStyle('#6366f1')}>
          <div style={{ background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.25)', width: '74px', height: '74px', borderRadius: '18px', display: 'grid', placeItems: 'center' }}>
            <LineChart size={34} color="#6366f1" />
          </div>
          <div>
            <h2 style={{ margin: 0 }}>Full Financial Analysis</h2>
            <p style={{ color: 'var(--text-secondary)', margin: '0.55rem 0 0' }}>
              Best for professionals managing loans, investing, goals, or bigger planning decisions.
            </p>
          </div>
          <div style={{ width: 'fit-content', padding: '0.45rem 0.85rem', borderRadius: '999px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.2)', fontSize: '0.92rem' }}>
            8-12 minutes
          </div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, flexGrow: 1 }}>
            <li style={bulletStyle}><span style={{ color: '#818cf8' }}>•</span> Debt, SIP, and long-term projection inputs</li>
            <li style={bulletStyle}><span style={{ color: '#818cf8' }}>•</span> Better planning around tax and cash flow</li>
            <li style={bulletStyle}><span style={{ color: '#818cf8' }}>•</span> Deeper dashboard for decision-making</li>
            <li style={bulletStyle}><span style={{ color: '#818cf8' }}>•</span> Stronger context for follow-up with AI guidance</li>
          </ul>
          <button
            onClick={() => handleStart('ultraProMax')}
            style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.95rem 1.1rem', borderRadius: '12px', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            Start Full Analysis <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <div className="text-center mt-4">
        <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', padding: '0.6rem 1.3rem' }}>
          Back to Calculators
        </Link>
      </div>
    </div>
  );
}
