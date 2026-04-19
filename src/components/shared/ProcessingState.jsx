import React from 'react';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import './SharedStyles.css';

const ProcessingState = ({ status, message, error }) => {
  if (status === 'idle') return null;

  return (
    <div className={`processing-state glass-panel ${status}`}>
      {status === 'processing' && (
        <>
          <Loader2 size={32} className="spin text-gradient" />
          <p>{message || 'Processing your files...'}</p>
        </>
      )}
      
      {status === 'success' && (
        <>
          <CheckCircle size={32} className="text-success" />
          <p>{message || 'Completed successfully!'}</p>
        </>
      )}

      {status === 'error' && (
        <>
          <AlertCircle size={32} className="text-danger" />
          <p className="error-message">{error || message || 'An error occurred.'}</p>
        </>
      )}
    </div>
  );
};

export default ProcessingState;
