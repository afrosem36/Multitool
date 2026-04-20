import React from 'react';
import { useFinance } from './PersonalFinanceContext';
import { ArrowLeft, ArrowRight, User, Briefcase, IndianRupee, HandCoins, Building2, TrendingUp, Home } from 'lucide-react';

const NormalModeWizard = () => {
  const { state, updateProfile, updateIncome, updateExpenses, updateSavings, setStep, setMode } = useFinance();
  const step = state.currentStep;

  const nextStep = () => setStep(step + 1);
  const prevStep = () => {
    if (step === 1) setMode(null);
    else setStep(step - 1);
  };
  const finish = () => setStep(99); // 99 is results

  // Switch to Pro mode mid-way
  const switchToPro = () => setMode('ultraProMax');

  const renderProgress = () => (
    <div style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
        <span>Quick Check</span>
        <span>Step {step} of 4</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(step / 4) * 100}%`, background: '#10b981', transition: 'width 0.3s ease' }}></div>
      </div>
      <div style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', fontSize: '0.9rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Want more detail?</span>
        <button onClick={switchToPro} style={{ background: 'transparent', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: 'bold' }}>Switch to Full Analysis →</button>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="animate-fade-in">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Who are you?</h2>
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>What should we call you?</label>
          <div style={{ position: 'relative' }}>
            <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              value={state.profile.name}
              onChange={(e) => updateProfile({ name: e.target.value })}
              placeholder="Your first name"
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Your age: {state.profile.age}</label>
          <input 
            type="range" min="18" max="80" 
            value={state.profile.age}
            onChange={(e) => updateProfile({ age: parseInt(e.target.value) })}
            style={{ width: '100%', accentColor: '#10b981' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>City Type</label>
          <select 
            value={state.profile.cityTier}
            onChange={(e) => updateProfile({ cityTier: e.target.value })}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#1a1a1a', color: 'white' }}
          >
            <option value="Metro">Metro city (Mumbai, Delhi, Bangalore, etc.)</option>
            <option value="Tier-2">Tier-2 city (Jaipur, Lucknow, etc.)</option>
            <option value="Small town">Small town / Rural</option>
          </select>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="animate-fade-in">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Your Income</h2>
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Monthly take-home salary</label>
          <div style={{ position: 'relative' }}>
            <IndianRupee size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input 
              type="number" 
              value={state.income.monthlyTakeHome}
              onChange={(e) => updateIncome({ monthlyTakeHome: e.target.value })}
              placeholder="e.g. 50000"
              style={{ width: '100%', padding: '1rem 1rem 1rem 2.5rem', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>The amount credited to your bank account each month — after tax</p>
        </div>
        
        <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={state.income.hasExtraIncome} onChange={(e) => updateIncome({ hasExtraIncome: e.target.checked })} style={{ accentColor: '#10b981', width: '18px', height: '18px' }} />
            Any extra income? (Freelance, side hustle, rental)
          </label>
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="animate-fade-in">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Monthly Expenses</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Use the sliders to estimate your spending, or type the exact amount.</p>
      
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        {[
          { key: 'home', label: 'Home (Rent, electricity, maintenance)', icon: <Home size={18} /> },
          { key: 'emis', label: 'EMI Payments (Home loan, Car loan, etc.)', icon: <HandCoins size={18} /> },
          { key: 'food', label: 'Food (Groceries, dining out)', icon: <Building2 size={18} /> }, // using placeholder icons
          { key: 'transport', label: 'Transport (Fuel, cab, metro)', icon: <ArrowRight size={18} /> },
          { key: 'lifestyle', label: 'Lifestyle (Shopping, movies, hobbies)', icon: <User size={18} /> },
        ].map(cat => (
          <div key={cat.key}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
              {cat.icon} {cat.label}
            </label>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <input 
                type="range" min="0" max={state.income.monthlyTakeHome || 100000} 
                value={state.expenses[cat.key] || 0}
                onChange={(e) => updateExpenses({ [cat.key]: e.target.value })}
                style={{ flexGrow: 1, accentColor: '#10b981' }}
              />
              <div style={{ position: 'relative', width: '120px' }}>
                <span style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>₹</span>
                <input 
                  type="number" 
                  value={state.expenses[cat.key]}
                  onChange={(e) => updateExpenses({ [cat.key]: e.target.value })}
                  style={{ width: '100%', padding: '0.5rem 0.5rem 0.5rem 1.5rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="animate-fade-in">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}>Savings</h2>
      <div style={{ display: 'grid', gap: '1.5rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Do you save money every month?</label>
          <select 
            value={state.savings.savesMoney}
            onChange={(e) => updateSavings({ savesMoney: e.target.value })}
            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: '#1a1a1a', color: 'white' }}
          >
            <option value="Yes">Yes, regularly</option>
            <option value="Sometimes">Sometimes</option>
            <option value="No">Not right now</option>
          </select>
        </div>
        
        {state.savings.savesMoney !== 'No' && (
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>How much approximately?</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>₹</span>
              <input 
                type="number" 
                value={state.savings.monthlySavingsAmount}
                onChange={(e) => updateSavings({ monthlySavingsAmount: e.target.value })}
                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
              />
            </div>
          </div>
        )}
        
        <div>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Approximate savings in bank right now? (For emergencies)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>₹</span>
            <input 
              type="number" 
              value={state.savings.liquidSavings}
              onChange={(e) => updateSavings({ liquidSavings: e.target.value })}
              style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
            />
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="tool-container container" style={{ maxWidth: '650px' }}>
      <div className="glass-panel p-5" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
        {renderProgress()}
        
        <div style={{ minHeight: '300px' }}>
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
          {step === 4 && renderStep4()}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={prevStep} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
          
          {step < 4 ? (
            <button onClick={nextStep} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={finish} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              See My Results <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default NormalModeWizard;
