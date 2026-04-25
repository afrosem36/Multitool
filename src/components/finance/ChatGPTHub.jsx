import React from 'react';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { useFinance } from './PersonalFinanceContext';
import { formatInrAmount, getMonthlySnapshot } from './financeUtils';

export default function ChatGPTHub() {
  const { state } = useFinance();
  const snapshot = getMonthlySnapshot(state);

  const handleAskChatGPT = (question) => {
    const prompt = `Here are my financial details. Please analyze them and answer my specific question.

--- MY FINANCES ---
Name: ${state.profile.name || 'User'}
Age: ${state.profile.age}
City Type: ${state.profile.cityTier}
Employment: ${state.profile.employmentType}

Monthly Income: ${formatInrAmount(snapshot.income)}
Monthly Expenses: ${formatInrAmount(snapshot.totalExpenses)}
Monthly Surplus: ${formatInrAmount(snapshot.surplus)}
Savings Strategy: ${state.savings.savesMoney}
Emergency Fund: ${formatInrAmount(state.savings.liquidSavings || 0)}

--- MY QUESTION ---
${question}

Give me specific, data-driven, actionable advice tailored to my exact situation. Do not give generic advice.`;

    window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, '_blank', 'noopener,noreferrer');
  };

  const questions = state.mode === 'ultraProMax'
    ? [
        'Am I investing enough for my age?',
        'What is the best strategy to pay off multiple loans?',
        'Should I choose the old or new tax regime?',
        'How much corpus do I need to retire comfortably?',
        'How do I rebalance my portfolio?',
        'What is the true cost of my current debt-to-income ratio?',
      ]
    : [
        'Am I saving enough every month?',
        'Does my budget roughly follow the 50/30/20 rule?',
        'How do I stop overspending?',
        'What are the best ways to cut my monthly expenses?',
      ];

  return (
    <div className="glass-panel p-5 mt-5 animate-fade-in" style={{ border: '1px solid rgba(16, 185, 129, 0.28)', background: 'linear-gradient(145deg, rgba(16,185,129,0.05) 0%, rgba(0,0,0,0) 100%)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
        <div style={{ background: '#10b981', padding: '0.75rem', borderRadius: '50%' }}>
          <MessageSquare size={24} color="white" />
        </div>
        <div>
          <h2 style={{ margin: 0 }}>Questions about your finances?</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
            Click any question and we will prepare a finance-aware prompt for ChatGPT automatically.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
        {questions.map((question) => (
          <button
            key={question}
            onClick={() => handleAskChatGPT(question)}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '1rem',
              borderRadius: '10px',
              textAlign: 'left',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
            }}
          >
            <span>{question}</span>
            <ExternalLink size={16} color="#10b981" style={{ flexShrink: 0 }} />
          </button>
        ))}
      </div>

      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '1.5rem', textAlign: 'center' }}>
        Privacy note: your finance inputs stay in this app until you choose to open ChatGPT with a generated prompt.
      </p>
    </div>
  );
}
