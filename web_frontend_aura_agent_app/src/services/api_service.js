import { getAuthToken } from './auth_service.js';

const runtimeApiBaseUrl = window.__AURA_CONFIG__?.apiBaseUrl;
const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

function getFallbackApiBaseUrl() {
  const { protocol, hostname, port } = window.location;

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:8000/api/v1`;
  }

  if (hostname === '10.0.2.2') {
    return `${protocol}//10.0.2.2:8000/api/v1`;
  }

  if (port === '8000') {
    return `${window.location.origin}/api/v1`;
  }

  return `${window.location.origin}/api/v1`;
}

const API_BASE_URL = (runtimeApiBaseUrl || envApiBaseUrl || getFallbackApiBaseUrl()).replace(/\/$/, '');

async function buildHeaders(headers = {}) {
  const token = await getAuthToken();
  return {
    ...headers,
    Authorization: `Bearer ${token}`
  };
}

async function request(path, options = {}) {
  let response;
  const headers = await buildHeaders(options.headers);

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers
    });
  } catch {
    throw new Error(`Cannot reach backend at ${API_BASE_URL}. Check runtime-config.js or VITE_API_BASE_URL.`);
  }

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const rawDetail = payload?.detail;
    const message = typeof rawDetail === 'string'
      ? rawDetail
      : Array.isArray(rawDetail)
        ? rawDetail.map(e => e.msg || JSON.stringify(e)).join(', ')
        : payload?.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

/**
 * Converts a backend evidence_url (which may be a relative proxy path like
 * /api/v1/upload/{id}/view) into a blob URL the browser can use as <img src>.
 *
 * Why: img tags can't send Authorization headers. The backend /view endpoint
 * requires auth. So we fetch the bytes ourselves with the token, then hand
 * the browser a local blob:// URL.
 *
 * @param {string} evidenceUrl - Relative or absolute URL from the backend
 * @returns {Promise<string|null>} A blob:// URL, or null on failure
 */
export async function resolveEvidenceUrl(evidenceUrl) {
  if (!evidenceUrl) return null;

  // Already a blob or data URL — use directly
  if (evidenceUrl.startsWith('blob:') || evidenceUrl.startsWith('data:')) {
    return { url: evidenceUrl, type: evidenceUrl.startsWith('data:video') ? 'video/mp4' : 'image/jpeg' };
  }

  // Build absolute URL: relative paths like /api/v1/upload/.../view need the backend origin
  let absoluteUrl;
  if (evidenceUrl.startsWith('http')) {
    absoluteUrl = evidenceUrl;
  } else {
    // e.g. /api/v1/upload/{id}/view  →  http://localhost:8000/api/v1/upload/{id}/view
    const backendOrigin = API_BASE_URL.replace(/\/api\/v1$/, '');
    absoluteUrl = `${backendOrigin}${evidenceUrl}`;
  }

  try {
    const headers = await buildHeaders();
    const res = await fetch(absoluteUrl, { headers });
    if (!res.ok) return null;
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), type: blob.type };
  } catch {
    return null;
  }
}

export async function registerUserProfile(profile) {
  const response = await request('/users/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(profile)
  });

  return response.data;
}

export async function completeRegistration(role) {
  const response = await request('/users/role', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ role })
  });

  return response?.data;
}

export async function getUserProfile() {
  const response = await request('/users/me', {
    method: 'GET'
  });
  return response?.data;
}

export async function uploadEvidence(file) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await request('/upload/', {
    method: 'POST',
    body: formData
  });

  return response.data;
}

export async function createClaim(payload) {
  const response = await request('/claims/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return response.data;
}

export async function analyzeClaim(claimId) {
  const response = await request(`/claims/${claimId}/analyze`, {
    method: 'POST',
    body: ''
  });

  return response.data;
}

export async function getClaimStatus(claimId) {
  const response = await request(`/claims/${claimId}/status`);
  return response.data;
}

export async function getClaim(claimId) {
  const response = await request(`/claims/${claimId}`);
  return response.data;
}

export async function fetchClaims(userId) {
  try {
    const path = userId
      ? `/claims?user_id=${encodeURIComponent(userId)}`
      : '/claims';
    const response = await request(path);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error) {
    if (!userId) {
      throw error;
    }

    const fallbackResponse = await request('/claims');
    return Array.isArray(fallbackResponse.data) ? fallbackResponse.data : [];
  }
}

export async function fetchSellerClaims() {
  const response = await request(`/seller/claims?role=seller`);
  return Array.isArray(response.data) ? response.data : [];
}

export async function getSellerClaimDetail(claimId) {
  const response = await request(`/seller/claims/${claimId}?role=seller`);
  return response.data;
}

export async function submitSellerDecision(claimId, decision, sellerNote = '') {
  const response = await request(`/seller/claims/${claimId}/decision?role=seller`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ decision, seller_note: sellerNote })
  });
  return response.data;
}
