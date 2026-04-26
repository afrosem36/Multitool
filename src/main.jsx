import React from 'react'
import ReactDOM from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext'
import { FavoritesProvider } from './context/FavoritesContext'
import { AuthProvider } from './context/AuthContext'
import { HelmetProvider } from 'react-helmet-async';

import ErrorBoundary from './components/ErrorBoundary.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <ThemeProvider>
        <FavoritesProvider>
          <AuthProvider>
            <ErrorBoundary>
              <App />
              <Analytics />
            </ErrorBoundary>
          </AuthProvider>
        </FavoritesProvider>
      </ThemeProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
