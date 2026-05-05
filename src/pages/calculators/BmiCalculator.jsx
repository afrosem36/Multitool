import React, { useState, useEffect } from 'react';
import { Activity, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../../hooks/useToolHistory';
import AdPlaceholder from '../../components/shared/AdPlaceholder';
import '../styles/ToolStyles.css';

const BmiCalculator = () => {
  const [weight, setWeight] = useState(70);
  const [weightUnit, setWeightUnit] = useState('kg');
  const [height, setHeight] = useState(170);
  const [heightFt, setHeightFt] = useState(5);
  const [heightIn, setHeightIn] = useState(7);
  const [heightUnit, setHeightUnit] = useState('cm');
  const [result, setResult] = useState(null);
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/bmi', 'BMI Calculator', 'activity');
  }, [addHistory]);

  const calculateBmi = () => {
    const w = parseFloat(weight);
    
    let weightKg = w;
    if (weightUnit === 'lbs') {
      weightKg = w * 0.453592;
    }

    let heightMeters = 0;
    if (heightUnit === 'cm') {
      heightMeters = parseFloat(height) / 100;
    } else if (heightUnit === 'm') {
      heightMeters = parseFloat(height);
    } else if (heightUnit === 'ft') {
      const ft = parseFloat(heightFt) || 0;
      const inches = parseFloat(heightIn) || 0;
      const totalInches = (ft * 12) + inches;
      heightMeters = totalInches * 0.0254;
    }

    if (isNaN(weightKg) || isNaN(heightMeters) || weightKg <= 0 || heightMeters <= 0) {
      setResult(null);
      return;
    }

    const bmiValue = weightKg / (heightMeters * heightMeters);

    let category = '';
    let color = '';
    let suggestion = '';

    if (bmiValue < 18.5) {
      category = 'Underweight';
      color = '#3b82f6';
      suggestion = 'You may need to gain weight. Consider eating more calorie-dense, nutritious foods and consult a healthcare provider.';
    } else if (bmiValue >= 18.5 && bmiValue < 24.9) {
      category = 'Normal weight';
      color = '#10b981';
      suggestion = 'Great job! Maintain your weight with a balanced diet and regular exercise.';
    } else if (bmiValue >= 25 && bmiValue < 29.9) {
      category = 'Overweight';
      color = '#f59e0b';
      suggestion = 'You may want to lose some weight for health reasons. Consider a balanced diet and regular physical activity.';
    } else {
      category = 'Obese';
      color = '#ef4444';
      suggestion = 'Your health may be at risk. It is highly recommended to consult a healthcare provider for a personalized plan.';
    }

    setResult({
      bmi: bmiValue.toFixed(1),
      category,
      color,
      suggestion
    });
  };

  useEffect(() => {
    calculateBmi();
  }, [weight, height, heightFt, heightIn, weightUnit, heightUnit]);

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Calculators
      </Link>
      <div className="tool-header text-center animate-fade-in">
        <Activity size={48} className="text-gradient mx-auto mb-4" />
        <h1>BMI Calculator</h1>
        <p>Calculate your Body Mass Index (BMI) to see if you're at a healthy weight.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ color: 'var(--text-secondary)' }}>Weight</label>
              <select 
                value={weightUnit} 
                onChange={(e) => setWeightUnit(e.target.value)}
                style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <option value="kg" style={{ color: 'black' }}>Kilograms (kg)</option>
                <option value="lbs" style={{ color: 'black' }}>Pounds (lbs)</option>
              </select>
            </div>
            <input 
              type="number" 
              value={weight} 
              onChange={(e) => setWeight(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ color: 'var(--text-secondary)' }}>Height</label>
              <select 
                value={heightUnit} 
                onChange={(e) => setHeightUnit(e.target.value)}
                style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', outline: 'none', cursor: 'pointer', fontWeight: 'bold' }}
              >
                <option value="cm" style={{ color: 'black' }}>Centimeters (cm)</option>
                <option value="m" style={{ color: 'black' }}>Meters (m)</option>
                <option value="ft" style={{ color: 'black' }}>Feet & Inches</option>
              </select>
            </div>

            {heightUnit !== 'ft' ? (
              <input 
                type="number" 
                value={height} 
                onChange={(e) => setHeight(e.target.value)} 
                placeholder={heightUnit === 'cm' ? 'e.g. 170' : 'e.g. 1.70'}
                style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
              />
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ width: '50%', position: 'relative' }}>
                  <input 
                    type="number" 
                    value={heightFt} 
                    onChange={(e) => setHeightFt(e.target.value)} 
                    placeholder="Feet"
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                  />
                  <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>ft</span>
                </div>
                <div style={{ width: '50%', position: 'relative' }}>
                  <input 
                    type="number" 
                    value={heightIn} 
                    onChange={(e) => setHeightIn(e.target.value)} 
                    placeholder="Inches"
                    style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
                  />
                  <span style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}>in</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {result && (
          <div className="glass-panel text-center" style={{ padding: '2rem', border: `1px solid ${result.color}40` }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Your BMI</p>
            <h2 style={{ fontSize: '3rem', margin: '0 0 0.5rem 0', color: result.color }}>{result.bmi}</h2>
            <p style={{ fontSize: '1.2rem', fontWeight: 'bold', color: result.color, margin: '0 0 1rem 0' }}>{result.category}</p>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: 0, padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '8px' }}>
              {result.suggestion}
            </p>
          </div>
        )}
      </div>
      
      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default BmiCalculator;
