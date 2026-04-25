import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { Download, RefreshCw, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { useFinance } from './PersonalFinanceContext';
import {
  formatCompactInr,
  formatInrAmount,
  getExpenseChartData,
  getMonthlySnapshot,
} from './financeUtils';

const COLORS = ['#6366f1', '#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function buildProjectionData(monthlySip) {
  const rows = [{ year: 'Now', portfolio: 0 }];

  for (let years = 5; years <= 30; years += 5) {
    const monthlyRate = 0.12 / 12;
    const months = years * 12;
    const futureValue = monthlySip > 0
      ? monthlySip * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate) * (1 + monthlyRate)
      : 0;

    rows.push({
      year: `Year ${years}`,
      portfolio: Math.round(futureValue),
    });
  }

  return rows;
}

function StatCard({ title, value, accent, note }) {
  return (
    <div
      className="glass-panel hover-lift"
      style={{
        padding: '1.1rem',
        borderTop: `4px solid ${accent}`,
        background: `linear-gradient(145deg, ${accent}14 0%, rgba(0,0,0,0.25) 100%)`,
      }}
    >
      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>{title}</p>
      <h2 style={{ margin: '0.5rem 0 0.35rem', color: accent }}>{value}</h2>
      {note && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>{note}</p>}
    </div>
  );
}

function InsightRow({ label, value, ok, okText, warnText }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.95rem 1rem',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '10px',
      }}
    >
      <span>{label}</span>
      <span style={{ color: ok ? '#4ade80' : '#f59e0b', display: 'inline-flex', alignItems: 'center', gap: '0.45rem', fontWeight: 700 }}>
        {value}
        {ok ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{ok ? okText : warnText}</span>
      </span>
    </div>
  );
}

