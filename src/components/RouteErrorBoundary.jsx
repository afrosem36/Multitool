import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

/**
 * RouteErrorBoundary — lightweight error boundary for individual route sections.
 * Catches render errors in a subtree and shows a recovery UI.
 */
class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[RouteErrorBoundary]', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            textAlign: 'center',
            padding: '2rem',
            color: 'var(--text-primary)',
          }}
        >
          <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: 400 }}>
            This page encountered an error. Try refreshing or go back home.
          </p>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn-secondary" onClick={this.handleReset}>
              <RefreshCw size={16} /> Try Again
            </button>
            <button className="btn-primary" onClick={() => (window.location.href = '/')}>
              Go Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default RouteErrorBoundary;
