import React from 'react';
import { useFinance } from './PersonalFinanceContext';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line } from 'recharts';
import { Download, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import html2pdf from 'html2pdf.js';

const Dashboard = () => {
  const { state, setStep } = useFinance();
  const isPro = state.mode === 'ultraProMax';

  // Calculations
  const income = parseFloat(state.income.monthlyTakeHome) || 50000;
  const expHome = parseFloat(state.expenses.home) || 0;
  const expEmis = parseFloat(state.expenses.emis) || 0;
  const expFood = parseFloat(state.expenses.food) || 0;
  const expTransport = parseFloat(state.expenses.transport) || 0;
  const expLifestyle = parseFloat(state.expenses.lifestyle) || 0;
  const expOthers = parseFloat(state.expenses.others) || 0;
  const totalExp = expHome + expEmis + expFood + expTransport + expLifestyle + expOthers;
  const surplus = income - totalExp;

  const savingsRate = income > 0 ? ((surplus / income) * 100).toFixed(1) : 0;
  const expenseRatio = income > 0 ? ((totalExp / income) * 100).toFixed(1) : 0;

  // Chart Data
  const expenseData = [
    { name: 'Home', value: expHome },
    { name: 'EMIs', value: expEmis },
    { name: 'Food', value: expFood },
    { name: 'Transport', value: expTransport },
    { name: 'Lifestyle', value: expLifestyle },
    { name: 'Others', value: expOthers },
  ].filter(d => d.value > 0);

  const COLORS = ['#6366f1', '#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const incomeVsExpenseData = [
    { name: 'Monthly', Income: income, Expenses: totalExp, Savings: surplus > 0 ? surplus : 0 }
  ];

  // Pro Projections Data
  const generateProjections = () => {
    let data = [];
    let current = 0;
    const sip = surplus > 0 ? surplus : 0;
    for (let i = 0; i <= 30; i += 5) {
      if (i === 0) {
        data.push({ year: 'Now', Portfolio: current });
      } else {
        // Simple FV calculation (12% return assumed)
        const r = 0.12 / 12;
        const n = i * 12;
        const fv = sip * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
        data.push({ year: `Year ${i}`, Portfolio: Math.round(fv) });
      }
    }
    return data;
  };

  const projectionData = generateProjections();

  const handleDownload = () => {
    const element = document.getElementById('dashboard-report');
    html2pdf().from(element).set({
      margin: 1,
      filename: `Financial_Report_${state.profile.name || 'User'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    }).save();
  };

  const renderNormalDashboard = () => (
    <div id="dashboard-report" className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient mb-2">Your Financial Snapshot</h1>
          <p className="text-secondary">Hi {state.profile.name || 'there'}, here is your quick check result.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => setStep(1)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={16} /> Edit Data
          </button>
          <button onClick={handleDownload} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Download size={16} /> Export PDF
          </button>
        </div>
      </div>

      {/* 3 Key Numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="glass-panel p-4 text-center hover-lift" style={{ background: 'linear-gradient(145deg, rgba(59, 130, 246, 0.05) 0%, rgba(0,0,0,0.2) 100%)', borderTop: '4px solid #3b82f6' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Monthly Income</p>
          <h2 style={{ color: '#3b82f6', margin: '0.5rem 0' }}>₹{income.toLocaleString()}</h2>
        </div>
        <div className="glass-panel p-4 text-center hover-lift" style={{ background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.05) 0%, rgba(0,0,0,0.2) 100%)', borderTop: '4px solid #ef4444' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Monthly Expenses</p>
          <h2 style={{ color: '#ef4444', margin: '0.5rem 0' }}>₹{totalExp.toLocaleString()}</h2>
        </div>
        <div className="glass-panel p-4 text-center hover-lift" style={{ borderTop: `4px solid ${surplus >= 0 ? '#10b981' : '#ef4444'}`, background: `linear-gradient(145deg, rgba(${surplus >= 0 ? '16, 185, 129' : '239, 68, 68'}, 0.05) 0%, rgba(0,0,0,0.2) 100%)` }}>
          <p style={{ color: 'var(--text-secondary)' }}>Monthly Surplus</p>
          <h2 style={{ color: surplus >= 0 ? '#10b981' : '#ef4444', margin: '0.5rem 0' }}>₹{surplus.toLocaleString()}</h2>
          <p style={{ fontSize: '0.8rem', color: surplus >= 0 ? '#10b981' : '#ef4444' }}>
            {surplus >= 0 ? "You have this to save or invest" : "Your expenses exceed your income!"}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        <div className="glass-panel p-4">
          <h3 style={{ marginBottom: '1.5rem' }}>Health Check</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <span>Savings Rate</span>
              <span style={{ color: savingsRate >= 20 ? '#10b981' : '#f59e0b', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {savingsRate}% {savingsRate >= 20 ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <span>Expense Ratio</span>
              <span style={{ color: expenseRatio <= 70 ? '#10b981' : '#ef4444', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {expenseRatio}% {expenseRatio <= 70 ? <CheckCircle size={16}/> : <AlertTriangle size={16}/>}
              </span>
            </div>
          </div>

          <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Actionable Tips</h3>
          <ul style={{ paddingLeft: '1.2rem', color: 'var(--text-secondary)' }}>
            {savingsRate < 20 && <li style={{ marginBottom: '0.5rem' }}>Try to save at least 20% of your income. Trimming ₹{Math.round(income*0.2 - surplus)} from lifestyle expenses will get you there.</li>}
            {surplus > 0 && <li style={{ marginBottom: '0.5rem' }}>Investing your surplus of ₹{surplus.toLocaleString()} in a SIP at 12% could grow to ₹{Math.round(surplus * 230).toLocaleString()} in 10 years!</li>}
            {expenseRatio > 70 && <li style={{ marginBottom: '0.5rem' }}>Your expenses are consuming a large chunk of income. Track your 'Others' and 'Lifestyle' spending closely.</li>}
          </ul>
        </div>
        
        <div className="glass-panel p-4">
          <h3 style={{ marginBottom: '1.5rem' }}>Expense Breakdown</h3>
          <div style={{ width: '100%', height: '300px' }}>
            {expenseData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expenseData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                    {expenseData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-secondary text-center" style={{ marginTop: '100px' }}>No expenses logged.</p>}
          </div>
        </div>
      </div>
    </div>
  );

  const renderProDashboard = () => (
    <div id="dashboard-report" className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient mb-2">Full Financial Analysis</h1>
          <p className="text-secondary">Comprehensive blueprint for {state.profile.name || 'User'}.</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={() => setStep(1)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><RefreshCw size={16} /> Edit Data</button>
          <button onClick={handleDownload} style={{ background: '#6366f1', color: '#fff', border: 'none', padding: '0.5rem 1.5rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Download size={16} /> Export PDF</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <div className="glass-panel p-3" style={{ borderLeft: '3px solid #10b981' }}><p className="text-secondary mb-1">Net Income</p><h3 style={{ color: '#10b981' }}>₹{income.toLocaleString()}</h3></div>
        <div className="glass-panel p-3" style={{ borderLeft: '3px solid #ef4444' }}><p className="text-secondary mb-1">Expenses</p><h3 style={{ color: '#ef4444' }}>₹{totalExp.toLocaleString()}</h3></div>
        <div className="glass-panel p-3" style={{ borderLeft: '3px solid #3b82f6' }}><p className="text-secondary mb-1">Savings Rate</p><h3 style={{ color: '#3b82f6' }}>{savingsRate}%</h3></div>
        <div className="glass-panel p-3" style={{ borderLeft: '3px solid #8b5cf6' }}><p className="text-secondary mb-1">Score</p><h3 style={{ color: '#8b5cf6' }}>{savingsRate >= 20 ? 'Excellent' : 'Needs Work'}</h3></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="glass-panel p-4">
          <h3 className="mb-4">Cashflow Analysis</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeVsExpenseData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="name" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} cursor={{fill: 'rgba(255,255,255,0.05)'}}/>
                <Legend />
                <Bar dataKey="Income" fill="#3b82f6" radius={[4,4,0,0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4,4,0,0]} />
                <Bar dataKey="Savings" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass-panel p-4">
          <h3 className="mb-4">Wealth Projection (12% CAGR)</h3>
          <div style={{ width: '100%', height: '300px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="year" stroke="#888" />
                <YAxis stroke="#888" tickFormatter={(value) => `₹${(value/1000000).toFixed(1)}M`} />
                <Tooltip formatter={(value) => `₹${value.toLocaleString()}`} contentStyle={{ background: '#1a1a1a', border: '1px solid #333' }} />
                <Legend />
                <Line type="monotone" dataKey="Portfolio" stroke="#8b5cf6" strokeWidth={3} dot={{r: 4}} activeDot={{r: 8}} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      <div className="glass-panel p-4 text-center">
        <h3 className="mb-3 text-gradient">Tax Optimization & FIRE Simulation</h3>
        <p className="text-secondary mb-4">You are projected to reach Financial Independence in ~{Math.max(10, Math.floor(60 - (state.profile.age || 30)))} years at your current savings rate.</p>
        <div style={{ display: 'inline-block', padding: '1rem 2rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '8px', border: '1px solid #6366f1' }}>
          <Info size={20} color="#6366f1" style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          <span>Switch to New Regime if your 80C + 80D deductions are below ₹3.75L.</span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ marginTop: '2rem' }}>
      {isPro ? renderProDashboard() : renderNormalDashboard()}
    </div>
  );
};

export default Dashboard;
