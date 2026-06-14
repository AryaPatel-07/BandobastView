import { useState, useEffect } from 'react';
import MapView from './MapView';
import Sidebar from './Sidebar';
import Login from './Login';
import './App.css';

const AHMEDABAD_CENTER = [23.0225, 72.5714];
const ZONES = [1, 2, 3, 4, 5, 6, 7];

function getAuthHeaders() {
  const token = localStorage.getItem('portal_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('portal_token'));
  const [bandobasts, setBandobasts] = useState([]);
  const [currentBandobast, setCurrentBandobast] = useState(null);
  const [mapCenter, setMapCenter] = useState(AHMEDABAD_CENTER);
  const [route, setRoute] = useState(null);
  const [points, setPoints] = useState([]);
  const [selectedPointId, setSelectedPointId] = useState(null);
  const [liveLocations, setLiveLocations] = useState([]);

  useEffect(() => {
    if (!loggedIn) return;
    let interval;
    const fetchLive = () => {
      fetch('/api/live-locations', { headers: getAuthHeaders() })
        .then((r) => r.ok ? r.json() : [])
        .then(setLiveLocations)
        .catch(() => setLiveLocations([]));
    };
    fetchLive();
    interval = setInterval(fetchLive, 8000);
    return () => clearInterval(interval);
  }, [loggedIn]);

  const fetchBandobasts = async () => {
    const res = await fetch('/api/bandobasts', { headers: getAuthHeaders() });
    if (res.status === 401) { setLoggedIn(false); return; }
    const data = await res.json();
    setBandobasts(data);
  };

  useEffect(() => {
    fetchBandobasts();
  }, []);

  const loadBandobast = async (id) => {
    const res = await fetch(`/api/bandobasts/${id}`, { headers: getAuthHeaders() });
    if (res.status === 401) { setLoggedIn(false); return; }
    const data = await res.json();
    setCurrentBandobast(data);
    setRoute(
      data.route_geometry
        ? typeof data.route_geometry === 'string'
          ? JSON.parse(data.route_geometry)
          : data.route_geometry
        : null
    );
    setPoints(data.points || []);
    setSelectedPointId(null);
    if (data.location_a_lat && data.location_a_lng) {
      setMapCenter([data.location_a_lat, data.location_a_lng]);
    }
  };

  const createNew = () => {
    setCurrentBandobast({
      id: null,
      title: 'New Bandobast',
      zone: 1,
      location_a_name: '',
      location_a_lat: null,
      location_a_lng: null,
      location_b_name: '',
      location_b_lat: null,
      location_b_lng: null,
      route_geometry: null,
      published: 0,
      points: [],
    });
    setRoute(null);
    setPoints([]);
    setSelectedPointId(null);
    setMapCenter(AHMEDABAD_CENTER);
  };

  const saveBandobast = async (payload) => {
    let bandobastId = currentBandobast?.id;
    const headers = { 'Content-Type': 'application/json', ...getAuthHeaders() };
    if (bandobastId) {
      const res = await fetch(`/api/bandobasts/${bandobastId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      });
      if (res.status === 401) { setLoggedIn(false); return bandobastId; }
      await loadBandobast(bandobastId);
    } else {
      const body = {
        title: currentBandobast?.title || 'New Bandobast',
        zone: currentBandobast?.zone ?? 1,
        location_a_name: null,
        location_a_lat: null,
        location_a_lng: null,
        location_b_name: null,
        location_b_lat: null,
        location_b_lng: null,
        route_geometry: null,
        ...payload,
      };
      const res = await fetch('/api/bandobasts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(body),
      });
      if (res.status === 401) { setLoggedIn(false); return null; }
      const { id } = await res.json();
      bandobastId = id;
      await loadBandobast(id);
    }
    fetchBandobasts();
    return bandobastId;
  };

  const savePoints = async (newPoints, bandobastIdOverride) => {
    const id = bandobastIdOverride ?? currentBandobast?.id;
    if (!id) return;
    const res = await fetch(`/api/bandobasts/${id}/points`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(newPoints.map((p) => ({
        point_number: p.point_number,
        lat: p.lat,
        lng: p.lng,
        label: p.label || `Point ${p.point_number}`,
      }))),
    });
    if (res.status === 401) { setLoggedIn(false); return; }
    await loadBandobast(id);
  };

  const saveAssignments = async (pointId, buckleNumbers) => {
    const res = await fetch(`/api/points/${pointId}/assignments`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ buckle_numbers: buckleNumbers }),
    });
    if (res.status === 401) { setLoggedIn(false); return; }
    if (currentBandobast?.id) loadBandobast(currentBandobast.id);
  };

  const publishBandobast = async () => {
    if (!currentBandobast?.id) return;
    const res = await fetch(`/api/bandobasts/${currentBandobast.id}/publish`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (res.status === 401) { setLoggedIn(false); return; }
    const data = await res.json();
    alert(`Published. Notifications sent to ${data.notificationsSent} personnel.`);
    loadBandobast(currentBandobast.id);
    fetchBandobasts();
  };

  const logout = () => {
    localStorage.removeItem('portal_token');
    localStorage.removeItem('portal_username');
    setLoggedIn(false);
  };

  if (!loggedIn) {
    return <Login onSuccess={() => setLoggedIn(true)} />;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Ahmedabad Police Bandobast Portal</h1>
        <span className="subtitle">7 Zones • Route A → B • Posting Points & Notifications</span>
        <button type="button" className="logout-btn" onClick={logout}>
          Logout
        </button>
      </header>
      <div className="layout">
        <Sidebar
          authHeaders={getAuthHeaders()}
          bandobasts={bandobasts}
          currentBandobast={currentBandobast}
          points={points}
          selectedPointId={selectedPointId}
          zones={ZONES}
          onNew={createNew}
          onSelect={loadBandobast}
          onSaveBandobast={saveBandobast}
          onSavePoints={savePoints}
          onSaveAssignments={saveAssignments}
          onPublish={publishBandobast}
          onSelectPoint={setSelectedPointId}
        />
        <MapView
          center={mapCenter}
          route={route}
          points={points}
          liveLocations={liveLocations}
          locationA={currentBandobast ? { name: currentBandobast.location_a_name, lat: currentBandobast.location_a_lat, lng: currentBandobast.location_a_lng } : null}
          locationB={currentBandobast ? { name: currentBandobast.location_b_name, lat: currentBandobast.location_b_lat, lng: currentBandobast.location_b_lng } : null}
          selectedPointId={selectedPointId}
          onLocationSelect={(which, lat, lng, name) => {
            if (!currentBandobast) return;
            const up = which === 'A'
              ? { location_a_lat: lat, location_a_lng: lng, location_a_name: name || 'Location A' }
              : { location_b_lat: lat, location_b_lng: lng, location_b_name: name || 'Location B' };
            saveBandobast(up);
          }}
          onRouteReady={(geometry) => saveBandobast({ route_geometry: geometry })}
          onPointsChange={savePoints}
          onSelectPoint={setSelectedPointId}
        />
      </div>
    </div>
  );
}
