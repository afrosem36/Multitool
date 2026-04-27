import { useCallback, useState } from 'react';

export const useToolHistory = () => {
  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('toolHistory');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to parse tool history', error);
      return [];
    }
  });

  const addHistory = useCallback((toolPath, toolName, icon) => {
    setHistory((currentHistory) => {
      const newHistory = [
        { path: toolPath, name: toolName, icon, timestamp: Date.now() },
        ...currentHistory.filter((item) => item.path !== toolPath),
      ].slice(0, 5);

      localStorage.setItem('toolHistory', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem('toolHistory');
  }, []);

  return { history, addHistory, clearHistory };
};