export default function Dashboard() {
  const { state, setStep } = useFinance();
  const isPro = state.mode === 'ultraProMax';

  const snapshot = useMemo(() => getMonthlySnapshot(state), [state]);
  const expenseData = useMemo(() => getExpenseChartData(snapshot.expenses), [snapshot.expenses]);
  const projectionData = useMemo(() => buildProjectionData(Math.max(snapshot.surplus, 0)), [snapshot.surplus]);

  const incomeVsExpenseData = [
    {
      name: 'Monthly',
      Income: snapshot.income,
      Expenses: snapshot.totalExpenses,
      Savings: Math.max(snapshot.surplus, 0),
    },
  ];

  const topExpense = expenseData.length > 0
    ? expenseData.reduce((largest, item) => (item.value > largest.value ? item : largest), expenseData[0])
    : null;

  const handleDownload = () => {
    const element = document.getElementById('finance-dashboard-report');
    html2pdf().from(element).set({
      margin: 0.5,
      filename: `Financial_Report_${state.profile.name || 'User'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
    }).save();
  };

  const advice = [
    snapshot.savingsRate < 20
      ? `Your savings rate is below 20%. Cutting roughly ${formatInrAmount(Math.max(snapshot.income * 0.2 - snapshot.surplus, 0))} from flexible categories would get you closer to a healthier buffer.`
      : `Your savings rate is in a healthy zone. Keep it consistent before raising lifestyle spend.`,
    snapshot.surplus > 0
      ? `If you invest your current monthly surplus of ${formatInrAmount(snapshot.surplus)} at 12% annual growth, it could compound to about ${formatCompactInr(projectionData[projectionData.length - 1].portfolio)} over 30 years.`
      : 'Your current cash flow is negative. The first win is reducing monthly outflow before taking on new goals.',
    topExpense
      ? `${topExpense.name} is your biggest expense bucket right now. Review that category first for the fastest improvement.`
      : 'Once you add expense values, the dashboard will highlight your biggest cost driver.',
  ];

  return (
    <div style={{ marginTop: '2rem' }}>
      <div id="finance-dashboard-report" className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <div>
            <h1 className="text-gradient mb-2" style={{ margin: 0 }}>
              {isPro ? 'Full Financial Analysis' : 'Your Financial Snapshot'}
            </h1>
            <p className="text-secondary" style={{ margin: '0.45rem 0 0' }}>
              Hi {state.profile.name || 'there'}, here is a clean view of your monthly money position.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => setStep(1)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={16} /> Edit Data
            </button>
            <button
              onClick={handleDownload}
              style={{ background: isPro ? '#6366f1' : '#10b981', color: '#fff', border: 'none', padding: '0.7rem 1.15rem', borderRadius: '10px', fontWeight: '700', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Download size={16} /> Export PDF
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${isPro ? 180 : 220}px, 1fr))`, gap: '1rem', marginBottom: '1.5rem' }}>
          <StatCard title="Monthly Income" value={formatInrAmount(snapshot.income)} accent="#3b82f6" />
          <StatCard title="Monthly Expenses" value={formatInrAmount(snapshot.totalExpenses)} accent="#ef4444" />
          <StatCard
            title="Monthly Surplus"
            value={formatInrAmount(snapshot.surplus)}
            accent={snapshot.surplus >= 0 ? '#10b981' : '#f97316'}
            note={snapshot.surplus >= 0 ? 'Available for saving, investing, or goal funding' : 'Expenses are currently above income'}
          />
          {isPro && (
            <StatCard
              title="Emergency Fund"
              value={`${snapshot.emergencyFundMonths} months`}
              accent="#8b5cf6"
              note="Based on liquid savings versus current monthly expenses"
            />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Health Check</h3>
            <div style={{ display: 'grid', gap: '0.85rem' }}>
              <InsightRow
                label="Savings Rate"
                value={`${snapshot.savingsRate}%`}
                ok={snapshot.savingsRate >= 20}
                okText="Healthy"
                warnText="Could improve"
              />
              <InsightRow
                label="Expense Ratio"
                value={`${snapshot.expenseRatio}%`}
                ok={snapshot.expenseRatio <= 75}
                okText="Managed"
                warnText="Heavy"
              />
              <InsightRow
                label="Emergency Cover"
                value={`${snapshot.emergencyFundMonths} months`}
                ok={snapshot.emergencyFundMonths >= 3}
                okText="Buffered"
                warnText="Thin buffer"
              />
            </div>

            <h3 style={{ margin: '1.5rem 0 0.9rem' }}>Actionable Guidance</h3>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {advice.map((tip) => (
                <div key={tip} style={{ padding: '0.9rem 1rem', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                  {tip}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Expense Breakdown</h3>
            <div style={{ width: '100%', height: '320px' }}>
              {expenseData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expenseData} cx="50%" cy="50%" innerRadius={68} outerRadius={105} paddingAngle={4} dataKey="value">
                      {expenseData.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatInrAmount(value)} contentStyle={{ background: '#171717', border: '1px solid #333' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}>
                  Add expense values to see your category split.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Cash Flow Comparison</h3>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={incomeVsExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="name" stroke="#888" />
                  <YAxis stroke="#888" tickFormatter={(value) => formatCompactInr(value).replace('Rs. ', '')} />
                  <Tooltip formatter={(value) => formatInrAmount(value)} contentStyle={{ background: '#171717', border: '1px solid #333' }} />
                  <Legend />
                  <Bar dataKey="Income" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Savings" fill="#10b981" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.25rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Long-Term Projection</h3>
            <div style={{ width: '100%', height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={projectionData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="year" stroke="#888" />
                  <YAxis stroke="#888" tickFormatter={(value) => formatCompactInr(value).replace('Rs. ', '')} />
                  <Tooltip formatter={(value) => formatInrAmount(value)} contentStyle={{ background: '#171717', border: '1px solid #333' }} />
                  <Legend />
                  <Line type="monotone" dataKey="portfolio" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 7 }} name="Projected Corpus" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {isPro && (
          <div className="glass-panel" style={{ padding: '1.25rem', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.18)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>Planning Note</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
              <Info size={18} color="#818cf8" style={{ verticalAlign: 'middle', marginRight: '0.45rem' }} />
              If your deduction stack is modest, compare the new tax regime carefully before assuming the old one is better. Your projected surplus suggests that long-term consistency will matter more than perfect timing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
