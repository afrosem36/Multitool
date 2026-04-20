import React from 'react';
import { useFinance } from './PersonalFinanceContext';
import { Wallet, LineChart, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingScreen = () => {
  const { setMode, setStep } = useFinance();

  const handleStart = (selectedMode) => {
    setMode(selectedMode);
    setStep(1);
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '900px' }}>
      <div className="text-center animate-fade-in mb-5">
        <h1 className="text-gradient mb-3" style={{ fontSize: '2.5rem' }}>How would you like to analyze your finances?</h1>
        <p className="text-secondary" style={{ fontSize: '1.1rem' }}>Choose a path based on your current financial situation.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        {/* Normal Mode Card */}
        <div className="glass-panel text-center p-4 hover-lift" style={{ borderTop: '4px solid #10b981', display: 'flex', flexDirection: 'column', background: 'linear-gradient(145deg, rgba(16,185,129,0.05) 0%, rgba(0,0,0,0.4) 100%)', boxShadow: '0 10px 40px -10px rgba(16,185,129,0.2)' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '50%', width: '80px', height: '80px', margin: '0 auto 1.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            <Wallet size={40} color="#10b981" />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Quick Finance Check</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>For salaried individuals who want a simple, clear picture.</p>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '20px', display: 'inline-block', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
            ⏱ 3–5 minutes
          </div>
          
          <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flexGrow: 1 }}>
            <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#10b981' }}>✓</span> Income & monthly expenses</li>
            <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#10b981' }}>✓</span> How much you're saving</li>
            <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#10b981' }}>✓</span> Are you on the right track?</li>
            <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#10b981' }}>✓</span> Simple tips to save more</li>
          </ul>

          <button onClick={() => handleStart('normal')} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '1rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.3s' }}>
            Start Simple <ArrowRight size={20} />
          </button>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: 0 }}>No investments or loans needed — just your basic numbers</p>
        </div>

        {/* Ultra Pro Max Mode Card */}
        <div className="glass-panel text-center p-4 hover-lift" style={{ borderTop: '4px solid #6366f1', display: 'flex', flexDirection: 'column', background: 'linear-gradient(145deg, rgba(99,102,241,0.05) 0%, rgba(0,0,0,0.4) 100%)', boxShadow: '0 10px 40px -10px rgba(99,102,241,0.2)' }}>
          <div style={{ background: 'rgba(99, 102, 241, 0.1)', padding: '1rem', borderRadius: '50%', width: '80px', height: '80px', margin: '0 auto 1.5rem auto', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <LineChart size={40} color="#6366f1" />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Full Financial Analysis</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>For professionals with investments, loans, and long-term goals.</p>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem 1rem', borderRadius: '20px', display: 'inline-block', margin: '0 auto 1.5rem auto', fontSize: '0.9rem' }}>
            ⏱ 10–15 minutes
          </div>
          
          <ul style={{ textAlign: 'left', listStyle: 'none', padding: 0, margin: '0 0 2rem 0', flexGrow: 1 }}>
            <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#6366f1' }}>✓</span> Everything in Quick Check, plus:</li>
            <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#6366f1' }}>✓</span> Tax optimization & regime comparison</li>
            <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#6366f1' }}>✓</span> Debt payoff strategies</li>
            <li style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><span style={{ color: '#6366f1' }}>✓</span> Investment portfolio & goals</li>
          </ul>

          <button onClick={() => handleStart('ultraProMax')} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '1rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.3s' }}>
            Start Full Analysis <ArrowRight size={20} />
          </button>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '1rem', marginBottom: 0 }}>Recommended if you have SIPs, loans, stocks, or own property</p>
        </div>
      </div>
      
      <div className="text-center mt-4">
        <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', padding: '0.5rem 1.5rem' }}>
          Back to Calculators
        </Link>
      </div>
    </div>
  );
};

export default LandingScreen;
