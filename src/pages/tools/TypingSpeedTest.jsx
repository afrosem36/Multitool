import React, { useState, useEffect, useRef } from 'react';
import { Timer, Zap, Target, RefreshCw, Printer, ChevronLeft, Award } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ToolHeader from '../../components/shared/ToolHeader';
import RelatedTools from '../../components/shared/RelatedTools';

const PASSAGES = {
  easy: [
    "The cat sat on the mat. It was a sunny day and everyone was happy. Simple words are easy to type quickly.",
    "Web development is fun and creative. You can build amazing things with code. Just keep practicing every day.",
    "Life is a journey with many beautiful moments. Enjoy the small things and stay positive always."
  ],
  medium: [
    "As technology continues to evolve at a rapid pace, staying updated with the latest trends is essential for success. Programming requires both logic and creativity to solve complex problems efficiently.",
    "Efficient communication is the cornerstone of any successful team. Whether you are working remotely or in an office, clear goals and open dialogue help achieve remarkable results.",
    "The art of writing code is similar to writing poetry; every character matters and contributes to the overall function and beauty of the software being created."
  ],
  hard: [
    "In the philosophical treatise on existentialism, the dichotomy between essence and existence reveals profound truths about human agency. Navigating through such abstract conceptual frameworks requires significant cognitive effort and meticulous linguistic precision.",
    "Quantum entanglement suggests that particles can remain synchronized across vast distances, challenging our classical intuition of local realism. This phenomenon encapsulates the bewildering complexity of subatomic mechanics and cosmological architecture.",
    "The architectural integrity of distributed systems hinges on robust consensus algorithms and resilient network protocols that facilitate seamless data synchronization despite intermittent connectivity and high latency."
  ]
};

