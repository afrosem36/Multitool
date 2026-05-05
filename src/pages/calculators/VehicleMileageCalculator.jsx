import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../../hooks/useToolHistory';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import '../styles/ToolStyles.css';
import '../styles/VehicleMileageCalculator.css';

const fmt = (n, decimals = 2) => {
  if (!isFinite(n) || isNaN(n) || n < 0) return '—';
  return n.toLocaleString('en-IN', { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
};

const MODES = [
  { id: 'car',  emoji: '🚗', title: 'Car Fuel Cost',      desc: 'Estimate trip expenses for any distance' },
  { id: 'bike', emoji: '🏍️', title: 'Bike Cost',          desc: 'Daily, monthly & yearly ride expenses'   },
  { id: 'pvd',  emoji: '⚖️', title: 'Petrol vs Diesel',   desc: 'Compare fuel types to save money'        },
  { id: 'ev',   emoji: '⚡', title: 'EV vs Petrol',        desc: 'See long-term EV savings clearly'        },
];

// ─── Shared UI ───────────────────────────────────────────────────────────────

const InputField = ({ label, value, onChange, unit, placeholder = '0', className = '' }) => (
  <div className={`vmc-input-group ${className}`}>
    <span className="vmc-label">{label}</span>
    <div className="vmc-input-row">
      <input
        type="number"
        className="vmc-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        min="0"
      />
      {unit && <span className="vmc-input-unit">{unit}</span>}
    </div>
  </div>
);

const ToggleGroup = ({ label, options, value, onChange }) => (
  <div className="vmc-input-group">
    {label && <span className="vmc-label">{label}</span>}
    <div className="vmc-toggle-group">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          className={`vmc-toggle ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

const ResultRow = ({ label, value, color = '', note }) => (
  <div className="vmc-result-card">
    <div>
      <div className="vmc-result-label">{label}</div>
      {note && <div className="vmc-result-note">{note}</div>}
    </div>
    <div className={`vmc-result-value ${color}`}>{value}</div>
  </div>
);

// ─── Mode 1 — Car Fuel Cost ───────────────────────────────────────────────────

const CarMode = () => {
  const [distance,  setDistance]  = useState('100');
  const [mileage,   setMileage]   = useState('15');
  const [fuelPrice, setFuelPrice] = useState('100');
  const [fuelType,  setFuelType]  = useState('petrol');

  const r = useMemo(() => {
    const d = parseFloat(distance);
    const m = parseFloat(mileage);
    const p = parseFloat(fuelPrice);
    if (!d || !m || !p || m <= 0) return null;
    const fuelNeeded = d / m;
    const totalCost  = fuelNeeded * p;
    const costPerKm  = p / m;
    return { fuelNeeded, totalCost, costPerKm };
  }, [distance, mileage, fuelPrice]);

  return (
    <div>
      <p className="vmc-helper">Enter your trip details to estimate total fuel expenses.</p>
      <div className="vmc-inputs-grid">
        <InputField label="Distance"   value={distance}  onChange={setDistance}  unit="km"   placeholder="100" />
        <InputField label="Mileage"    value={mileage}   onChange={setMileage}   unit="km/L" placeholder="15"  />
        <InputField label="Fuel Price" value={fuelPrice} onChange={setFuelPrice} unit="₹/L"  placeholder="100" />
      </div>
      <ToggleGroup
        label="Fuel Type"
        options={[
          { label: 'Petrol', value: 'petrol' },
          { label: 'Diesel', value: 'diesel' },
          { label: 'CNG',    value: 'cng'    },
        ]}
        value={fuelType}
        onChange={setFuelType}
      />

      {r && (
        <div className="vmc-results" key={r.totalCost.toFixed(0)}>
          <div className="vmc-section-label">Results</div>
          <ResultRow label="Fuel Needed"   value={`${fmt(r.fuelNeeded)} L`} />
          <ResultRow label="Total Cost"    value={`₹${fmt(r.totalCost, 0)}`}    color="accent" />
          <ResultRow label="Cost per km"   value={`₹${fmt(r.costPerKm)}`}       color="green"  />
        </div>
      )}
    </div>
  );
};

// ─── Mode 2 — Bike Cost ──────────────────────────────────────────────────────

const BikeMode = () => {
  const [dailyDist,   setDailyDist]   = useState('30');
  const [mileage,     setMileage]     = useState('45');
  const [petrolPrice, setPetrolPrice] = useState('100');

  const r = useMemo(() => {
    const d = parseFloat(dailyDist);
    const m = parseFloat(mileage);
    const p = parseFloat(petrolPrice);
    if (!d || !m || !p || m <= 0) return null;
    const daily   = (d / m) * p;
    return { daily, monthly: daily * 30, yearly: daily * 365 };
  }, [dailyDist, mileage, petrolPrice]);

  return (
    <div>
      <p className="vmc-helper">Enter your daily travel to estimate your total ride cost.</p>
      <div className="vmc-inputs-grid">
        <InputField label="Daily Distance" value={dailyDist}   onChange={setDailyDist}   unit="km"   placeholder="30"  />
        <InputField label="Mileage"        value={mileage}     onChange={setMileage}     unit="km/L" placeholder="45"  />
        <InputField label="Petrol Price"   value={petrolPrice} onChange={setPetrolPrice} unit="₹/L"  placeholder="100" className="vmc-full" />
      </div>

      {r && (
        <div className="vmc-results" key={r.monthly.toFixed(0)}>
          <div className="vmc-section-label">Cost Breakdown</div>
          <ResultRow label="Daily Cost"   value={`₹${fmt(r.daily)}`}           />
          <ResultRow label="Monthly Cost" value={`₹${fmt(r.monthly, 0)}`}  color="accent" />
          <ResultRow label="Yearly Cost"  value={`₹${fmt(r.yearly,  0)}`}  color="green"  note="Based on 365 days" />
        </div>
      )}
    </div>
  );
};

// ─── Mode 3 — Petrol vs Diesel ───────────────────────────────────────────────

const PvdMode = () => {
  const [dailyDist,     setDailyDist]     = useState('50');
  const [petrolMileage, setPetrolMileage] = useState('12');
  const [dieselMileage, setDieselMileage] = useState('18');
  const [petrolPrice,   setPetrolPrice]   = useState('100');
  const [dieselPrice,   setDieselPrice]   = useState('90');

  const r = useMemo(() => {
    const d  = parseFloat(dailyDist);
    const pm = parseFloat(petrolMileage);
    const dm = parseFloat(dieselMileage);
    const pp = parseFloat(petrolPrice);
    const dp = parseFloat(dieselPrice);
    if (!d || !pm || !dm || !pp || !dp) return null;
    const petrolMo = (d / pm) * pp * 30;
    const dieselMo = (d / dm) * dp * 30;
    const winner   = petrolMo <= dieselMo ? 'petrol' : 'diesel';
    return { petrolMo, dieselMo, winner, saving: Math.abs(petrolMo - dieselMo) };
  }, [dailyDist, petrolMileage, dieselMileage, petrolPrice, dieselPrice]);

  return (
    <div>
      <p className="vmc-helper">Compare fuel types to find out which one saves more money every month.</p>
      <div className="vmc-inputs-grid">
        <InputField label="Daily Distance"  value={dailyDist}     onChange={setDailyDist}     unit="km"   placeholder="50"  className="vmc-full" />
        <InputField label="Petrol Mileage"  value={petrolMileage} onChange={setPetrolMileage} unit="km/L" placeholder="12"  />
        <InputField label="Diesel Mileage"  value={dieselMileage} onChange={setDieselMileage} unit="km/L" placeholder="18"  />
        <InputField label="Petrol Price"    value={petrolPrice}   onChange={setPetrolPrice}   unit="₹/L"  placeholder="100" />
        <InputField label="Diesel Price"    value={dieselPrice}   onChange={setDieselPrice}   unit="₹/L"  placeholder="90"  />
      </div>

      {r && (
        <div className="vmc-results" key={r.saving.toFixed(0)}>
          <div className="vmc-section-label">Monthly Comparison</div>
          <div className="vmc-compare-grid">
            <div className={`vmc-compare-card ${r.winner === 'petrol' ? 'winner' : 'loser'}`}>
              <div className="vmc-compare-label">🛢 Petrol</div>
              <div className="vmc-compare-value" style={{ color: r.winner === 'petrol' ? '#10b981' : '#ef4444' }}>
                ₹{fmt(r.petrolMo, 0)}
              </div>
              <div className="vmc-compare-sub">per month</div>
              {r.winner === 'petrol' && <div className="vmc-cheaper-tag">✓ Cheaper</div>}
            </div>
            <div className={`vmc-compare-card ${r.winner === 'diesel' ? 'winner' : 'loser'}`}>
              <div className="vmc-compare-label">⚙️ Diesel</div>
              <div className="vmc-compare-value" style={{ color: r.winner === 'diesel' ? '#10b981' : '#ef4444' }}>
                ₹{fmt(r.dieselMo, 0)}
              </div>
              <div className="vmc-compare-sub">per month</div>
              {r.winner === 'diesel' && <div className="vmc-cheaper-tag">✓ Cheaper</div>}
            </div>
          </div>
          <div className="vmc-winner-banner">
            <span>💰</span>
            <span>
              <strong>{r.winner === 'petrol' ? 'Petrol' : 'Diesel'}</strong> saves you{' '}
              <strong>₹{fmt(r.saving, 0)}/month</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Mode 4 — EV vs Petrol ───────────────────────────────────────────────────

const EvMode = () => {
  const [dailyDist,   setDailyDist]   = useState('50');
  const [petrolMil,   setPetrolMil]   = useState('12');
  const [petrolPrice, setPetrolPrice] = useState('100');
  const [evEff,       setEvEff]       = useState('6');
  const [elecPrice,   setElecPrice]   = useState('8');

  const r = useMemo(() => {
    const d  = parseFloat(dailyDist);
    const pm = parseFloat(petrolMil);
    const pp = parseFloat(petrolPrice);
    const ee = parseFloat(evEff);
    const ep = parseFloat(elecPrice);
    if (!d || !pm || !pp || !ee || !ep) return null;
    const petrolMo = (d / pm) * pp * 30;
    const evMo     = (d / ee) * ep * 30;
    const saving   = petrolMo - evMo;
    return { petrolMo, evMo, saving, yearlySaving: saving * 12 };
  }, [dailyDist, petrolMil, petrolPrice, evEff, elecPrice]);

  return (
    <div>
      <p className="vmc-helper">EV gives long-term savings — see exactly how much you'd save by switching.</p>
      <div className="vmc-inputs-grid">
        <InputField label="Daily Distance"     value={dailyDist}   onChange={setDailyDist}   unit="km"     placeholder="50"  />
        <InputField label="Petrol Mileage"     value={petrolMil}   onChange={setPetrolMil}   unit="km/L"   placeholder="12"  />
        <InputField label="Petrol Price"       value={petrolPrice} onChange={setPetrolPrice} unit="₹/L"    placeholder="100" />
        <InputField label="EV Efficiency"      value={evEff}       onChange={setEvEff}       unit="km/kWh" placeholder="6"   note="Avg EV: 5–8 km/kWh" />
        <InputField label="Electricity Price"  value={elecPrice}   onChange={setElecPrice}   unit="₹/kWh"  placeholder="8"   className="vmc-full" />
      </div>

      {r && (
        <div className="vmc-results" key={r.saving.toFixed(0)}>
          <div className="vmc-section-label">Monthly Cost Comparison</div>
          <div className="vmc-compare-grid">
            <div className="vmc-compare-card loser">
              <div className="vmc-compare-label">⛽ Petrol Car</div>
              <div className="vmc-compare-value" style={{ color: '#ef4444' }}>
                ₹{fmt(r.petrolMo, 0)}
              </div>
              <div className="vmc-compare-sub">per month</div>
            </div>
            <div className="vmc-compare-card winner">
              <div className="vmc-compare-label">⚡ Electric</div>
              <div className="vmc-compare-value" style={{ color: '#10b981' }}>
                ₹{fmt(r.evMo, 0)}
              </div>
              <div className="vmc-compare-sub">per month</div>
              <div className="vmc-cheaper-tag">✓ Cheaper</div>
            </div>
          </div>

          {r.saving > 0 ? (
            <div className="vmc-winner-banner">
              <span>🌱</span>
              <div>
                <div>EV saves you <strong>₹{fmt(r.saving, 0)}/month</strong></div>
                <div className="vmc-winner-sub">That's ₹{fmt(r.yearlySaving, 0)} saved every year!</div>
              </div>
            </div>
          ) : (
            <div className="vmc-winner-banner vmc-banner-warn">
              <span>⚠️</span>
              <span>With current electricity rates, petrol is slightly cheaper here</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const VehicleMileageCalculator = () => {
  const [mode,     setMode]     = useState(null);
  const [panelKey, setPanelKey] = useState(0);
  const panelRef = useRef(null);
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/vehicle-mileage', 'Vehicle & Mileage Calculator', 'car');
  }, [addHistory]);

  const handleModeSelect = (id) => {
    setMode(id);
    setPanelKey(k => k + 1);
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 60);
  };

  const activeMode = MODES.find(m => m.id === mode);

  return (
    <div className="tool-container container vmc-container">
      <Link
        to="/calculators"
        className="btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.75rem' }}
      >
        <ArrowLeft size={16} /> Back to Calculators
      </Link>

      {/* Hero */}
      <div className="vmc-hero text-center animate-fade-in">
        <div className="vmc-hero-icon">🚗</div>
        <h1 className="vmc-hero-title">Vehicle &amp; Mileage Calculator</h1>
        <p className="vmc-hero-sub">Compare fuel costs, track expenses, and find the most economical ride.</p>
      </div>

      {/* Mode Cards */}
      <div className="vmc-cards animate-fade-in">
        {MODES.map(m => (
          <button
            key={m.id}
            type="button"
            className={`vmc-card ${mode === m.id ? 'active' : ''}`}
            onClick={() => handleModeSelect(m.id)}
          >
            <span className="vmc-card-emoji">{m.emoji}</span>
            <span className="vmc-card-title">{m.title}</span>
            <span className="vmc-card-desc">{m.desc}</span>
            {mode === m.id && <span className="vmc-card-active-dot" />}
          </button>
        ))}
      </div>

      {/* Prompt when nothing selected */}
      {!mode && (
        <p className="vmc-select-prompt animate-fade-in">
          ☝️ Select a calculator above to get started
        </p>
      )}

      {/* Calculator Panel */}
      {mode && (
        <div ref={panelRef} key={panelKey} className="vmc-panel glass-panel animate-fade-in">
          <div className="vmc-panel-header">
            <span className="vmc-panel-emoji">{activeMode?.emoji}</span>
            <div>
              <div className="vmc-panel-title">{activeMode?.title}</div>
              <div className="vmc-panel-desc">{activeMode?.desc}</div>
            </div>
          </div>
          <div className="vmc-panel-body">
            {mode === 'car'  && <CarMode  />}
            {mode === 'bike' && <BikeMode />}
            {mode === 'pvd'  && <PvdMode  />}
            {mode === 'ev'   && <EvMode   />}
          </div>
        </div>
      )}

      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default VehicleMileageCalculator;
