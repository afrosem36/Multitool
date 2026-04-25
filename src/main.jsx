import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { HelmetProvider } from 'react-helmet-async';

import ErrorBoundary from './components/ErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <FavoritesProvider>
          <ErrorBoundary>
            <App />
            <Analytics />
          </ErrorBoundary>
        </FavoritesProvider>
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
