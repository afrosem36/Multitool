import { API_BASE_URL, WORKER_SECRET } from '../config';

/**
 * Determines if this is an authentication route that should NOT have Authorization header
 */
function isAuthRoute(endpoint) {
  const authRoutes = ['/api/auth/login', '/api/auth/register', '/api/auth/google', '/api/auth/forgot-password'];
  return authRoutes.some(route => endpoint.startsWith(route));
}

/**
 * Determines if this is a protected route that MUST have Authorization header
 */
function isProtectedRoute(endpoint) {
  const protectedRoutes = ['/api/video-info', '/api/download', '/api/progress'];
  return protectedRoutes.some(route => endpoint.startsWith(route));
}

/**
 * Get Authorization header value for protected routes
 */
function getAuthorizationHeader(endpoint, userToken, headers = {}) {
  // If Authorization already provided, use it (user token takes precedence)
  if (headers.Authorization || headers.authorization) {
    return headers.Authorization || headers.authorization;
  }

  // Auth routes: never add header
  if (isAuthRoute(endpoint)) {
    return null;
  }

  // Protected routes: use WORKER_SECRET
  if (isProtectedRoute(endpoint) && WORKER_SECRET) {
    return `Bearer ${WORKER_SECRET}`;
  }

  // Other routes: use user token if available
  if (userToken) {
    return `Bearer ${userToken}`;
  }

  return null;
}

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
 * Automatically handles Authorization headers correctly:
 * - Auth routes: NO Authorization header
 * - Protected routes: Authorization: Bearer ${WORKER_SECRET}
 * - User routes: Authorization: Bearer ${userToken}
 */
export async function apiFetch(endpoint, options = {}, userToken = null) {
  if (!API_BASE_URL && !endpoint.startsWith('http')) {
    throw new Error('Missing VITE_API_URL environment variable.');
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const isFormData = options.body instanceof FormData;

  const defaultHeaders = isFormData ? {} : {
    'Content-Type': 'application/json',
  };

  // Build final headers
  const headers = {
    ...defaultHeaders,
    ...options.headers,
  };

  // Add Authorization header based on route type
  const authHeader = getAuthorizationHeader(endpoint, userToken, options.headers);
  if (authHeader) {
    headers.Authorization = authHeader;
  } else {
    // Remove Authorization header from auth routes if it was there
    delete headers.Authorization;
    delete headers.authorization;
  }

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
