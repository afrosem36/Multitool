import { API_BASE_URL } from '../config';

/**
 * Centralized fetch wrapper with error handling
 */
export async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
  };

  // Merge headers
  const headers = {
    ...defaultHeaders,
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`Fetch error at ${url}:`, error);
    throw error;
  }
}
