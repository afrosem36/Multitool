import React, { useState, useEffect } from 'react';
import { Star, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const ZodiacCalculator = () => {
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('12:00');
  const [result, setResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const [apiResult, setApiResult] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [apiError, setApiError] = useState('');
  
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/zodiac', 'Zodiac Calculator', 'star');
  }, [addHistory]);

  const zodiacData = {
    Aquarius: { symbol: '♒', element: 'Air', desc: 'Innovative, progressive, and fiercely independent.', pros: 'Original, humanitarian, independent.', cons: 'Temperamental, uncompromising, aloof.', superpower: 'Visionary Thinking', avoid: 'Emotional isolation and stubbornness', focus: 'Community building and innovation' },
    Pisces: { symbol: '♓', element: 'Water', desc: 'Deeply empathetic, artistic, and intuitive.', pros: 'Compassionate, artistic, intuitive.', cons: 'Fearful, overly trusting, sad.', superpower: 'Emotional Intelligence', avoid: 'Playing the victim and escapism', focus: 'Creative expression and boundaries' },
    Aries: { symbol: '♈', element: 'Fire', desc: 'Bold, ambitious, and dive headfirst into even the most challenging situations.', pros: 'Courageous, determined, confident.', cons: 'Impatient, moody, short-tempered.', superpower: 'Fearless Leadership', avoid: 'Impulsive decisions and aggression', focus: 'Patience and strategic planning' },
    Taurus: { symbol: '♉', element: 'Earth', desc: 'Practical, stoic, and determined to succeed.', pros: 'Reliable, patient, practical.', cons: 'Stubborn, possessive, uncompromising.', superpower: 'Unshakable Resilience', avoid: 'Resistance to change and materialism', focus: 'Flexibility and open-mindedness' },
    Gemini: { symbol: '♊', element: 'Air', desc: 'Playful, intellectually curious, and constantly juggling a variety of passions.', pros: 'Gentle, affectionate, curious.', cons: 'Nervous, inconsistent, indecisive.', superpower: 'Adaptability & Communication', avoid: 'Superficiality and spreading too thin', focus: 'Focusing energy and deep connections' },
    Cancer: { symbol: '♋', element: 'Water', desc: 'Highly intuitive and their psychic abilities manifest in tangible spaces.', pros: 'Tenacious, highly imaginative, loyal.', cons: 'Moody, pessimistic, suspicious.', superpower: 'Nurturing Intuition', avoid: 'Holding onto the past and mood swings', focus: 'Self-care and trusting others' },
    Leo: { symbol: '♌', element: 'Fire', desc: 'Vivacious, theatrical, and passionate.', pros: 'Creative, passionate, generous.', cons: 'Arrogant, stubborn, self-centered.', superpower: 'Magnetic Charisma', avoid: 'Ego traps and need for constant validation', focus: 'Empowering others and humility' },
    Virgo: { symbol: '♍', element: 'Earth', desc: 'Logical, practical, and systematic in their approach to life.', pros: 'Loyal, analytical, kind.', cons: 'Shyness, worry, overly critical of self and others.', superpower: 'Analytical Problem Solving', avoid: 'Perfectionism and overthinking', focus: 'Acceptance and seeing the big picture' },
    Libra: { symbol: '♎', element: 'Air', desc: 'Obsessed with symmetry and strives to create equilibrium in all areas of life.', pros: 'Cooperative, diplomatic, gracious.', cons: 'Indecisive, avoids confrontations, will carry a grudge.', superpower: 'Harmonizing Relationships', avoid: 'People-pleasing and indecision', focus: 'Assertiveness and inner balance' },
    Scorpio: { symbol: '♏', element: 'Water', desc: 'Elusive and mysterious, deeply emotional and highly intuitive.', pros: 'Resourceful, brave, passionate.', cons: 'Distrusting, jealous, secretive.', superpower: 'Transformative Willpower', avoid: 'Obsession and holding grudges', focus: 'Vulnerability and letting go' },
    Sagittarius: { symbol: '♐', element: 'Fire', desc: 'Always on a quest for knowledge and the ultimate truth.', pros: 'Generous, idealistic, great sense of humor.', cons: 'Promises more than can deliver, very impatient.', superpower: 'Boundless Optimism', avoid: 'Recklessness and lack of tact', focus: 'Commitment and attention to detail' },
    Capricorn: { symbol: '♑', element: 'Earth', desc: 'Masters of discipline and known for their unyielding perseverance.', pros: 'Responsible, disciplined, self-control.', cons: 'Know-it-all, unforgiving, condescending.', superpower: 'Masterful Discipline', avoid: 'Workaholism and pessimism', focus: 'Work-life balance and emotional expression' },
  };

  const getZodiacSign = (day, month) => {
    let sign = null;
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) sign = 'Aquarius';
    else if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) sign = 'Pisces';
    else if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) sign = 'Aries';
    else if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) sign = 'Taurus';
    else if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) sign = 'Gemini';
    else if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) sign = 'Cancer';
    else if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) sign = 'Leo';
    else if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) sign = 'Virgo';
    else if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) sign = 'Libra';
    else if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) sign = 'Scorpio';
    else if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) sign = 'Sagittarius';
    else if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) sign = 'Capricorn';
    
    return sign ? { sign, ...zodiacData[sign] } : null;
  };

  const calculateZodiac = () => {
    if (!birthDate) {
      setResult(null);
      return;
    }

    const date = new Date(birthDate);
    const day = date.getDate();
    const month = date.getMonth() + 1;

    setResult(getZodiacSign(day, month));
    setShowDetails(false);
    setApiResult(null);
    setApiError('');
  };

  const fetchAdvancedHoroscope = async () => {
    if (!birthDate) return;
    
    setIsFetching(true);
    setApiError('');
    
    try {
      const date = new Date(birthDate);
      const [hourStr, minStr] = birthTime.split(':');
      
      const payload = {
        day: date.getDate(),
        month: date.getMonth() + 1,
        year: date.getFullYear(),
        hour: parseInt(hourStr || 12),
        min: parseInt(minStr || 0),
        lat: 19.076,
        lon: 72.8777,
        tzone: 5.5,
        house_type: "placidus",
        is_asteroids: "false"
      };

      const response = await fetch('/api/astrology/v1/western_horoscope', {
        method: 'POST',
        headers: {
          'x-astrologyapi-key': 'ak-93c327b060c7a11d0669bfc34e0f02f92b5b6665',
          'Content-Type': 'application/json',
          'Accept-Language': 'en'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to fetch advanced data');
      }

      const data = await response.json();
      setApiResult(data);
      setShowDetails(true); // Automatically expand the details pane
    } catch (err) {
      console.error(err);
      setApiError('Unable to fetch advanced horoscope at this time. Displaying standard details.');
      setShowDetails(true); // Fallback to standard details
    } finally {
      setIsFetching(false);
    }
  };

  useEffect(() => {
    calculateZodiac();
  }, [birthDate]);

  return (
    <div className="tool-container container" style={{ maxWidth: '600px' }}>
      <Link to="/calculators" className="btn-secondary" style={{ display: 'inline-flex', marginBottom: '2rem' }}>
        <ArrowLeft size={16} /> Back to Calculators
      </Link>
      <div className="tool-header text-center animate-fade-in">
        <Star size={48} className="text-gradient mx-auto mb-4" />
        <h1>Zodiac Sign Calculator</h1>
        <p>Find your astrological zodiac sign based on your birth date.</p>
      </div>

      <div className="tool-content glass-panel animate-fade-in">
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Date of Birth</label>
            <input 
              type="date" 
              value={birthDate} 
              onChange={(e) => setBirthDate(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>Time of Birth (Optional)</label>
            <input 
              type="time" 
              value={birthTime} 
              onChange={(e) => setBirthTime(e.target.value)} 
              style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)', color: 'white', outline: 'none' }}
            />
          </div>
        </div>

        {result && (
          <div className="glass-panel text-center" style={{ padding: '2rem', background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.2)', transition: 'all 0.3s ease' }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Your Sign</p>
            <h2 style={{ fontSize: '4rem', margin: '0 0 0.5rem 0', color: 'var(--accent-primary)' }}>{result.symbol}</h2>
            <h3 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0' }}>{result.sign}</h3>
            <p style={{ color: 'var(--text-secondary)', margin: '0 0 1.5rem 0', fontWeight: 'bold' }}>Element: {result.element}</p>
            
            {!showDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                <button 
                  onClick={() => setShowDetails(true)}
                  className="btn-primary"
                  style={{ width: '100%', maxWidth: '300px' }}
                >
                  Show Standard Details
                </button>
                
                <button 
                  onClick={fetchAdvancedHoroscope}
                  className="btn-secondary"
                  style={{ width: '100%', maxWidth: '300px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)', borderColor: 'rgba(139, 92, 246, 0.3)' }}
                  disabled={isFetching}
                >
                  {isFetching ? 'Consulting the Stars...' : '🔮 Get Advanced API Horoscope'}
                </button>
              </div>
            ) : (
              <div className="animate-fade-in" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px' }}>
                {apiError && <p style={{ color: '#ef4444', textAlign: 'center', marginBottom: '1rem' }}>{apiError}</p>}
                
                {apiResult ? (
                  <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
                    <h4 style={{ color: '#c4b5fd', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Star size={16} /> Advanced Astrological Profile
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                      {Object.entries(apiResult).map(([key, value]) => {
                        if (typeof value !== 'string' && typeof value !== 'number') return null;
                        return (
                          <div key={key}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 0.25rem 0', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</p>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>{value}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <p style={{ fontStyle: 'italic', marginBottom: '1.5rem', lineHeight: '1.6', fontSize: '1.1rem', textAlign: 'center' }}>"{result.desc}"</p>
                
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  <div style={{ background: 'rgba(234, 179, 8, 0.1)', padding: '1rem', borderRadius: '8px', borderLeft: '4px solid #eab308' }}>
                    <h4 style={{ color: '#eab308', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Star size={16} /> Superpower
                    </h4>
                    <p style={{ fontSize: '0.95rem', margin: 0 }}>{result.superpower}</p>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
                    <div>
                      <h4 style={{ color: '#10b981', margin: '0 0 0.5rem 0' }}>Strengths</h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>{result.pros}</p>
                    </div>
                    <div>
                      <h4 style={{ color: '#ef4444', margin: '0 0 0.5rem 0' }}>Weaknesses</h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>{result.cons}</p>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1.5rem' }}>
                    <div>
                      <h4 style={{ color: '#3b82f6', margin: '0 0 0.5rem 0' }}>What to Focus On</h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>{result.focus}</p>
                    </div>
                    <div>
                      <h4 style={{ color: '#f97316', margin: '0 0 0.5rem 0' }}>What to Avoid</h4>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>{result.avoid}</p>
                    </div>
                  </div>
                </div>

                <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                  <button 
                    onClick={() => setShowDetails(false)}
                    className="btn-secondary"
                  >
                    Hide Details
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      
      <AdPlaceholder className="mt-5" />
    </div>
  );
};

export default ZodiacCalculator;
