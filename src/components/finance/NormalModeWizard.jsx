import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  User,
  IndianRupee,
  HandCoins,
  Home,
  UtensilsCrossed,
  Car,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';
import { useFinance } from './PersonalFinanceContext';

const fieldStyle = {
  width: '100%',
  padding: '0.85rem 1rem',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.2)',
  color: 'white',
  outline: 'none',
};

const expenseFields = [
  { key: 'home', label: 'Home and utilities', icon: Home },
  { key: 'emis', label: 'EMIs and debt payments', icon: HandCoins },
  { key: 'food', label: 'Food and groceries', icon: UtensilsCrossed },
  { key: 'transport', label: 'Transport', icon: Car },
  { key: 'lifestyle', label: 'Lifestyle and shopping', icon: Sparkles },
  { key: 'others', label: 'Other recurring spend', icon: HeartHandshake },
];

function Progress({ step }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.45rem', fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
        <span>Quick Check</span>
        <span>Step {step} of 4</span>
      </div>
      <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(step / 4) * 100}%`, background: 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)', transition: 'width 0.25s ease' }} />
      </div>
    </div>
  );
}

function CurrencyInput({ value, onChange, placeholder = '50,000' }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>Rs.</span>
      <input
        type="number"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...fieldStyle, paddingLeft: '3rem' }}
      />
    </div>
  );
}

export default function NormalModeWizard() {
  const { state, updateProfile, updateIncome, updateExpenses, updateSavings, setStep, setMode } = useFinance();
  const step = state.currentStep;

  const nextStep = () => setStep(step + 1);
  const prevStep = () => {
    if (step === 1) {
      setMode(null);
      return;
    }
    setStep(step - 1);
  };

  const finish = () => setStep(99);

  return (
    <div className="tool-container container" style={{ maxWidth: '720px' }}>
      <div className="glass-panel p-5" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.25) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Progress step={step} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--accent-primary)' }}>
              {step === 1 && 'Tell me about you'}
              {step === 2 && 'Your income'}
              {step === 3 && 'Monthly expenses'}
              {step === 4 && 'Savings position'}
            </h2>
            <p style={{ margin: '0.45rem 0 0', color: 'var(--text-secondary)' }}>
              {step === 1 && 'A little context helps tailor the advice.'}
              {step === 2 && 'Use your real monthly take-home amount if you know it.'}
              {step === 3 && 'Rough estimates are fine. We just need a clear monthly picture.'}
              {step === 4 && 'This helps us understand resilience, not just income.'}
            </p>
          </div>
          <button onClick={() => setMode('ultraProMax')} className="btn-secondary" style={{ whiteSpace: 'nowrap' }}>
            Switch to Full Analysis
          </button>
        </div>

        <div style={{ minHeight: '340px', display: 'grid', gap: '1rem' }}>
          {step === 1 && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Name</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="text"
                    value={state.profile.name}
                    onChange={(event) => updateProfile({ name: event.target.value })}
                    placeholder="Your first name"
                    style={{ ...fieldStyle, paddingLeft: '2.8rem' }}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Age: {state.profile.age}</label>
                <input
                  type="range"
                  min="18"
                  max="80"
                  value={state.profile.age}
                  onChange={(event) => updateProfile({ age: Number(event.target.value) })}
                  style={{ width: '100%', accentColor: '#10b981' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>City Type</label>
                <select value={state.profile.cityTier} onChange={(event) => updateProfile({ cityTier: event.target.value })} style={fieldStyle}>
                  <option value="Metro">Metro city</option>
                  <option value="Tier-2">Tier-2 city</option>
                  <option value="Small town">Small town or rural</option>
                </select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Monthly take-home income</label>
                <div style={{ position: 'relative' }}>
                  <IndianRupee size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                  <input
                    type="number"
                    value={state.income.monthlyTakeHome}
                    onChange={(event) => updateIncome({ monthlyTakeHome: event.target.value })}
                    placeholder="50,000"
                    style={{ ...fieldStyle, paddingLeft: '2.8rem', fontSize: '1.05rem' }}
                  />
                </div>
                <p style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Use the amount that lands in your bank account after deductions.
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', padding: '1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={state.income.hasExtraIncome}
                  onChange={(event) => updateIncome({ hasExtraIncome: event.target.checked })}
                  style={{ accentColor: '#10b981', width: '18px', height: '18px' }}
                />
                <span>Include extra income like freelance work, rent, or side hustle</span>
              </label>
            </>
          )}

          {step === 3 && (
            <>
              {expenseFields.map(({ key, label, icon: Icon }) => (
                <div key={key}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                    <Icon size={16} /> {label}
                  </label>
                  <CurrencyInput
                    value={state.expenses[key]}
                    onChange={(event) => updateExpenses({ [key]: event.target.value })}
                  />
                </div>
              ))}
            </>
          )}

          {step === 4 && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Do you save money most months?</label>
                <select value={state.savings.savesMoney} onChange={(event) => updateSavings({ savesMoney: event.target.value })} style={fieldStyle}>
                  <option value="Yes">Yes, regularly</option>
                  <option value="Sometimes">Sometimes</option>
                  <option value="No">Not right now</option>
                </select>
              </div>

              {state.savings.savesMoney !== 'No' && (
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Approximate monthly savings</label>
                  <CurrencyInput
                    value={state.savings.monthlySavingsAmount}
                    onChange={(event) => updateSavings({ monthlySavingsAmount: event.target.value })}
                    placeholder="10,000"
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Emergency savings available right now</label>
                <CurrencyInput
                  value={state.savings.liquidSavings}
                  onChange={(event) => updateSavings({ liquidSavings: event.target.value })}
                  placeholder="1,00,000"
                />
              </div>
            </>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={prevStep} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> Back
          </button>

          {step < 4 ? (
            <button onClick={nextStep} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.8rem 1.2rem', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={finish} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.8rem 1.2rem', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              See My Results <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
