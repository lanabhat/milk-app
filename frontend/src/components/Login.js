import React, { useState } from 'react';

const API = process.env.REACT_APP_API_URL || '';

const Login = () => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/api/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/dashboard';
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally { setLoading(false); }
  };

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', fontSize: 14 };
  const lbl = { display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#374151' };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' }}>
      <form onSubmit={handleLogin}
        style={{ backgroundColor: 'white', padding: 28, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '100%', maxWidth: 360 }}>
        <h2 style={{ fontSize: 22, marginBottom: 2, color: '#1e293b' }}>🥛 Milk & Paper</h2>
        <p style={{ color: '#64748b', marginBottom: 20, fontSize: 13 }}>Sign in to your account</p>

        {error && <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '10px 12px', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>{error}</div>}

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={lbl}>Email</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" style={inp} required autoFocus />
        </label>

        <label style={{ display: 'block', marginBottom: 18 }}>
          <span style={lbl}>Password</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" style={inp} required />
        </label>

        <button type="submit" disabled={loading}
          style={{ width: '100%', backgroundColor: '#1d4ed8', color: 'white', padding: '10px', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontSize: 14, fontWeight: 700 }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
};

export default Login;