export default function TypingSpeedTest() {
  const [difficulty, setDifficulty] = useState('medium');
  const [passage, setPassage] = useState('');
  const [userInput, setUserInput] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [isFinished, setIsFinished] = useState(false);
  const [errors, setErrors] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    resetTest();
  }, [difficulty]);

  useEffect(() => {
    let interval;
    if (startTime && !isFinished) {
      interval = setInterval(() => {
        const now = Date.now();
        const seconds = (now - startTime) / 1000;
        setTimeElapsed(seconds);
        calculateStats(userInput, seconds);
      }, 100);
    }
    return () => clearInterval(interval);
  }, [startTime, isFinished, userInput]);

  const resetTest = () => {
    const list = PASSAGES[difficulty];
    const newPassage = list[Math.floor(Math.random() * list.length)];
    setPassage(newPassage);
    setUserInput('');
    setStartTime(null);
    setTimeElapsed(0);
    setWpm(0);
    setAccuracy(100);
    setIsFinished(false);
    setErrors(0);
    if (inputRef.current) inputRef.current.focus();
  };

  const handleInput = (e) => {
    const val = e.target.value;
    if (!startTime) setStartTime(Date.now());
    
    if (val.length <= passage.length) {
      setUserInput(val);
      calculateStats(val, timeElapsed);
      
      if (val === passage) {
        setIsFinished(true);
      }
    }
  };

  const calculateStats = (input, seconds) => {
    if (seconds <= 0) return;

    // WPM: (characters / 5) / (seconds / 60)
    const wordsTyped = input.length / 5;
    const minutes = seconds / 60;
    setWpm(Math.round(wordsTyped / minutes));

    // Accuracy
    let errorCount = 0;
    for (let i = 0; i < input.length; i++) {
      if (input[i] !== passage[i]) errorCount++;
    }
    setErrors(errorCount);
    const acc = input.length > 0 ? Math.round(((input.length - errorCount) / input.length) * 100) : 100;
    setAccuracy(acc);
  };

  const printCertificate = () => {
    const name = window.prompt("Enter your name for the certificate:") || "Typing Master";
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Typing Certificate</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; padding: 50px; background: #f0f2f5; }
            .cert { border: 20px solid #1e293b; padding: 50px; background: white; max-width: 800px; margin: 0 auto; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); }
            h1 { font-size: 48px; color: #1e293b; margin-bottom: 10px; }
            h2 { font-size: 24px; color: #64748b; margin-bottom: 40px; }
            .name { font-size: 42px; font-weight: bold; color: #3b82f6; border-bottom: 2px solid #3b82f6; display: inline-block; padding: 0 20px; margin-bottom: 30px; }
            .stats { display: flex; justify-content: center; gap: 40px; margin: 30px 0; }
            .stat { font-size: 20px; color: #1e293b; }
            .stat strong { display: block; font-size: 32px; color: #3b82f6; }
            .date { margin-top: 50px; color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="cert">
            <h1>CERTIFICATE</h1>
            <h2>OF TYPING PROFICIENCY</h2>
            <p>This is to certify that</p>
            <div class="name">${name}</div>
            <p>has successfully completed the Typing Speed Test with the following results:</p>
            <div class="stats">
              <div class="stat"><strong>${wpm}</strong>WPM</div>
              <div class="stat"><strong>${accuracy}%</strong>Accuracy</div>
              <div class="stat"><strong>${Math.round(timeElapsed)}s</strong>Time</div>
            </div>
            <p class="date">Awarded on ${new Date().toLocaleDateString()}</p>
            <div style="margin-top: 40px; font-weight: bold; color: #1e293b;">MultiTool Hub Academy</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const renderPassage = () => {
    return passage.split('').map((char, index) => {
      let color = '#94a3b8'; // default grey
      if (index < userInput.length) {
        color = userInput[index] === char ? '#4ade80' : '#f87171'; // green or red
      }
      return <span key={index} style={{ color }}>{char}</span>;
    });
  };

  return (
    <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem' }}>
      <Link to="/utilities" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', textDecoration: 'none' }}>
        <ChevronLeft size={16} /> Back to Utilities
      </Link>

      <ToolHeader 
        title="Typing Speed Test" 
        description="Test your WPM (Words Per Minute) and typing accuracy with our interactive test. Challenge yourself with different difficulty levels and get a printable certificate!"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '2rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '2rem', fontSize: '1.5rem', lineHeight: '1.6', fontFamily: 'monospace', letterSpacing: '0.05em', background: 'rgba(0,0,0,0.4)', minHeight: '200px' }}>
            {renderPassage()}
          </div>

          <textarea
            ref={inputRef}
            value={userInput}
            onChange={handleInput}
            disabled={isFinished}
            placeholder={startTime ? "" : "Start typing the text above to begin the timer..."}
            style={{
              width: '100%',
              padding: '1.5rem',
              borderRadius: '15px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid var(--border-color)',
              color: 'white',
              fontSize: '1.2rem',
              minHeight: '150px',
              outline: 'none',
              resize: 'none',
              transition: 'all 0.3s'
            }}
          />

          {isFinished && (
            <div className="glass-panel animate-fade-in" style={{ padding: '2rem', border: '1px solid var(--success-color)', background: 'rgba(34, 197, 94, 0.05)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <Award size={64} color="var(--success-color)" />
              </div>
              <h2 style={{ marginBottom: '1.5rem' }}>Test Completed!</h2>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '3rem', marginBottom: '2rem' }}>
                <div className="stat">
                  <span style={{ display: 'block', fontSize: '3rem', fontWeight: 'bold', color: 'var(--success-color)' }}>{wpm}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>WPM</span>
                </div>
                <div className="stat">
                  <span style={{ display: 'block', fontSize: '3rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{accuracy}%</span>
                  <span style={{ color: 'var(--text-secondary)' }}>Accuracy</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <button onClick={resetTest} className="btn-secondary" style={{ padding: '0.8rem 2rem' }}>
                  <RefreshCw size={18} /> Try Again
                </button>
                <button onClick={printCertificate} className="btn-primary" style={{ padding: '0.8rem 2rem' }}>
                  <Printer size={18} /> Print Certificate
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h4 style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>DIFFICULTY</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {['easy', 'medium', 'hard'].map(level => (
                <button
                  key={level}
                  onClick={() => setDifficulty(level)}
                  style={{
                    padding: '0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    background: difficulty === level ? 'var(--accent-primary)' : 'rgba(255,255,255,0.05)',
                    color: 'white',
                    textTransform: 'capitalize',
                    cursor: 'pointer',
                    fontWeight: difficulty === level ? '700' : '400'
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                <Timer size={24} color="var(--accent-primary)" />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>TIME</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{Math.round(timeElapsed)}s</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(34, 197, 94, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                <Zap size={24} color="var(--success-color)" />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>WPM</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{wpm}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '8px' }}>
                <Target size={24} color="#f87171" />
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>ACCURACY</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{accuracy}%</span>
              </div>
            </div>
          </div>

          <button onClick={resetTest} className="btn-secondary" style={{ width: '100%', padding: '1rem' }}>
            <RefreshCw size={18} style={{ marginRight: '0.5rem' }} /> Reset Test
          </button>
        </div>
      </div>

      <RelatedTools currentToolId="typing-test" category="utilities" />
    </div>
  );
}
