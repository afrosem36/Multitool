import React from 'react';
import {
  ArrowLeft,
  ArrowRight,
  User,
  Landmark,
  IndianRupee,
  PieChart,
  Shield,
  TrendingUp,
  Target,
} from 'lucide-react';
import { useFinance } from './PersonalFinanceContext';

const sections = ['Profile', 'Income', 'Tax', 'Expenses', 'Debt', 'Investments', 'Goals', 'Finish'];

const fieldStyle = {
  width: '100%',
  padding: '0.8rem 1rem',
  borderRadius: '10px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(0,0,0,0.2)',
  color: 'white',
  marginTop: '0.45rem',
  outline: 'none',
};

function CurrencyField(props) {
  return (
    <div style={{ position: 'relative', marginTop: '0.45rem' }}>
      <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>Rs.</span>
      <input {...props} style={{ ...fieldStyle, marginTop: 0, paddingLeft: '3rem' }} />
    </div>
  );
}

export default function ProModeWizard() {
  const { state, updateProfile, updateIncome, updateTax, updateExpenses, updateDebt, setStep, setMode } = useFinance();
  const step = state.currentStep;
  const totalSteps = sections.length;

  const nextStep = () => setStep(Math.min(step + 1, totalSteps));
  const prevStep = () => {
    if (step === 1) {
      setMode(null);
      return;
    }
    setStep(step - 1);
  };
  const finish = () => setStep(99);

  const handleAddDebt = () => {
    updateDebt({ items: [...state.debt.items, { name: '', balance: '', rate: '', emi: '' }] });
  };

  const handleDebtChange = (index, field, value) => {
    const nextItems = [...state.debt.items];
    nextItems[index][field] = value;
    updateDebt({ items: nextItems });
  };

  const handleRemoveDebt = (index) => {
    updateDebt({ items: state.debt.items.filter((_, itemIndex) => itemIndex !== index) });
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '960px' }}>
      <div className="glass-panel p-5" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.22) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: '1.5rem' }}>
          <aside style={{ paddingRight: '1rem', borderRight: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 style={{ marginTop: 0, color: '#818cf8' }}>Full Analysis</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>Step {step} of {totalSteps}</p>
            <div style={{ display: 'grid', gap: '0.55rem' }}>
              {sections.map((section, index) => (
                <div
                  key={section}
                  style={{
                    padding: '0.7rem 0.85rem',
                    borderRadius: '10px',
                    background: index + 1 === step ? 'rgba(99, 102, 241, 0.14)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${index + 1 === step ? 'rgba(99, 102, 241, 0.26)' : 'rgba(255,255,255,0.06)'}`,
                    color: index + 1 < step ? '#4ade80' : index + 1 === step ? '#c7d2fe' : 'var(--text-secondary)',
                    fontWeight: index + 1 === step ? 700 : 500,
                  }}
                >
                  {index + 1}. {section}
                </div>
              ))}
            </div>
          </aside>

          <div style={{ minHeight: '460px' }}>
            {step === 1 && (
              <div className="animate-fade-in">
                <h2 style={{ marginTop: 0, color: 'var(--accent-primary)' }}><User size={22} style={{ verticalAlign: 'middle', marginRight: '0.45rem' }} />Personal Profile</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <label>First name<input type="text" value={state.profile.name} onChange={(event) => updateProfile({ name: event.target.value })} style={fieldStyle} /></label>
                  <label>Age<input type="number" value={state.profile.age} onChange={(event) => updateProfile({ age: Number(event.target.value) })} style={fieldStyle} /></label>
                  <label>
                    Employment
                    <select value={state.profile.employmentType} onChange={(event) => updateProfile({ employmentType: event.target.value })} style={fieldStyle}>
                      <option>Salaried (Private)</option>
                      <option>Salaried (Govt)</option>
                      <option>Self-employed</option>
                      <option>Business Owner</option>
                    </select>
                  </label>
                  <label>Dependents<input type="number" value={state.profile.dependents} onChange={(event) => updateProfile({ dependents: Number(event.target.value) })} style={fieldStyle} /></label>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-fade-in">
                <h2 style={{ marginTop: 0, color: 'var(--accent-primary)' }}><IndianRupee size={22} style={{ verticalAlign: 'middle', marginRight: '0.45rem' }} />Income Details</h2>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <label>Monthly take-home income<CurrencyField type="number" value={state.income.monthlyTakeHome} onChange={(event) => updateIncome({ monthlyTakeHome: event.target.value })} placeholder="80,000" /></label>
                  <label>Expected career growth
                    <select value={state.income.growthRate} onChange={(event) => updateIncome({ growthRate: event.target.value })} style={fieldStyle}>
                      <option>Conservative (3-5%)</option>
                      <option>Moderate (6-10%)</option>
                      <option>Aggressive (10-15%)</option>
                    </select>
                  </label>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="animate-fade-in">
                <h2 style={{ marginTop: 0, color: 'var(--accent-primary)' }}><Landmark size={22} style={{ verticalAlign: 'middle', marginRight: '0.45rem' }} />Tax Inputs</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Use these only if you want a better sense of how deductions affect your planning.</p>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <label>Preferred regime
                    <select value={state.tax.regime} onChange={(event) => updateTax({ regime: event.target.value })} style={fieldStyle}>
                      <option>New Regime</option>
                      <option>Old Regime</option>
                    </select>
                  </label>
                  {state.tax.regime === 'Old Regime' && (
                    <>
                      <label>80C deductions<CurrencyField type="number" value={state.tax.deductions80C} onChange={(event) => updateTax({ deductions80C: event.target.value })} placeholder="1,50,000" /></label>
                      <label>80D deductions<CurrencyField type="number" value={state.tax.deductions80D} onChange={(event) => updateTax({ deductions80D: event.target.value })} placeholder="25,000" /></label>
                      <label>Home loan interest<CurrencyField type="number" value={state.tax.homeLoanInterest} onChange={(event) => updateTax({ homeLoanInterest: event.target.value })} placeholder="2,00,000" /></label>
                    </>
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="animate-fade-in">
                <h2 style={{ marginTop: 0, color: 'var(--accent-primary)' }}><PieChart size={22} style={{ verticalAlign: 'middle', marginRight: '0.45rem' }} />Expense Inputs</h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <label>Home / rent<CurrencyField type="number" value={state.expenses.home} onChange={(event) => updateExpenses({ home: event.target.value })} placeholder="20,000" /></label>
                  <label>Food and groceries<CurrencyField type="number" value={state.expenses.food} onChange={(event) => updateExpenses({ food: event.target.value })} placeholder="8,000" /></label>
                  <label>Transport<CurrencyField type="number" value={state.expenses.transport} onChange={(event) => updateExpenses({ transport: event.target.value })} placeholder="5,000" /></label>
                  <label>Lifestyle<CurrencyField type="number" value={state.expenses.lifestyle} onChange={(event) => updateExpenses({ lifestyle: event.target.value })} placeholder="7,000" /></label>
                  <label>EMIs<CurrencyField type="number" value={state.expenses.emis} onChange={(event) => updateExpenses({ emis: event.target.value })} placeholder="15,000" /></label>
                  <label>Other monthly spend<CurrencyField type="number" value={state.expenses.others} onChange={(event) => updateExpenses({ others: event.target.value })} placeholder="4,000" /></label>
                </div>
              </div>
            )}

            {step === 5 && (
              <div className="animate-fade-in">
                <h2 style={{ marginTop: 0, color: 'var(--accent-primary)' }}><Shield size={22} style={{ verticalAlign: 'middle', marginRight: '0.45rem' }} />Debt</h2>
                <p style={{ color: 'var(--text-secondary)' }}>Add active loans or card balances if you want a more realistic picture.</p>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {state.debt.items.map((debt, index) => (
                    <div key={`${debt.name}-${index}`} className="glass-panel" style={{ padding: '1rem', position: 'relative', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <button onClick={() => handleRemoveDebt(index)} style={{ position: 'absolute', right: '0.75rem', top: '0.75rem', background: 'transparent', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '1rem' }}>
                        Remove
                      </button>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <label>Loan name<input type="text" value={debt.name} onChange={(event) => handleDebtChange(index, 'name', event.target.value)} style={fieldStyle} placeholder="Car loan" /></label>
                        <label>Balance<CurrencyField type="number" value={debt.balance} onChange={(event) => handleDebtChange(index, 'balance', event.target.value)} placeholder="4,50,000" /></label>
                        <label>Interest rate<input type="number" value={debt.rate} onChange={(event) => handleDebtChange(index, 'rate', event.target.value)} style={fieldStyle} placeholder="10.5" /></label>
                        <label>Monthly EMI<CurrencyField type="number" value={debt.emi} onChange={(event) => handleDebtChange(index, 'emi', event.target.value)} placeholder="12,000" /></label>
                      </div>
                    </div>
                  ))}
                  <button onClick={handleAddDebt} className="btn-secondary" style={{ width: 'fit-content' }}>
                    Add Loan
                  </button>
                </div>
              </div>
            )}

            {step === 6 && (
              <div className="animate-fade-in">
                <h2 style={{ marginTop: 0, color: 'var(--accent-primary)' }}><TrendingUp size={22} style={{ verticalAlign: 'middle', marginRight: '0.45rem' }} />Investments</h2>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <label>Mutual funds / equity corpus<CurrencyField type="number" placeholder="3,50,000" /></label>
                  <label>Debt / EPF / PPF corpus<CurrencyField type="number" placeholder="5,00,000" /></label>
                  <label>Monthly SIP amount<CurrencyField type="number" placeholder="15,000" /></label>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="animate-fade-in">
                <h2 style={{ marginTop: 0, color: 'var(--accent-primary)' }}><Target size={22} style={{ verticalAlign: 'middle', marginRight: '0.45rem' }} />Goals</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  Think about what matters next: emergency reserves, loan reduction, travel, a home upgrade, or long-term wealth building. The dashboard will use your monthly cash flow to show what looks realistic from here.
                </p>
              </div>
            )}

            {step === 8 && (
              <div className="animate-fade-in">
                <h2 style={{ marginTop: 0, color: 'var(--accent-primary)' }}><Target size={22} style={{ verticalAlign: 'middle', marginRight: '0.45rem' }} />Ready to Generate</h2>
                <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                    Your full dashboard will combine cash flow, expenses, debt, and long-term projections into a cleaner decision view. You can still come back and edit everything later.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={prevStep} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
          {step < totalSteps ? (
            <button onClick={nextStep} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.8rem 1.2rem', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={finish} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.8rem 1.2rem', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              Generate Full Analysis <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
