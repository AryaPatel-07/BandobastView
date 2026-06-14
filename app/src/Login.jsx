import { useState } from 'react';
import './Login.css';

// Dummy "app" logins (buckle number + PIN) for local demo/testing only.
const DUMMY_APP_USERS = {
  '1001': '1111',
  '1002': '2222',
  '1003': '3333',
  '2001': '1234',
};

export default function Login({ onLogin }) {
  const [buckle, setBuckle] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const b = buckle.trim();
    if (!b) {
      setError('Enter your buckle number');
      return;
    }
    const p = pin.trim();
    if (!p) {
      setError('Enter your PIN');
      return;
    }
    if (!Object.prototype.hasOwnProperty.call(DUMMY_APP_USERS, b) || DUMMY_APP_USERS[b] !== p) {
      setError('Invalid buckle number or PIN (dummy login)');
      return;
    }
    setError('');
    onLogin(b);
  };

  return (
    <div className="login-page">
      <div className="login-box">
        <h1>Bandobast App</h1>
        <p className="login-subtitle">Login with your buckle number and PIN</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={buckle}
            onChange={(e) => setBuckle(e.target.value)}
            placeholder="Buckle number"
            autoComplete="username"
            autoFocus
          />
          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            autoComplete="current-password"
          />
          {error && <p className="login-error">{error}</p>}
          <button type="submit">Sign in</button>
        </form>
        <p className="login-subtitle" style={{ marginTop: 12, fontSize: 12 }}>
          Dummy logins: 1001/1111, 1002/2222, 1003/3333, 2001/1234
        </p>
      </div>
    </div>
  );
}
