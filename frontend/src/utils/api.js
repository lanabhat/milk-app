// In production (PythonAnywhere) API is same origin — leave REACT_APP_API_URL blank.
// In development set it to http://localhost:8000
export const API = process.env.REACT_APP_API_URL || '';

export const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  if (!token) { window.location.href = '/'; return null; }
  return { 'Authorization': `Token ${token}`, 'Content-Type': 'application/json' };
};
