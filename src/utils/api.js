import { API_BASE_URL, WORKER_SECRET } from '../config';

export async function parseJsonResponse(response) {
  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    console.error('Invalid JSON:', text);
    throw new Error('Server error');
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Request failed');
  }

  return data;
}

/**
 * Centralized fetch wrapper with error handling
 */
export async function apiFetch(endpoint, options = {}) {
  if (!API_BASE_URL && !endpoint.startsWith('http')) {
    throw new Error('Missing VITE_API_URL environment variable.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const isFormData = options.body instanceof FormData;

  const defaultHeaders = isFormData ? {} : {
    'Content-Type': 'application/json',
  };

  // Merge headers
  const headers = {
    ...defaultHeaders,
    ...(WORKER_SECRET ? { Authorization: `Bearer ${WORKER_SECRET}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers,
    });

    return await parseJsonResponse(response);
  } catch (error) {
    console.error(`Fetch error at ${url}:`, error);
    throw error;
  }
}
