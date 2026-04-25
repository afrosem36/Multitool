import React, { useEffect, useMemo, useState } from 'react';
import { Star, Sparkles, Heart, Briefcase, ShieldCheck } from 'lucide-react';
import ToolHeader from '../components/shared/ToolHeader';
import { useToolHistory } from '../hooks/useToolHistory';
import AdPlaceholder from '../components/shared/AdPlaceholder';
import './ToolStyles.css';

const ZODIAC_SIGNS = [
  {
    sign: 'Capricorn',
    start: [12, 22],
    end: [1, 19],
    element: 'Earth',
    modality: 'Cardinal',
    ruler: 'Saturn',
    dateRange: 'December 22 - January 19',
    headline: 'Grounded, strategic, and quietly relentless.',
    description: 'Capricorn energy is disciplined and future-focused. You usually prefer plans that can survive contact with reality, and you build momentum through consistency rather than noise.',
    strengths: ['Long-term focus', 'Reliable under pressure', 'Strong sense of duty'],
    challenges: ['Can overwork', 'May hide emotions', 'Sometimes too hard on self'],
    compatibility: ['Taurus', 'Virgo', 'Scorpio'],
    luckyColors: ['Charcoal', 'Forest green', 'Slate blue'],
    luckyNumbers: ['4', '8', '22'],
    workStyle: 'You do your best work with ownership, structure, and a clear finish line.',
    loveStyle: 'You open up slowly, but your loyalty runs deep once trust is earned.',
    wellnessTip: 'Rest is productive for you. Build recovery into the plan, not after it.',
    moneyMindset: 'You tend to think in systems, which can make you strong at saving and steady growth.',
  },
  {
    sign: 'Aquarius',
    start: [1, 20],
    end: [2, 18],
    element: 'Air',
    modality: 'Fixed',
    ruler: 'Uranus',
    dateRange: 'January 20 - February 18',
    headline: 'Independent, inventive, and future-minded.',
    description: 'Aquarius energy is original and idea-driven. You often notice patterns early and prefer freedom, experimentation, and purpose over routine.',
    strengths: ['Original thinking', 'Big-picture vision', 'Natural community instinct'],
    challenges: ['Can detach too much', 'Stubborn about ideas', 'Sometimes hard to read'],
    compatibility: ['Gemini', 'Libra', 'Sagittarius'],
    luckyColors: ['Electric blue', 'Silver', 'Violet'],
    luckyNumbers: ['7', '11', '29'],
    workStyle: 'You thrive when you can rethink systems and improve how things work.',
    loveStyle: 'Connection grows for you through honesty, friendship, and room to breathe.',
    wellnessTip: 'Balance mental stimulation with body-based routines that keep you grounded.',
    moneyMindset: 'You are often drawn to unconventional opportunities, so balance innovation with risk control.',
  },
  {
    sign: 'Pisces',
    start: [2, 19],
    end: [3, 20],
    element: 'Water',
    modality: 'Mutable',
    ruler: 'Neptune',
    dateRange: 'February 19 - March 20',
    headline: 'Empathetic, creative, and deeply intuitive.',
    description: 'Pisces energy is sensitive and imaginative. You pick up mood, subtext, and emotional texture quickly, and you often turn that into creativity or care.',
    strengths: ['Compassion', 'Creativity', 'Emotional intelligence'],
    challenges: ['Can absorb stress', 'Avoids conflict', 'Needs stronger boundaries'],
    compatibility: ['Cancer', 'Scorpio', 'Capricorn'],
    luckyColors: ['Sea green', 'Lavender', 'Pearl'],
    luckyNumbers: ['3', '12', '18'],
    workStyle: 'You shine in roles that combine meaning, empathy, and imagination.',
    loveStyle: 'You love with softness and depth, and you need emotional safety to stay open.',
    wellnessTip: 'Protect your energy. Quiet time and boundaries matter more than you think.',
    moneyMindset: 'You do best when spending and saving are both tied to clear values, not mood.',
  },
  {
    sign: 'Aries',
    start: [3, 21],
    end: [4, 19],
    element: 'Fire',
    modality: 'Cardinal',
    ruler: 'Mars',
    dateRange: 'March 21 - April 19',
    headline: 'Direct, bold, and built for movement.',
    description: 'Aries energy is action-first and courageous. You often do best when something new needs to begin, especially when others are still hesitating.',
    strengths: ['Courage', 'Fast initiative', 'Competitive drive'],
    challenges: ['Impulsive choices', 'Short fuse', 'Can lose interest quickly'],
    compatibility: ['Leo', 'Sagittarius', 'Aquarius'],
    luckyColors: ['Red', 'Coral', 'Bright white'],
    luckyNumbers: ['1', '9', '17'],
    workStyle: 'You love momentum, autonomy, and challenges that reward speed and confidence.',
    loveStyle: 'You are passionate and honest, and you value directness over games.',
    wellnessTip: 'Move your body often. Physical release keeps your mind clearer and kinder.',
    moneyMindset: 'You may act quickly with spending, so adding a pause before major decisions helps.',
  },
  {
    sign: 'Taurus',
    start: [4, 20],
    end: [5, 20],
    element: 'Earth',
    modality: 'Fixed',
    ruler: 'Venus',
    dateRange: 'April 20 - May 20',
    headline: 'Steady, loyal, and comfort-building.',
    description: 'Taurus energy is practical and calming. You tend to value stability, quality, and creating a life that feels safe, beautiful, and sustainable.',
    strengths: ['Patience', 'Dependability', 'Strong follow-through'],
    challenges: ['Resists change', 'Can get too comfortable', 'Possessive at times'],
    compatibility: ['Virgo', 'Capricorn', 'Cancer'],
    luckyColors: ['Olive', 'Rose', 'Cream'],
    luckyNumbers: ['2', '6', '24'],
    workStyle: 'You excel in environments where quality, craftsmanship, and consistency matter.',
    loveStyle: 'You show love through steadiness, care, and making life feel secure.',
    wellnessTip: 'Gentle routines work better than extreme resets for your nervous system.',
    moneyMindset: 'You are often naturally good at long-term savings and value-driven spending.',
  },
  {
    sign: 'Gemini',
    start: [5, 21],
    end: [6, 20],
    element: 'Air',
    modality: 'Mutable',
    ruler: 'Mercury',
    dateRange: 'May 21 - June 20',
    headline: 'Curious, social, and mentally quick.',
    description: 'Gemini energy is versatile and expressive. You gather information fast, adapt quickly, and usually feel most alive when learning, talking, or connecting ideas.',
    strengths: ['Communication', 'Adaptability', 'Sharp curiosity'],
    challenges: ['Scattered focus', 'Restlessness', 'Can overthink'],
    compatibility: ['Libra', 'Aquarius', 'Aries'],
    luckyColors: ['Yellow', 'Sky blue', 'Mint'],
    luckyNumbers: ['5', '14', '23'],
    workStyle: 'You do well when the work stays dynamic and gives your mind room to move.',
    loveStyle: 'Conversation is part of intimacy for you. Mental connection matters a lot.',
    wellnessTip: 'Protect your attention. Fewer tabs, more depth.',
    moneyMindset: 'You do well with simple systems that reduce impulsive or distracted spending.',
  },
  {
    sign: 'Cancer',
    start: [6, 21],
    end: [7, 22],
    element: 'Water',
    modality: 'Cardinal',
    ruler: 'Moon',
    dateRange: 'June 21 - July 22',
    headline: 'Protective, intuitive, and emotionally wise.',
    description: 'Cancer energy is deeply responsive and caring. You often read rooms before anyone says a word, and you tend to take responsibility for emotional safety.',
    strengths: ['Intuition', 'Loyalty', 'Protective care'],
    challenges: ['Mood swings', 'Withdrawal when hurt', 'Holding onto the past'],
    compatibility: ['Pisces', 'Scorpio', 'Taurus'],
    luckyColors: ['Silver', 'Soft blue', 'White'],
    luckyNumbers: ['2', '7', '20'],
    workStyle: 'You thrive in environments where trust, purpose, and human impact are visible.',
    loveStyle: 'You love deeply and remember everything, especially what made you feel safe.',
    wellnessTip: 'Emotional rest counts. Build quiet into your week before burnout hits.',
    moneyMindset: 'You are often motivated by security, so clear goals help you stay confident with money.',
  },
  {
    sign: 'Leo',
    start: [7, 23],
    end: [8, 22],
    element: 'Fire',
    modality: 'Fixed',
    ruler: 'Sun',
    dateRange: 'July 23 - August 22',
    headline: 'Warm, magnetic, and creatively brave.',
    description: 'Leo energy is expressive and heart-led. You bring confidence, visibility, and a strong sense of personal style to the people and projects you care about.',
    strengths: ['Leadership presence', 'Generosity', 'Creative courage'],
    challenges: ['Needs validation', 'Pride can get in the way', 'Can dominate space'],
    compatibility: ['Aries', 'Sagittarius', 'Libra'],
    luckyColors: ['Gold', 'Orange', 'Crimson'],
    luckyNumbers: ['1', '10', '19'],
    workStyle: 'You do best where effort is visible and creative initiative is rewarded.',
    loveStyle: 'You are affectionate, loyal, and happiest when love feels wholehearted and mutual.',
    wellnessTip: 'Let your joy be maintenance, not a reward you save for later.',
    moneyMindset: 'You enjoy quality and presence, so intentional budgeting keeps pleasure from turning into drift.',
  },
  {
    sign: 'Virgo',
    start: [8, 23],
    end: [9, 22],
    element: 'Earth',
    modality: 'Mutable',
    ruler: 'Mercury',
    dateRange: 'August 23 - September 22',
    headline: 'Precise, thoughtful, and quietly excellent.',
    description: 'Virgo energy is analytical and service-oriented. You notice what needs fixing, what can be improved, and how details connect to the bigger system.',
    strengths: ['Problem solving', 'Reliability', 'Practical intelligence'],
    challenges: ['Perfectionism', 'Self-criticism', 'Can over-manage'],
    compatibility: ['Taurus', 'Capricorn', 'Cancer'],
    luckyColors: ['Moss', 'Navy', 'Sand'],
    luckyNumbers: ['5', '15', '27'],
    workStyle: 'You are excellent where precision, structure, and thoughtful improvement matter.',
    loveStyle: 'You tend to show care through effort, attention, and acts that make life easier.',
    wellnessTip: 'Aim for progress you can maintain, not perfection you cannot survive.',
    moneyMindset: 'You are often strong with planning, tracking, and making practical trade-offs.',
  },
  {
    sign: 'Libra',
    start: [9, 23],
    end: [10, 22],
    element: 'Air',
    modality: 'Cardinal',
    ruler: 'Venus',
    dateRange: 'September 23 - October 22',
    headline: 'Balanced, relational, and naturally diplomatic.',
    description: 'Libra energy seeks harmony, fairness, and beauty. You usually see multiple sides clearly and prefer solutions that feel balanced, not just efficient.',
    strengths: ['Diplomacy', 'Charm', 'Sense of fairness'],
    challenges: ['Indecision', 'People-pleasing', 'Avoiding conflict'],
    compatibility: ['Gemini', 'Aquarius', 'Leo'],
    luckyColors: ['Blush', 'Blue', 'Soft grey'],
    luckyNumbers: ['6', '15', '24'],
    workStyle: 'You do your best work in collaborative settings where relationships and presentation matter.',
    loveStyle: 'Partnership is central for you, and emotional reciprocity means a lot.',
    wellnessTip: 'Choose rest and boundaries before resentment makes the choice for you.',
    moneyMindset: 'Beauty matters to you, so spending aligns best when it reflects real values, not pressure.',
  },
  {
    sign: 'Scorpio',
    start: [10, 23],
    end: [11, 21],
    element: 'Water',
    modality: 'Fixed',
    ruler: 'Pluto',
    dateRange: 'October 23 - November 21',
    headline: 'Intense, perceptive, and transformative.',
    description: 'Scorpio energy is deep and focused. You tend to care about what is real, not what looks polished, and you usually move with commitment once trust is established.',
    strengths: ['Emotional depth', 'Willpower', 'Strong instincts'],
    challenges: ['Guardedness', 'Jealousy', 'Holding grudges'],
    compatibility: ['Cancer', 'Pisces', 'Capricorn'],
    luckyColors: ['Burgundy', 'Black', 'Deep teal'],
    luckyNumbers: ['9', '13', '21'],
    workStyle: 'You do well in high-trust, high-focus work that rewards depth instead of surface performance.',
    loveStyle: 'You love seriously and need honesty, loyalty, and emotional depth.',
    wellnessTip: 'Letting go is not weakness. It is what creates room for the next version of you.',
    moneyMindset: 'You tend to think in control and resilience, which can make you sharp about risk and reserves.',
  },
  {
    sign: 'Sagittarius',
    start: [11, 22],
    end: [12, 21],
    element: 'Fire',
    modality: 'Mutable',
    ruler: 'Jupiter',
    dateRange: 'November 22 - December 21',
    headline: 'Expansive, optimistic, and freedom-seeking.',
    description: 'Sagittarius energy is adventurous and meaning-driven. You usually want growth, movement, and ideas big enough to keep life interesting.',
    strengths: ['Optimism', 'Honesty', 'Curiosity for growth'],
    challenges: ['Restlessness', 'Blunt delivery', 'Can overpromise'],
    compatibility: ['Aries', 'Leo', 'Aquarius'],
    luckyColors: ['Purple', 'Cobalt', 'Saffron'],
    luckyNumbers: ['3', '9', '30'],
    workStyle: 'You thrive where there is room to explore, teach, build, or expand.',
    loveStyle: 'You need both warmth and freedom, not one at the expense of the other.',
    wellnessTip: 'Keep one grounding ritual in place even when life gets wide and busy.',
    moneyMindset: 'You often think in possibilities, so structure helps turn enthusiasm into results.',
  },
];

