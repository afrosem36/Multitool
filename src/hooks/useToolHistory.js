import { useState, useEffect } from 'react';

export const useToolHistory = () => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    const stored = localStorage.getItem('toolHistory');
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse tool history', e);
      }
    }
  }, []);

  const addHistory = (toolPath, toolName, icon) => {
    const newHistory = [
      { path: toolPath, name: toolName, icon, timestamp: Date.now() },
      ...history.filter(h => h.path !== toolPath)
    ].slice(0, 5); // Keep last 5 tools
    
    setHistory(newHistory);
    localStorage.setItem('toolHistory', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('toolHistory');
  };

  return { history, addHistory, clearHistory };
};
