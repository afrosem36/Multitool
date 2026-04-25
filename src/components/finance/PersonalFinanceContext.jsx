import React, { createContext, useContext, useEffect, useState } from 'react';

const FinanceContext = createContext(null);

export const useFinance = () => useContext(FinanceContext);

const initialState = {
  mode: null,
  currentStep: 0,
  profile: {
    name: '',
    age: 30,
    cityTier: 'Metro',
    employmentType: 'Salaried employee',
    currency: 'INR',
    gender: 'Prefer not to say',
    relationship: 'Single',
    dependents: 0,
    literacyLevel: 'Beginner',
  },
  income: {
    monthlyTakeHome: '',
    hasExtraIncome: false,
    extraIncomeSources: [],
    hasBonus: false,
    bonusAmount: '',
    isVariable: false,
    growthRate: 'Moderate (6-10%)',
    retirementAge: 60,
  },
  tax: {
    regime: 'New',
    deductions80C: '',
    deductions80D: '',
    hraExemption: '',
    homeLoanInterest: '',
    monthlyTax: 0,
  },
  expenses: {
    home: '',
    food: '',
    transport: '',
    health: '',
    lifestyle: '',
    emis: '',
    others: '',
    fixed: [],
    variable: [],
    annual: [],
    custom: [],
  },
  debt: {
    items: [],
    strategy: 'Avalanche',
    extraPayment: 0,
  },
  savings: {
    savesMoney: 'Yes',
    monthlySavingsAmount: '',
    hasEmergencyFund: 'No',
    liquidSavings: '',
    shortTermGoals: [],
  },
  investments: {
    hasBasicInvestments: false,
    basicItems: [],
    advancedItems: [],
    riskProfile: 'Moderate',
  },
  goals: [],
  netWorth: {
    assets: [],
    liabilities: [],
  },
  insurance: {
    lifeCover: '',
    healthCover: '',
    other: [],
  },
};

export const FinanceProvider = ({ children }) => {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem('finance_analyzer_state');
    return saved ? JSON.parse(saved) : initialState;
  });

  useEffect(() => {
    localStorage.setItem('finance_analyzer_state', JSON.stringify(state));
  }, [state]);

  const updateProfile = (data) => setState((prev) => ({ ...prev, profile: { ...prev.profile, ...data } }));
  const updateIncome = (data) => setState((prev) => ({ ...prev, income: { ...prev.income, ...data } }));
  const updateTax = (data) => setState((prev) => ({ ...prev, tax: { ...prev.tax, ...data } }));
  const updateExpenses = (data) => setState((prev) => ({ ...prev, expenses: { ...prev.expenses, ...data } }));
  const updateDebt = (data) => setState((prev) => ({ ...prev, debt: { ...prev.debt, ...data } }));
  const updateSavings = (data) => setState((prev) => ({ ...prev, savings: { ...prev.savings, ...data } }));
  const updateInvestments = (data) => setState((prev) => ({ ...prev, investments: { ...prev.investments, ...data } }));

  const setMode = (mode) => setState((prev) => ({ ...prev, mode }));
  const setStep = (step) => setState((prev) => ({ ...prev, currentStep: step }));
  const resetData = () => setState(initialState);

  return (
    <FinanceContext.Provider
      value={{
        state,
        updateProfile,
        updateIncome,
        updateTax,
        updateExpenses,
        updateDebt,
        updateSavings,
        updateInvestments,
        setMode,
        setStep,
        resetData,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};
