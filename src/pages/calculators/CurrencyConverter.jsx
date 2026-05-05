import React, { useState, useEffect } from 'react';
import { IndianRupee, ArrowLeft, ArrowRightLeft, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../../hooks/useToolHistory';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import { formatNumberIN } from '../../utils/formatters';
import '../styles/ToolStyles.css';

const CurrencyConverter = () => {
  const [rates, setRates] = useState({});
  const [currencies, setCurrencies] = useState([]);
  const [amount, setAmount] = useState('1');
  const [fromCurrency, setFromCurrency] = useState('INR');
  const [toCurrency, setToCurrency] = useState('USD');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/currency', 'Currency Converter', 'indianRupee');
    fetchRates();
  }, [addHistory]);

  const fetchRates = async () => {
    try {
      setIsLoading(true);
      // Free public API for exchange rates, no key required
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) throw new Error('Failed to fetch exchange rates');
      const data = await response.json();
      setRates(data.rates);
      const sortedCurrencies = Object.keys(data.rates).sort((a, b) => {
        const priority = ['INR', 'USD', 'EUR', 'GBP'];
        const indexA = priority.indexOf(a);
        const indexB = priority.indexOf(b);

        if (indexA !== -1 || indexB !== -1) {
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        }

        return a.localeCompare(b);
      });
      setCurrencies(sortedCurrencies);
      setIsLoading(false);
    } catch (err) {
      console.error(err);
      setError('Unable to load live exchange rates. Please try again later.');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    calculate();
  }, [amount, fromCurrency, toCurrency, rates]);

  const calculate = () => {
    if (Object.keys(rates).length === 0) return;
    
    const val = parseFloat(amount);
    if (isNaN(val)) {
      setResult('');
      return;
    }

    // Convert from -> USD -> to
    const rateFromUSD = rates[fromCurrency];
    const rateToUSD = rates[toCurrency];
    
    if (rateFromUSD && rateToUSD) {
      const inUSD = val / rateFromUSD;
      const final = inUSD * rateToUSD;
      const decimals = toCurrency === 'INR' ? 2 : 4;
      setResult(Number(final).toFixed(decimals));
    }
  };

  const handleSwap = () => {
    const temp = fromCurrency;
    setFromCurrency(toCurrency);
    setToCurrency(temp);
  };

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Calculators
      </Link>
      
      <div className="tool-header text-center animate-fade-in">
        <IndianRupee size={48} className="text-gradient mx-auto mb-4" />
        <h1>Currency Converter</h1>
        <p>Live exchange rates with Indian Rupees ready by default.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
            <Loader2 className="spin text-gradient" size={32} />
          </div>
        ) : error ? (
          <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid #ef4444', borderRadius: '4px' }}>
            <p style={{ color: '#ef4444', margin: 0 }}>{error}</p>
            <button onClick={fetchRates} className="btn-secondary" style={{ marginTop: '1rem' }}>Retry</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Amount</label>
              <input 
                type="number" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)}
                placeholder="10,000"
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none', marginBottom: '0.5rem' }}
              />
              <select 
                value={fromCurrency} 
                onChange={(e) => setFromCurrency(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(30,30,40,1)', color: 'white', outline: 'none', cursor: 'pointer' }}
              >
                {currencies.map(c => <option key={`from-${c}`} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ paddingBottom: '0.75rem' }}>
              <button onClick={handleSwap} className="btn-secondary" style={{ padding: '0.75rem', borderRadius: '50%' }}>
                <ArrowRightLeft size={16} />
              </button>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Converted</label>
              <input 
                type="text" 
                value={result === '' ? '' : formatNumberIN(result, { maximumFractionDigits: toCurrency === 'INR' ? 2 : 4, minimumFractionDigits: toCurrency === 'INR' ? 2 : 0 })} 
                readOnly
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.3)', background: 'rgba(59, 130, 246, 0.05)', color: '#60a5fa', outline: 'none', fontWeight: 'bold', marginBottom: '0.5rem' }}
              />
              <select 
                value={toCurrency} 
                onChange={(e) => setToCurrency(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(30,30,40,1)', color: 'white', outline: 'none', cursor: 'pointer' }}
              >
                {currencies.map(c => <option key={`to-${c}`} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default CurrencyConverter;
