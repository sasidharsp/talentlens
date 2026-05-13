/**
 * Authenticated file download utility.
 * Works on Railway (uses VITE_API_URL) and locally (uses relative /api path via nginx proxy).
 */
const backendBase = () => import.meta.env.VITE_API_URL || '';

export const downloadFile = async (apiPath, fallbackFilename = 'download') => {
  const token = localStorage.getItem('access_token');
  const url = `${backendBase()}${apiPath}`;

  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Download failed (${res.status})`);
    }

    // Extract filename from Content-Disposition header if present
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename=([^;]+)/);
    const filename = match ? match[1].replace(/"/g, '') : fallbackFilename;

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (err) {
    alert(err.message || 'Download failed. Please try again.');
    throw err;
  }
};

/** Build full URL for non-auth public endpoints (used for forms/uploads) */
export const apiUrl = (path) => `${backendBase()}${path}`;
