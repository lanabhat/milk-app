import React, { useState } from 'react';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const Login = () => {
  const [mode, setMode]           = useState('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [error, setError]         = useState('');
  const [success, setSuccess]     = useState('');
  const [loading, setLoading]     = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`${API}/api/auth/register/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, first_name: firstName, last_name: lastName }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Registered! Please sign in.');
        setMode('login'); setEmail(''); setPassword(''); setFirstName(''); setLastName('');
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch (err) {
      setError('Network error: ' + err.message);
    } finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
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
      <form onSubmit={mode === 'login' ? handleLogin : handleRegister}
        style={{ backgroundColor: 'white', padding: 28, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', width: '100%', maxWidth: 380 }}>
        <h2 style={{ fontSize: 22, marginBottom: 2, color: '#1e293b' }}>🥛 Milk & Paper</h2>
        <p style={{ color: '#64748b', marginBottom: 20, fontSize: 13 }}>
          {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
        </p>

        {error   && <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', padding: '10px 12px', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>{error}</div>}
        {success && <div style={{ backgroundColor: '#f0fdf4', color: '#166534', padding: '10px 12px', borderRadius: 6, marginBottom: 14, fontSize: 13 }}>{success}</div>}

        {mode === 'register' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <label><span style={lbl}>First Name</span>
              <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} /></label>
            <label><span style={lbl}>Last Name</span>
              <input type="text" value={lastName}  onChange={e => setLastName(e.target.value)}  style={inp} /></label>
          </div>
        )}

        <label style={{ display: 'block', marginBottom: 12 }}>
          <span style={lbl}>Email</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com" style={inp} required />
        </label>

        <label style={{ display: 'block', marginBottom: 18 }}>
          <span style={lbl}>Password</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            placeholder="••••••••" style={inp} required />
        </label>

        <button type="submit" disabled={loading}
          style={{ width: '100%', backgroundColor: '#1d4ed8', color: 'white', padding: '10px', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 13, color: '#64748b' }}>
          {mode === 'login' ? (
            <>No account? <button type="button" onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
              style={{ color: '#1d4ed8', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Register</button></>
          ) : (
            <>Already registered? <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
              style={{ color: '#1d4ed8', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 600 }}>Sign In</button></>
          )}
        </div>
      </form>
    </div>
  );
};

export default Login;
