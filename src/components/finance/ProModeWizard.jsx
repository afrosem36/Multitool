import React, { useState } from 'react';
import { useFinance } from './PersonalFinanceContext';
import { ArrowLeft, ArrowRight, User, Briefcase, IndianRupee, PieChart, Landmark, TrendingUp, Shield, Target } from 'lucide-react';

const ProModeWizard = () => {
  const { state, updateProfile, updateIncome, updateTax, updateExpenses, updateDebt, updateInvestments, setStep, setMode } = useFinance();
  const step = state.currentStep;

  // Pro mode has 8 summarized steps to keep the UI manageable, matching the 14 module concept
  const totalSteps = 8;
  const sections = ['Profile', 'Income', 'Tax', 'Expenses', 'Debt', 'Investments', 'Goals', 'Net Worth'];

  const nextStep = () => setStep(step + 1);
  const prevStep = () => {
    if (step === 1) setMode(null);
    else setStep(step - 1);
  };
  const finish = () => setStep(99);

  const renderProgress = () => (
    <div style={{ marginBottom: '2rem', display: 'flex' }}>
      <div style={{ flex: '0 0 200px', paddingRight: '1rem', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: '#6366f1' }}>Full Analysis</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {sections.map((sec, idx) => (
            <li key={sec} style={{ 
              marginBottom: '0.5rem', 
              fontSize: '0.9rem',
              color: step > idx + 1 ? '#10b981' : step === idx + 1 ? 'white' : 'var(--text-secondary)',
              fontWeight: step === idx + 1 ? 'bold' : 'normal',
              display: 'flex', alignItems: 'center', gap: '0.5rem'
            }}>
              {step > idx + 1 ? '✓' : (idx + 1) + '.'} {sec}
            </li>
          ))}
        </ul>
      </div>
      <div style={{ flex: 1, paddingLeft: '2rem' }}>
        {/* Step Content Goes Here */}
        {renderStepContent()}
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch(step) {
      case 1:
        return (
          <div className="animate-fade-in">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}><User size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}/> Personal Profile</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div><label>First Name</label><input type="text" value={state.profile.name} onChange={e => updateProfile({name: e.target.value})} className="form-input" /></div>
              <div><label>Age</label><input type="number" value={state.profile.age} onChange={e => updateProfile({age: parseInt(e.target.value)})} className="form-input" /></div>
              <div><label>Employment</label>
                <select value={state.profile.employmentType} onChange={e => updateProfile({employmentType: e.target.value})} className="form-input">
                  <option>Salaried (Private)</option>
                  <option>Salaried (Govt)</option>
                  <option>Self-employed</option>
                  <option>Business Owner</option>
                </select>
              </div>
              <div><label>Dependents</label><input type="number" value={state.profile.dependents} onChange={e => updateProfile({dependents: parseInt(e.target.value)})} className="form-input" /></div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="animate-fade-in">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}><IndianRupee size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}/> Income Details</h2>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div><label>Monthly Take-Home Salary (₹)</label><input type="number" value={state.income.monthlyTakeHome} onChange={e => updateIncome({monthlyTakeHome: e.target.value})} className="form-input" /></div>
              <div><label>Annual Gross CTC (₹)</label><input type="number" placeholder="Optional" className="form-input" /></div>
              <div><label>Expected Career Growth</label>
                <select value={state.income.growthRate} onChange={e => updateIncome({growthRate: e.target.value})} className="form-input">
                  <option>Conservative (3-5%)</option>
                  <option>Moderate (6-10%)</option>
                  <option>Aggressive (10-15%)</option>
                </select>
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="animate-fade-in">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}><Landmark size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}/> Tax Calculator</h2>
            <p style={{ color: 'var(--text-secondary)' }}>We'll help you decide between Old vs New regime.</p>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div><label>Preferred Tax Regime</label>
                <select value={state.tax.regime} onChange={e => updateTax({regime: e.target.value})} className="form-input">
                  <option>New Regime (Default 2024)</option>
                  <option>Old Regime (with deductions)</option>
                </select>
              </div>
              {state.tax.regime.includes('Old') && (
                <>
                  <div><label>80C Deductions (EPF, PPF, ELSS up to 1.5L)</label><input type="number" value={state.tax.deductions80C} onChange={e => updateTax({deductions80C: e.target.value})} className="form-input" /></div>
                  <div><label>80D Health Insurance Premium</label><input type="number" value={state.tax.deductions80D} onChange={e => updateTax({deductions80D: e.target.value})} className="form-input" /></div>
                  <div><label>Home Loan Interest (Section 24b)</label><input type="number" value={state.tax.homeLoanInterest} onChange={e => updateTax({homeLoanInterest: e.target.value})} className="form-input" /></div>
                </>
              )}
            </div>
          </div>
        );
      case 4:
        return (
          <div className="animate-fade-in">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}><PieChart size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}/> Expense Tracking</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div><label>Rent / Home Loan EMI</label><input type="number" value={state.expenses.home} onChange={e => updateExpenses({home: e.target.value})} className="form-input" /></div>
              <div><label>Food & Groceries</label><input type="number" value={state.expenses.food} onChange={e => updateExpenses({food: e.target.value})} className="form-input" /></div>
              <div><label>Utilities & Internet</label><input type="number" value={state.expenses.others} onChange={e => updateExpenses({others: e.target.value})} className="form-input" /></div>
              <div><label>Lifestyle & Entertainment</label><input type="number" value={state.expenses.lifestyle} onChange={e => updateExpenses({lifestyle: e.target.value})} className="form-input" /></div>
            </div>
          </div>
        );
      case 5:
        const handleAddDebt = () => {
          updateDebt({ items: [...state.debt.items, { name: '', balance: '', rate: '', emi: '' }] });
        };
        const handleDebtChange = (index, field, value) => {
          const newItems = [...state.debt.items];
          newItems[index][field] = value;
          updateDebt({ items: newItems });
        };
        const handleRemoveDebt = (index) => {
          const newItems = state.debt.items.filter((_, i) => i !== index);
          updateDebt({ items: newItems });
        };

        return (
          <div className="animate-fade-in">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}><Shield size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}/> Debt Management</h2>
            <p style={{ color: 'var(--text-secondary)' }}>Add your ongoing loans to calculate payoff strategies.</p>
            
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              {state.debt.items.map((debt, index) => (
                <div key={index} className="glass-panel" style={{ padding: '1rem', position: 'relative', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button onClick={() => handleRemoveDebt(index)} style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1.2rem', padding: '0.2rem 0.5rem' }}>×</button>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div><label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Loan Name</label><input type="text" value={debt.name} onChange={e => handleDebtChange(index, 'name', e.target.value)} placeholder="e.g. Car Loan" className="form-input" style={{ marginTop: '0.25rem' }} /></div>
                    <div><label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Balance (₹)</label><input type="number" value={debt.balance} onChange={e => handleDebtChange(index, 'balance', e.target.value)} placeholder="e.g. 500000" className="form-input" style={{ marginTop: '0.25rem' }} /></div>
                    <div><label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Interest Rate (%)</label><input type="number" value={debt.rate} onChange={e => handleDebtChange(index, 'rate', e.target.value)} placeholder="e.g. 9.5" className="form-input" style={{ marginTop: '0.25rem' }} /></div>
                    <div><label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Monthly EMI (₹)</label><input type="number" value={debt.emi} onChange={e => handleDebtChange(index, 'emi', e.target.value)} placeholder="e.g. 12000" className="form-input" style={{ marginTop: '0.25rem' }} /></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="glass-panel" style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', textAlign: 'center' }}>
              {state.debt.items.length === 0 && <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>No loans added yet.</p>}
              <button onClick={handleAddDebt} className="btn-secondary">+ Add Loan / Credit Card</button>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="animate-fade-in">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}><TrendingUp size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}/> Investments</h2>
            <div style={{ display: 'grid', gap: '1.5rem' }}>
              <div><label>Total Mutual Funds / Equity Corpus (₹)</label><input type="number" className="form-input" /></div>
              <div><label>Total EPF/PPF/Debt Corpus (₹)</label><input type="number" className="form-input" /></div>
              <div><label>Monthly SIP Amount (₹)</label><input type="number" className="form-input" /></div>
            </div>
          </div>
        );
      case 7:
      case 8:
        return (
          <div className="animate-fade-in">
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent-primary)' }}><Target size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }}/> Goals & Net Worth</h2>
            <p style={{ color: 'var(--text-secondary)' }}>We'll use your inputs to project your financial independence timeline.</p>
            <div style={{ marginTop: '2rem', padding: '1.5rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
              <h3 style={{ color: '#6366f1', marginBottom: '0.5rem' }}>Almost done!</h3>
              <p>Click "Generate Full Analysis" to see your complete financial blueprint, including 9 advanced charts, tax optimization, and retirement projections.</p>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '900px' }}>
      <style>{`
        .form-input { width: 100%; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: white; display: block; margin-top: 0.5rem; transition: all 0.3s ease; }
        .form-input:focus { border-color: #6366f1; box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.2); outline: none; }
      `}</style>
      <div className="glass-panel p-5" style={{ background: 'linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%)', border: '1px solid rgba(255,255,255,0.1)' }}>
        
        {renderProgress()}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={prevStep} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ArrowLeft size={16} /> Back
          </button>
          
          {step < totalSteps ? (
            <button onClick={nextStep} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button onClick={finish} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Generate Full Analysis <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProModeWizard;
