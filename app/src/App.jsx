import { useState, useEffect } from 'react';
import Login from './Login';
import PostingsList from './PostingsList';
import BandobastDetail from './BandobastDetail';
import './App.css';

export default function App() {
  const [buckleNumber, setBuckleNumber] = useState(localStorage.getItem('app_buckle') || '');
  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [selectedBandobastId, setSelectedBandobastId] = useState(null);

  const isLoggedIn = !!buckleNumber;

  const handleLogin = (bn) => {
    const b = String(bn).trim();
    localStorage.setItem('app_buckle', b);
    setBuckleNumber(b);
  };

  const handleLogout = () => {
    localStorage.removeItem('app_buckle');
    setBuckleNumber('');
    setView('list');
    setSelectedBandobastId(null);
  };

  const openBandobast = (id) => {
    setSelectedBandobastId(id);
    setView('detail');
  };

  const goBack = () => {
    setView('list');
    setSelectedBandobastId(null);
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  if (view === 'detail' && selectedBandobastId) {
    return (
      <BandobastDetail
        bandobastId={selectedBandobastId}
        buckleNumber={buckleNumber}
        onBack={goBack}
      />
    );
  }

  return (
    <PostingsList
      buckleNumber={buckleNumber}
      onSelectBandobast={openBandobast}
      onLogout={handleLogout}
    />
  );
}