const TIME_TONES = [
  'A calm, reflective tone suits you today.',
  'Momentum is available when you keep decisions simple.',
  'This is a good day for direct conversations and clean follow-through.',
  'A creative reset will likely do more for you than forcing output.',
  'Steady effort will outperform sudden bursts today.',
];

function findSign(month, day) {
  return ZODIAC_SIGNS.find((item) => (
    (month === item.start[0] && day >= item.start[1]) ||
    (month === item.end[0] && day <= item.end[1])
  ));
}

function buildDailyGuidance(sign, birthTime) {
  const today = new Date();
  const weekday = today.toLocaleDateString('en-US', { weekday: 'long' });
  const hour = birthTime ? Number(birthTime.split(':')[0]) : 12;
  const tone = TIME_TONES[(today.getDay() + hour) % TIME_TONES.length];

  return {
    focus: `${weekday} favors ${sign.element.toLowerCase()}-sign strengths: ${sign.strengths[0].toLowerCase()} and ${sign.strengths[1].toLowerCase()}.`,
    work: hour < 12
      ? 'Start the day with the one task that creates clarity for everything else.'
      : 'Protect your energy by finishing the highest-leverage item before adding new plans.',
    relationships: sign.loveStyle,
    tone,
  };
}

const InfoCard = ({ icon: Icon, title, children, color = '#60a5fa' }) => (
  <div
    className="glass-panel"
    style={{
      padding: '1rem',
      border: `1px solid ${color}22`,
      background: 'rgba(255,255,255,0.03)',
      height: '100%',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.75rem' }}>
      <Icon size={18} color={color} />
      <strong>{title}</strong>
    </div>
    <div style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{children}</div>
  </div>
);

const PillList = ({ items, color }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
    {items.map((item) => (
      <span
        key={item}
        style={{
          padding: '0.55rem 0.85rem',
          borderRadius: '999px',
          border: `1px solid ${color}33`,
          background: `${color}14`,
          color: 'var(--text-primary)',
          fontSize: '0.92rem',
        }}
      >
        {item}
      </span>
    ))}
  </div>
);

export default function ZodiacCalculator() {
  const [birthDate, setBirthDate] = useState('');
  const [birthTime, setBirthTime] = useState('12:00');
  const { addHistory } = useToolHistory();

  useEffect(() => {
    addHistory('/calculator/zodiac', 'Zodiac Calculator', 'star');
  }, [addHistory]);

  const result = useMemo(() => {
    if (!birthDate) return null;
    const date = new Date(birthDate);
    const sign = findSign(date.getMonth() + 1, date.getDate());
    if (!sign) return null;

    return {
      ...sign,
      guidance: buildDailyGuidance(sign, birthTime),
      birthSummary: date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    };
  }, [birthDate, birthTime]);

  return (
    <div className="tool-container container" style={{ maxWidth: '1040px' }}>
      <ToolHeader
        title="Zodiac Signs"
        description="Discover your sign, personality themes, compatibility, and practical daily guidance without sending your birth details to any third-party API."
        icon={Star}
        toolId="zodiac-calculator"
      />

      <div className="tool-content glass-panel animate-fade-in" style={{ display: 'grid', gap: '1.5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.55rem', color: 'var(--text-secondary)' }}>Date of Birth</label>
            <input
              type="date"
              value={birthDate}
              onChange={(event) => setBirthDate(event.target.value)}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                outline: 'none',
              }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.55rem', color: 'var(--text-secondary)' }}>Birth Time (Optional)</label>
            <input
              type="time"
              value={birthTime}
              onChange={(event) => setBirthTime(event.target.value)}
              style={{
                width: '100%',
                padding: '0.85rem 1rem',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(0,0,0,0.2)',
                color: 'white',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {!result && (
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              background: 'rgba(59, 130, 246, 0.06)',
              border: '1px solid rgba(59, 130, 246, 0.18)',
              color: 'var(--text-secondary)',
              lineHeight: 1.7,
            }}
          >
            Enter your birth date to generate your zodiac profile, element, compatibility, and a locally generated day-of guidance.
          </div>
        )}

        {result && (
          <>
            <div
              className="glass-panel"
              style={{
                padding: '1.5rem',
                border: '1px solid rgba(234, 179, 8, 0.22)',
                background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Born on {result.birthSummary}</p>
                  <h2 style={{ margin: '0.4rem 0 0.3rem', fontSize: '2.4rem' }}>{result.sign}</h2>
                  <p style={{ margin: 0, color: '#fde68a', fontWeight: 600 }}>{result.headline}</p>
                </div>
                <div style={{ display: 'grid', gap: '0.45rem', minWidth: '220px' }}>
                  <div><strong>Element:</strong> {result.element}</div>
                  <div><strong>Modality:</strong> {result.modality}</div>
                  <div><strong>Ruling Planet:</strong> {result.ruler}</div>
                  <div><strong>Date Range:</strong> {result.dateRange}</div>
                </div>
              </div>
              <p style={{ margin: '1rem 0 0', color: 'var(--text-secondary)', lineHeight: 1.8 }}>{result.description}</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <InfoCard icon={Sparkles} title="Daily Focus" color="#f59e0b">
                <p style={{ margin: 0 }}>{result.guidance.focus}</p>
                <p style={{ margin: '0.75rem 0 0' }}>{result.guidance.tone}</p>
              </InfoCard>
              <InfoCard icon={Briefcase} title="Work Mode" color="#60a5fa">
                {result.workStyle}
                <div style={{ marginTop: '0.65rem' }}>{result.guidance.work}</div>
              </InfoCard>
              <InfoCard icon={Heart} title="Relationships" color="#fb7185">
                {result.guidance.relationships}
              </InfoCard>
              <InfoCard icon={ShieldCheck} title="Wellness and Money" color="#34d399">
                <div>{result.wellnessTip}</div>
                <div style={{ marginTop: '0.65rem' }}>{result.moneyMindset}</div>
              </InfoCard>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Strengths</h3>
                <PillList items={result.strengths} color="#22c55e" />
              </div>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Growth Edges</h3>
                <PillList items={result.challenges} color="#f97316" />
              </div>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Compatibility</h3>
                <PillList items={result.compatibility} color="#a78bfa" />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Lucky Colors</h3>
                <PillList items={result.luckyColors} color="#38bdf8" />
              </div>
              <div className="glass-panel" style={{ padding: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Lucky Numbers</h3>
                <PillList items={result.luckyNumbers} color="#facc15" />
              </div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: '1rem 1.2rem',
                background: 'rgba(16, 185, 129, 0.07)',
                border: '1px solid rgba(16, 185, 129, 0.18)',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
              }}
            >
              This zodiac reading is generated locally in your browser. Your birth details stay on your device, and the daily guidance is derived from your sign and the current day rather than external horoscope APIs.
            </div>
          </>
        )}
      </div>

      <AdPlaceholder className="mt-5" />
    </div>
  );
}
