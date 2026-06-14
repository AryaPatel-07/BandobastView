import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import './App.css';
import { API_BASE } from './apiBase';

L.Marker.prototype.options.icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function FitBounds({ route, locationA, locationB, points }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    const latlngs = [];
    if (locationA?.lat != null) latlngs.push([locationA.lat, locationA.lng]);
    if (locationB?.lat != null) latlngs.push([locationB.lat, locationB.lng]);
    if (route?.coordinates) route.coordinates.forEach(([lng, lat]) => latlngs.push([lat, lng]));
    points.forEach((p) => { if (p.lat != null && p.lng != null) latlngs.push([p.lat, p.lng]); });
    if (latlngs.length >= 2 && !done.current) {
      map.fitBounds(latlngs, { padding: [30, 30], maxZoom: 14 });
      done.current = true;
    }
  }, [map, route, locationA, locationB, points]);
  return null;
}

export default function BandobastDetail({ bandobastId, buckleNumber, onBack }) {
  const [bandobast, setBandobast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [liveOn, setLiveOn] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoDone, setPhotoDone] = useState(false);
  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);

  const myPosting = bandobast?.points?.find((p) => (p.buckle_numbers || []).includes(buckleNumber));
  const route = bandobast?.route_geometry
    ? (typeof bandobast.route_geometry === 'string'
        ? JSON.parse(bandobast.route_geometry)
        : bandobast.route_geometry)
    : null;
  const path = route?.coordinates?.map(([lng, lat]) => [lat, lng]);
  const locationA = bandobast?.location_a_lat != null
    ? { name: bandobast.location_a_name, lat: bandobast.location_a_lat, lng: bandobast.location_a_lng }
    : null;
  const locationB = bandobast?.location_b_lat != null
    ? { name: bandobast.location_b_name, lat: bandobast.location_b_lat, lng: bandobast.location_b_lng }
    : null;

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/bandobasts/${bandobastId}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setBandobast(data); })
      .catch(() => { if (!cancelled) setBandobast(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [bandobastId]);

  const sendLocation = (lat, lng) => {
    fetch(`${API_BASE}/api/live-location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buckle_number: buckleNumber, lat, lng }),
    }).catch(() => {});
  };

  const turnOffLive = () => {
    fetch(`${API_BASE}/api/live-location/off`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buckle_number: buckleNumber }),
    }).catch(() => {});
  };

  useEffect(() => {
    if (!liveOn) {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      turnOffLive();
      return;
    }
    const onPos = (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      sendLocation(lat, lng);
    };
    watchIdRef.current = navigator.geolocation.watchPosition(onPos, () => {}, { enableHighAccuracy: true, maximumAge: 10000 });
    const iv = setInterval(() => {
      navigator.geolocation.getCurrentPosition(onPos, () => {});
    }, 10000);
    intervalRef.current = iv;
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      turnOffLive();
    };
  }, [liveOn, buckleNumber]);

  const handlePhoto = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      setUploading(true);
      const form = new FormData();
      form.append('photo', file);
      form.append('buckle_number', buckleNumber);
      if (myPosting?.id) form.append('point_id', myPosting.id);
      form.append('bandobast_id', bandobastId);
      try {
        const res = await fetch(`${API_BASE}/api/arrival-photo`, { method: 'POST', body: form });
        if (res.ok) setPhotoDone(true);
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  if (loading || !bandobast) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <button type="button" className="back-btn" onClick={onBack}>← Back</button>
          <h1>Bandobast</h1>
        </header>
        <main className="app-main"><p className="meta">Loading…</p></main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button type="button" className="back-btn" onClick={onBack}>← Back</button>
        <h1>{bandobast.title}</h1>
      </header>
      <div className="detail-route">
        {bandobast.location_a_name} → {bandobast.location_b_name}
      </div>
      <div className="map-container">
        <MapContainer
          center={[bandobast.location_a_lat ?? 23.02, bandobast.location_a_lng ?? 72.57]}
          zoom={12}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='© OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {path?.length > 0 && <Polyline positions={path} color="#2563eb" weight={4} opacity={0.8} />}
          {locationA && <Marker position={[locationA.lat, locationA.lng]}><Popup>Start: {locationA.name}</Popup></Marker>}
          {locationB && <Marker position={[locationB.lat, locationB.lng]}><Popup>End: {locationB.name}</Popup></Marker>}
          {(bandobast.points || []).map((p) => (
            <Marker key={p.id} position={[p.lat, p.lng]}>
              <Popup>
                <strong>Point {p.point_number}</strong><br />
                {p.label}<br />
                Buckles: {(p.buckle_numbers || []).join(', ') || '—'}
              </Popup>
            </Marker>
          ))}
          <FitBounds route={route} locationA={locationA} locationB={locationB} points={bandobast.points || []} />
        </MapContainer>
      </div>
      <div className="detail-actions">
        <button
          type="button"
          className={`action-btn ${liveOn ? 'active' : ''}`}
          onClick={() => setLiveOn((v) => !v)}
        >
          {liveOn ? '● Live location ON' : 'Share live location'}
        </button>
        <p className="meta">When ON, officers on the portal see your position as a red dot.</p>
        {myPosting && (
          <>
            <button
              type="button"
              className="action-btn primary"
              disabled={uploading || photoDone}
              onClick={handlePhoto}
            >
              {uploading ? 'Uploading…' : photoDone ? 'Photo submitted' : "I've reached – Add photo"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
