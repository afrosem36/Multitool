import React, { useState, useEffect } from 'react';
import { Star, ArrowLeft } from 'lucide-react';
import ToolHeader from '../components/shared/ToolHeader';
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
    Aquarius: { symbol: '♒', element: 'Air', desc: 'Innovative, progressive, and fiercely independent.', passage: 'Aquarians are the visionaries of the zodiac, constantly pushing the boundaries of what is possible. They possess a deep-seated desire to rebel against conventions and forge entirely new paths. Often seen as the eccentric genius, they are incredibly intellectual and driven by a strong sense of social justice. While they can appear emotionally detached or aloof at times, this simply stems from their big-picture mindset; they are deeply invested in the collective good of humanity rather than getting bogged down by interpersonal drama.', pros: 'Original, humanitarian, independent.', cons: 'Temperamental, uncompromising, aloof.', superpower: 'Visionary Thinking', avoid: 'Emotional isolation and stubbornness', focus: 'Community building and innovation' },
    Pisces: { symbol: '♓', element: 'Water', desc: 'Deeply empathetic, artistic, and intuitive.', passage: 'Pisces is the final sign of the zodiac, having absorbed the lessons of all the preceding signs. This grants them unparalleled empathy, intuition, and an almost mystical understanding of human emotion. They are dreamers and artists, often finding solace in music, poetry, and fantasy realms. Because their boundaries are so fluid, they can easily absorb the energies of those around them, making them incredible healers but also highly susceptible to emotional burnout. Learning to ground themselves is their lifelong journey.', pros: 'Compassionate, artistic, intuitive.', cons: 'Fearful, overly trusting, sad.', superpower: 'Emotional Intelligence', avoid: 'Playing the victim and escapism', focus: 'Creative expression and boundaries' },
    Aries: { symbol: '♈', element: 'Fire', desc: 'Bold, ambitious, and dive headfirst into even the most challenging situations.', passage: 'Aries is the pioneer, the trailblazer, and the unstoppable force of the zodiac. Governed by Mars, the planet of action, they possess a fiery, dynamic energy that compels them to take charge and lead. They are fiercely independent and thrive on competition and challenges. While their impulsiveness can sometimes lead them into trouble, their boundless courage and unwavering optimism usually see them through. They do not hold grudges; their anger flashes hot but disappears quickly, making room for their natural enthusiasm.', pros: 'Courageous, determined, confident.', cons: 'Impatient, moody, short-tempered.', superpower: 'Fearless Leadership', avoid: 'Impulsive decisions and aggression', focus: 'Patience and strategic planning' },
    Taurus: { symbol: '♉', element: 'Earth', desc: 'Practical, stoic, and determined to succeed.', passage: 'Taurus embodies stability, sensuality, and an unwavering commitment to comfort and beauty. Ruled by Venus, they have an innate appreciation for the finer things in life—good food, beautiful art, and physical touch. They are incredibly reliable and fiercely loyal to their loved ones. However, their steadfast nature can sometimes manifest as notorious stubbornness. Once a Taurus makes up their mind, it is nearly impossible to change it. They build their lives slowly, ensuring a solid, unshakeable foundation.', pros: 'Reliable, patient, practical.', cons: 'Stubborn, possessive, uncompromising.', superpower: 'Unshakable Resilience', avoid: 'Resistance to change and materialism', focus: 'Flexibility and open-mindedness' },
    Gemini: { symbol: '♊', element: 'Air', desc: 'Playful, intellectually curious, and constantly juggling a variety of passions.', passage: 'Geminis are the brilliant communicators of the zodiac. Represented by the celestial twins, they possess a dual nature that allows them to see multiple perspectives simultaneously. Their minds move at lightning speed, constantly gathering information, exploring new ideas, and chatting with anyone they meet. This insatiable curiosity makes them incredibly adaptable and versatile, but it can also lead to a scattered focus. They need constant mental stimulation to avoid boredom and thrive in dynamic, fast-paced environments.', pros: 'Gentle, affectionate, curious.', cons: 'Nervous, inconsistent, indecisive.', superpower: 'Adaptability & Communication', avoid: 'Superficiality and spreading too thin', focus: 'Focusing energy and deep connections' },
    Cancer: { symbol: '♋', element: 'Water', desc: 'Highly intuitive and their psychic abilities manifest in tangible spaces.', passage: 'Cancer is the protector of the zodiac, deeply connected to their home, family, and emotional roots. Governed by the Moon, their moods can wax and wane, making them incredibly sensitive and highly empathetic. They have a hard outer shell to protect their vulnerable, tender interior, and it can take time to earn their trust. Once you are in their inner circle, they will defend and care for you with unmatched ferocity. They possess an almost psychic intuition when it comes to understanding what others are feeling.', pros: 'Tenacious, highly imaginative, loyal.', cons: 'Moody, pessimistic, suspicious.', superpower: 'Nurturing Intuition', avoid: 'Holding onto the past and mood swings', focus: 'Self-care and trusting others' },
    Leo: { symbol: '♌', element: 'Fire', desc: 'Vivacious, theatrical, and passionate.', passage: 'Leos are the radiant kings and queens of the zodiac. Ruled by the Sun, they naturally gravitate toward the center of attention and possess a magnetic, undeniable charisma. They are incredibly generous, fiercely loyal, and love to shower their friends with affection and grand gestures. Their creativity and passion make them natural leaders and performers. However, their deep need for validation and respect means their egos can be easily bruised. A Leo at their best is a warm, inspiring light that uplifts everyone around them.', pros: 'Creative, passionate, generous.', cons: 'Arrogant, stubborn, self-centered.', superpower: 'Magnetic Charisma', avoid: 'Ego traps and need for constant validation', focus: 'Empowering others and humility' },
    Virgo: { symbol: '♍', element: 'Earth', desc: 'Logical, practical, and systematic in their approach to life.', passage: 'Virgos are the meticulous analysts of the zodiac, driven by a deep desire to be of service to others. They possess an incredibly sharp intellect and an eagle eye for detail, allowing them to spot flaws and inefficiencies that others miss. This makes them brilliant problem-solvers and reliable organizers. However, this critical eye is often turned inward, leading to intense perfectionism and self-doubt. When a Virgo learns to balance their pursuit of excellence with self-compassion, they become an unstoppable force for positive change.', pros: 'Loyal, analytical, kind.', cons: 'Shyness, worry, overly critical of self and others.', superpower: 'Analytical Problem Solving', avoid: 'Perfectionism and overthinking', focus: 'Acceptance and seeing the big picture' },
    Libra: { symbol: '♎', element: 'Air', desc: 'Obsessed with symmetry and strives to create equilibrium in all areas of life.', passage: 'Libras are the ultimate diplomats and lovers of harmony. Ruled by Venus, they have a refined aesthetic sense and a deep appreciation for art, romance, and intellectual conversation. They are incredibly social and thrive in partnerships, often feeling incomplete when alone. Their core drive is justice and fairness, which allows them to see all sides of an argument. Unfortunately, this can lead to crippling indecision as they desperately try to avoid conflict and keep everyone happy at all costs.', pros: 'Cooperative, diplomatic, gracious.', cons: 'Indecisive, avoids confrontations, will carry a grudge.', superpower: 'Harmonizing Relationships', avoid: 'People-pleasing and indecision', focus: 'Assertiveness and inner balance' },
    Scorpio: { symbol: '♏', element: 'Water', desc: 'Elusive and mysterious, deeply emotional and highly intuitive.', passage: 'Scorpio is the most intense and misunderstood sign of the zodiac. They possess incredible emotional depth, fierce determination, and an aura of mystery. They are not interested in superficiality; they want to dive into the hidden truths, the psychology, and the raw realities of life. Because they feel things so intensely, they are fiercely protective of their vulnerability and can be highly secretive. When a Scorpio commits to a person or a goal, they do so with absolute, unbreakable loyalty and transformative willpower.', pros: 'Resourceful, brave, passionate.', cons: 'Distrusting, jealous, secretive.', superpower: 'Transformative Willpower', avoid: 'Obsession and holding grudges', focus: 'Vulnerability and letting go' },
    Sagittarius: { symbol: '♐', element: 'Fire', desc: 'Always on a quest for knowledge and the ultimate truth.', passage: 'Sagittarius is the explorer, philosopher, and eternal student of the zodiac. Ruled by Jupiter, the planet of expansion, they are driven by a boundless optimism and an insatiable thirst for adventure and new experiences. They abhor feeling boxed in or restricted, constantly seeking physical or intellectual freedom. They are known for their blunt honesty, which can sometimes come across as tactless, but their intentions are usually pure. They are the ultimate truth-seekers, always asking the big questions about life and meaning.', pros: 'Generous, idealistic, great sense of humor.', cons: 'Promises more than can deliver, very impatient.', superpower: 'Boundless Optimism', avoid: 'Recklessness and lack of tact', focus: 'Commitment and attention to detail' },
    Capricorn: { symbol: '♑', element: 'Earth', desc: 'Masters of discipline and known for their unyielding perseverance.', passage: 'Capricorn is the ultimate architect of the zodiac, driven by ambition, structure, and an incredible work ethic. They view life as a mountain to be climbed, and they are willing to put in the grueling, unglamorous effort required to reach the top. They are deeply pragmatic and value long-term stability over short-term gratification. While they can sometimes appear cold, overly serious, or consumed by their careers, beneath their stoic exterior lies a fiercely loyal heart and an unexpectedly dry, brilliant sense of humor.', pros: 'Responsible, disciplined, self-control.', cons: 'Know-it-all, unforgiving, condescending.', superpower: 'Masterful Discipline', avoid: 'Workaholism and pessimism', focus: 'Work-life balance and emotional expression' },
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

  const calculateZodiac = async () => {
    if (!birthDate) {
      setResult(null);
      return;
    }

    const date = new Date(birthDate);
    const day = date.getDate();
    const month = date.getMonth() + 1;

    const baseZodiac = getZodiacSign(day, month);
    setResult(baseZodiac);
    setShowDetails(false);
    setApiResult(null);
    setApiError('');
    
    // Fetch Ninja API immediately for the daily horoscope
    if (baseZodiac && baseZodiac.sign) {
      try {
        const ninjaRes = await fetch(`/api/ninja/v1/horoscope?sign=${baseZodiac.sign.toLowerCase()}&day=today`, {
          headers: {
            'X-Api-Key': 'Mir9Mpd9gRsxxy63XjC0uSebQGkvFOXJOMmludav'
          }
        });
        if (ninjaRes.ok) {
          const ninjaData = await ninjaRes.json();
          // Update the local result state with the live daily horoscope
          setResult(prev => ({
            ...prev,
            daily_horoscope: ninjaData.horoscope
          }));
        }
      } catch (e) {
        console.error("Ninja API failed on initial load", e);
      }
    }
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
      
      let dailyHoroscope = null;
      if (result && result.sign) {
        try {
          const ninjaRes = await fetch(`/api/ninja/v1/horoscope?sign=${result.sign.toLowerCase()}&day=today`, {
            headers: {
              'X-Api-Key': 'Mir9Mpd9gRsxxy63XjC0uSebQGkvFOXJOMmludav'
            }
          });
          if (ninjaRes.ok) {
            const ninjaData = await ninjaRes.json();
            dailyHoroscope = ninjaData.horoscope;
          }
        } catch (e) {
          console.error("Ninja API failed", e);
        }
      }

      setApiResult({
        ...data,
        daily_horoscope: dailyHoroscope
      });
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
      <ToolHeader 
        title="Zodiac Sign Calculator"
        description="Find your astrological zodiac sign based on your birth date."
        icon={Star}
        toolId="zodiac-calculator"
      />

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
          <div className="glass-panel text-center" style={{ padding: 'clamp(1rem, 5vw, 2rem)', background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.2)', transition: 'all 0.3s ease' }}>
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
              <div className="animate-fade-in" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: 'clamp(1rem, 5vw, 1.5rem)', borderRadius: '12px' }}>
                {apiError && <p style={{ color: '#ef4444', textAlign: 'center', marginBottom: '1rem' }}>{apiError}</p>}
                
                {apiResult ? (
                  <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', borderLeft: '4px solid #8b5cf6' }}>
                    <h4 style={{ color: '#c4b5fd', margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Star size={16} /> Advanced Astrological Profile
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                      {Object.entries(apiResult).map(([key, value]) => {
                        if (key === 'daily_horoscope') return null; // handle separately
                        if (typeof value !== 'string' && typeof value !== 'number') return null;
                        return (
                          <div key={key}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 0.25rem 0', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</p>
                            <p style={{ margin: 0, fontWeight: 'bold' }}>{value}</p>
                          </div>
                        );
                      })}
                    </div>
                    {apiResult.daily_horoscope && (
                      <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(139, 92, 246, 0.2)' }}>
                        <h4 style={{ color: '#c4b5fd', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Star size={16} /> Today's Horoscope (API Ninja)
                        </h4>
                        <p style={{ margin: 0, lineHeight: '1.6', fontSize: '0.95rem' }}>{apiResult.daily_horoscope}</p>
                      </div>
                    )}
                  </div>
                ) : null}
                <div style={{ margin: '1.5rem 0', padding: '0 1rem' }}>
                  <p style={{ fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.9rem', textAlign: 'center' }}>"{result.desc}"</p>
                  <p style={{ lineHeight: '1.7', fontSize: '1.05rem', textAlign: 'justify', color: 'var(--text-primary)' }}>{result.passage}</p>
                </div>
                
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                  {result.daily_horoscope && (
                    <div className="animate-fade-in" style={{ background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(234, 179, 8, 0.05) 100%)', padding: 'clamp(1rem, 5vw, 1.5rem)', borderRadius: '12px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                      <h4 style={{ color: '#eab308', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Star size={18} /> Today's Horoscope
                      </h4>
                      <p style={{ fontSize: '1.05rem', margin: 0, lineHeight: '1.6' }}>{result.daily_horoscope}</p>
                    </div>
                  )}

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
