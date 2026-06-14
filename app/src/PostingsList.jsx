import { useState, useEffect } from 'react';
import './App.css';
import { API_BASE } from './apiBase';

export default function PostingsList({ buckleNumber, onSelectBandobast, onLogout }) {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/notifications/${encodeURIComponent(buckleNumber)}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setList(data); })
      .catch(() => { if (!cancelled) setList([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [buckleNumber]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>My postings</h1>
        <span className="app-buckle">Buckle: {buckleNumber}</span>
        <button type="button" className="logout-btn" onClick={onLogout}>Logout</button>
      </header>
      <main className="app-main">
        {loading ? (
          <p className="meta">Loading…</p>
        ) : list.length === 0 ? (
          <p className="meta">No postings assigned yet.</p>
        ) : (
          <ul className="postings-list">
            {list.map((n) => (
              <li
                key={n.id}
                className="posting-card"
                onClick={() => onSelectBandobast(n.bandobast_id)}
              >
                <strong>{n.title || 'Bandobast'}</strong>
                <p className="posting-route">{n.location_a_name} → {n.location_b_name}</p>
                <p className="posting-point">Your point: {n.point_label}</p>
                <span className="meta">{new Date(n.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
