import React from 'react';
import { useFinance } from './PersonalFinanceContext';
import LandingScreen from './LandingScreen';
import NormalModeWizard from './NormalModeWizard';
import ProModeWizard from './ProModeWizard';
import Dashboard from './Dashboard';
import ChatGPTHub from './ChatGPTHub';

const PersonalFinanceApp = () => {
  const { state } = useFinance();

  if (!state.mode) {
    return <LandingScreen />;
  }

  // We consider step 99 to be the Dashboard/Results
  if (state.currentStep === 99) {
    return (
      <div className="container" style={{ maxWidth: '1200px' }}>
        <Dashboard />
        <ChatGPTHub />
      </div>
    );
  }

  if (state.mode === 'normal') {
    return <NormalModeWizard />;
  }

  if (state.mode === 'ultraProMax') {
    return <ProModeWizard />;
  }

  return <LandingScreen />;
};

export default PersonalFinanceApp;
