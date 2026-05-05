import React from 'react';
import { FinanceProvider } from '../../components/finance/PersonalFinanceContext';
import PersonalFinanceApp from '../../components/finance/PersonalFinanceApp';

const PersonalFinanceCalculator = () => {
  return (
    <FinanceProvider>
      <PersonalFinanceApp />
    </FinanceProvider>
  );
};

export default PersonalFinanceCalculator;
