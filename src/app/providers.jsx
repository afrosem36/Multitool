import React from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from '../context/ThemeContext';
import { FavoritesProvider } from '../context/FavoritesContext';
import { AuthProvider } from '../context/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * AppProviders wraps the entire application with all required context providers
 * in the correct nesting order.
 */
export default function AppProviders({ children }) {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <FavoritesProvider>
          <AuthProvider>
            <ErrorBoundary>
              {children}
            </ErrorBoundary>
          </AuthProvider>
        </FavoritesProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}
