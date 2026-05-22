import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './app/App.jsx';
import AppProviders from './app/providers.jsx';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProviders>
      <App />
      <Analytics />
    </AppProviders>
  </React.StrictMode>,
);
