import { useState, useEffect } from 'react';

async function searchLocation(query) {
  if (!query || query.length < 2) return [];
  const q = encodeURIComponent(query + ', Ahmedabad, Gujarat, India');
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=5`,
    { headers: { Accept: 'application/json' } }
  );
  const data = await res.json();
  return data.map((d) => ({
    name: d.display_name,
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
  }));
}

export default function Sidebar({
  bandobasts,
  currentBandobast,
  points,
  selectedPointId,
  zones,
  onNew,
  onSelect,
  onSaveBandobast,
  onSavePoints,
  onSaveAssignments,
  onPublish,
  onSelectPoint,
  authHeaders = {},
}) {
  const [searchA, setSearchA] = useState('');
  const [searchB, setSearchB] = useState('');
  const [resultsA, setResultsA] = useState([]);
  const [resultsB, setResultsB] = useState([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [newBuckle, setNewBuckle] = useState({});
  const [checkBuckle, setCheckBuckle] = useState('');
  const [myNotifications, setMyNotifications] = useState([]);
  const [showCheck, setShowCheck] = useState(false);

  // People request: from_zone requests people from to_zone (buckle numbers, max 500)
  const [peopleRequests, setPeopleRequests] = useState([]);
  const [peopleFromZone, setPeopleFromZone] = useState(1);
  const [peopleToZone, setPeopleToZone] = useState(1);
  const [peopleBuckleInput, setPeopleBuckleInput] = useState('');
  const [peopleNote, setPeopleNote] = useState('');
  const [peopleSubmitting, setPeopleSubmitting] = useState(false);

  // Car request: from_zone requests cars from to_zone (LL-DD-LL-NNNN)
  const [carRequests, setCarRequests] = useState([]);
  const [carFromZone, setCarFromZone] = useState(1);
  const [carToZone, setCarToZone] = useState(1);
  const [carNumbersInput, setCarNumbersInput] = useState('');
  const [carNote, setCarNote] = useState('');
  const [carSubmitting, setCarSubmitting] = useState(false);

  const handleSearchA = async () => {
    const r = await searchLocation(searchA);
    setResultsA(r);
  };
  const handleSearchB = async () => {
    const r = await searchLocation(searchB);
    setResultsB(r);
  };

  const setLocationA = (loc) => {
    onSaveBandobast({
      location_a_name: loc.name,
      location_a_lat: loc.lat,
      location_a_lng: loc.lng,
    });
    setSearchA(loc.name);
    setResultsA([]);
  };
  const setLocationB = (loc) => {
    onSaveBandobast({
      location_b_name: loc.name,
      location_b_lat: loc.lat,
      location_b_lng: loc.lng,
    });
    setSearchB(loc.name);
    setResultsB([]);
  };

  const fetchRoute = async () => {
    const a = currentBandobast?.location_a_lat != null && currentBandobast?.location_a_lng != null;
    const b = currentBandobast?.location_b_lat != null && currentBandobast?.location_b_lng != null;
    if (!a || !b) {
      alert('Please set both Location A and Location B first.');
      return;
    }
    setLoadingRoute(true);
    try {
      const coords = `${currentBandobast.location_a_lng},${currentBandobast.location_a_lat};${currentBandobast.location_b_lng},${currentBandobast.location_b_lat}`;
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.code !== 'Ok' || !data.routes?.[0]) {
        alert('Could not find route. Try different locations.');
        return;
      }
      const geometry = data.routes[0].geometry;
      const bandobastId = await onSaveBandobast({ route_geometry: geometry });
      // Auto-create 5 points along the route
      const path = geometry.coordinates;
      const n = 5;
      const newPoints = [];
      for (let i = 0; i < n; i++) {
        const idx = Math.floor((path.length - 1) * (i + 1) / (n + 1));
        const [lng, lat] = path[idx];
        newPoints.push({
          point_number: i + 1,
          lat,
          lng,
          label: `Point ${i + 1}`,
          buckle_numbers: [],
        });
      }
      await onSavePoints(newPoints, bandobastId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert('Route fetch failed. ' + msg);
    } finally {
      setLoadingRoute(false);
    }
  };

  const addBuckle = (pointId) => {
    const num = newBuckle[pointId]?.trim();
    if (!num) return;
    const point = points.find((p) => p.id === pointId);
    if (!point) return;
    const updated = [...(point.buckle_numbers || []), num];
    onSaveAssignments(pointId, updated);
    setNewBuckle((prev) => ({ ...prev, [pointId]: '' }));
  };

  const removeBuckle = (pointId, buckleNumber) => {
    const point = points.find((p) => p.id === pointId);
    if (!point) return;
    const updated = (point.buckle_numbers || []).filter((b) => b !== buckleNumber);
    onSaveAssignments(pointId, updated);
  };

  const canPublish =
    currentBandobast?.id &&
    !currentBandobast.published &&
    points.length > 0 &&
    points.some((p) => (p.buckle_numbers || []).length > 0);

  const fetchMyNotifications = async () => {
    if (!checkBuckle.trim()) return;
    const res = await fetch(`/api/notifications/${encodeURIComponent(checkBuckle.trim())}`);
    const data = await res.json();
    setMyNotifications(data);
    setShowCheck(true);
  };

  const fetchPeopleRequests = async () => {
    const res = await fetch('/api/people-requests', { headers: authHeaders });
    const data = await res.json().catch(() => []);
    setPeopleRequests(data);
  };
  const fetchCarRequests = async () => {
    const res = await fetch('/api/car-requests', { headers: authHeaders });
    const data = await res.json().catch(() => []);
    setCarRequests(data);
  };

  const [arrivalPhotos, setArrivalPhotos] = useState([]);

  useEffect(() => {
    fetchPeopleRequests();
    fetchCarRequests();
  }, []);

  useEffect(() => {
    if (!currentBandobast?.id) { setArrivalPhotos([]); return; }
    fetch(`/api/arrival-photos?bandobast_id=${currentBandobast.id}`)
      .then((r) => r.json())
      .then(setArrivalPhotos)
      .catch(() => setArrivalPhotos([]));
  }, [currentBandobast?.id]);

  const submitPeopleRequest = async () => {
    const raw = peopleBuckleInput.replace(/\n/g, ',').split(',').map((s) => s.trim()).filter(Boolean);
    if (raw.length === 0) {
      alert('Enter at least one buckle number (e.g. 1, 2, 3 or 1-10).');
      return;
    }
    if (raw.length > 500) {
      alert('Maximum 500 people per request.');
      return;
    }
    if (peopleFromZone === peopleToZone) {
      alert('Requesting zone and provider zone must be different.');
      return;
    }
    setPeopleSubmitting(true);
    try {
      const res = await fetch('/api/people-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          from_zone: peopleFromZone,
          to_zone: peopleToZone,
          buckle_numbers: raw,
          note: peopleNote || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Request failed');
        return;
      }
      setPeopleBuckleInput('');
      setPeopleNote('');
      fetchPeopleRequests();
    } finally {
      setPeopleSubmitting(false);
    }
  };

  const CAR_REGEX = /^[A-Za-z]{2}-[0-9]{2}-[A-Za-z]{2}-[0-9]{4}$/;
  const submitCarRequest = async () => {
    const raw = carNumbersInput.replace(/\n/g, ',').split(',').map((s) => s.trim()).filter(Boolean);
    const invalid = raw.filter((c) => !CAR_REGEX.test(c));
    if (invalid.length) {
      alert('Invalid car number(s). Use format LL-DD-LL-NNNN (e.g. GJ-01-AB-1234). Invalid: ' + invalid.slice(0, 3).join(', ') + (invalid.length > 3 ? '…' : ''));
      return;
    }
    if (raw.length === 0) {
      alert('Enter at least one car number.');
      return;
    }
    if (carFromZone === carToZone) {
      alert('Requesting zone and provider zone must be different.');
      return;
    }
    setCarSubmitting(true);
    try {
      const res = await fetch('/api/car-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          from_zone: carFromZone,
          to_zone: carToZone,
          car_numbers: raw,
          note: carNote || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Request failed');
        return;
      }
      setCarNumbersInput('');
      setCarNote('');
      fetchCarRequests();
    } finally {
      setCarSubmitting(false);
    }
  };

  return (
    <aside className="sidebar">
      <section>
        <h2>Bandobasts</h2>
        <button type="button" className="secondary" onClick={onNew}>
          + New Bandobast
        </button>
        <div style={{ marginTop: '0.75rem' }}>
          {bandobasts.map((b) => (
            <div
              key={b.id}
              className={`list-item ${currentBandobast?.id === b.id ? 'active' : ''}`}
              onClick={() => onSelect(b.id)}
            >
              <div className="title">{b.title}</div>
              <div className="meta">
                Zone {b.zone} • {b.location_a_name || 'A'} → {b.location_b_name || 'B'}
                {b.published ? ' • Published' : ''}
              </div>
            </div>
          ))}
        </div>
      </section>

      {currentBandobast && (
        <>
          <section>
            <h2>Details</h2>
            <label>Title</label>
            <input
              value={currentBandobast.title}
              onChange={(e) => onSaveBandobast({ title: e.target.value })}
              placeholder="e.g. VIP Visit 15 Jan"
            />
            <label>Zone (1–7)</label>
            <select
              value={currentBandobast.zone}
              onChange={(e) => onSaveBandobast({ zone: Number(e.target.value) })}
            >
              {zones.map((z) => (
                <option key={z} value={z}>Zone {z}</option>
              ))}
            </select>
          </section>

          <section>
            <h2>Location A (Start)</h2>
            <input
              value={searchA || currentBandobast.location_a_name || ''}
              onChange={(e) => setSearchA(e.target.value)}
              placeholder="e.g. Gandhinagar"
              onBlur={() => setTimeout(handleSearchA, 200)}
            />
            {resultsA.length > 0 && (
              <div className="search-results">
                {resultsA.map((loc, i) => (
                  <div
                    key={i}
                    className="list-item"
                    onClick={() => setLocationA(loc)}
                  >
                    {loc.name}
                  </div>
                ))}
              </div>
            )}
            {currentBandobast.location_a_name && (
              <div className="meta">Selected: {currentBandobast.location_a_name}</div>
            )}
          </section>

          <section>
            <h2>Location B (End)</h2>
            <input
              value={searchB || currentBandobast.location_b_name || ''}
              onChange={(e) => setSearchB(e.target.value)}
              placeholder="e.g. Sarkhej"
              onBlur={() => setTimeout(handleSearchB, 200)}
            />
            {resultsB.length > 0 && (
              <div className="search-results">
                {resultsB.map((loc, i) => (
                  <div
                    key={i}
                    className="list-item"
                    onClick={() => setLocationB(loc)}
                  >
                    {loc.name}
                  </div>
                ))}
              </div>
            )}
            {currentBandobast.location_b_name && (
              <div className="meta">Selected: {currentBandobast.location_b_name}</div>
            )}
          </section>

          <section>
            <h2>Route & Points</h2>
            <button
              type="button"
              onClick={fetchRoute}
              disabled={loadingRoute}
            >
              {loadingRoute ? 'Loading route…' : 'Draw route A → B & create 5 points'}
            </button>
            <p className="meta" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
              Sets route between A and B and adds 5 posting points (1–5) along the route.
            </p>
          </section>

          {points.length > 0 && (
            <section>
              <h2>Posting points – Buckle numbers</h2>
              {points.map((p) => (
                <div
                  key={p.id}
                  className={`point-card ${selectedPointId === p.id ? 'selected' : ''}`}
                  onClick={() => onSelectPoint(p.id)}
                >
                  <h3>Point {p.point_number} – {p.label}</h3>
                  <input
                    className="buckle-input"
                    placeholder="Add buckle number"
                    value={newBuckle[p.id] || ''}
                    onChange={(e) => setNewBuckle((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addBuckle(p.id)}
                  />
                  <span className="add-buckle" onClick={() => addBuckle(p.id)}>
                    + Add
                  </span>
                  <div className="buckle-list">
                    {(p.buckle_numbers || []).map((bn) => (
                      <span key={bn} style={{ display: 'inline-flex', alignItems: 'center', marginRight: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ background: '#334155', padding: '0.2rem 0.5rem', borderRadius: 4 }}>{bn}</span>
                        <button
                          type="button"
                          className="danger"
                          style={{ width: 'auto', padding: '0.2rem 0.4rem', marginLeft: '0.25rem', fontSize: '0.75rem' }}
                          onClick={(ev) => { ev.stopPropagation(); removeBuckle(p.id, bn); }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {arrivalPhotos.length > 0 && (
            <section>
              <h2>Arrival photos</h2>
              <p className="meta" style={{ marginBottom: '0.5rem' }}>Photos submitted by personnel when they reached their posting.</p>
              {arrivalPhotos.map((p) => (
                <div key={p.id} className="point-card">
                  <strong>Buckle {p.buckle_number}</strong>
                  <span className="meta"> {p.created_at ? new Date(p.created_at).toLocaleString() : ''}</span>
                  <a href={p.path} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '0.35rem', color: '#3b82f6', fontSize: '0.85rem' }}>View photo</a>
                </div>
              ))}
            </section>
          )}

          <section className="publish-section">
            <button
              type="button"
              className="big"
              disabled={!canPublish}
              onClick={onPublish}
            >
              Publish – Send notifications to all buckle numbers
            </button>
            {currentBandobast.published && (
              <p style={{ marginTop: '0.5rem', color: '#22c55e', fontSize: '0.85rem' }}>
                This bandobast is published. Personnel have been notified.
              </p>
            )}
          </section>
        </>
      )}

      <section>
        <h2>Request people (from another zone)</h2>
        <p className="meta" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
          Requesting zone asks another zone for personnel (buckle numbers). Max 500.
        </p>
        <label>Requesting zone</label>
        <select value={peopleFromZone} onChange={(e) => setPeopleFromZone(Number(e.target.value))}>
          {zones.map((z) => (
            <option key={z} value={z}>Zone {z}</option>
          ))}
        </select>
        <label>Request from zone</label>
        <select value={peopleToZone} onChange={(e) => setPeopleToZone(Number(e.target.value))}>
          {zones.map((z) => (
            <option key={z} value={z}>Zone {z}</option>
          ))}
        </select>
        <label>Buckle numbers (comma or newline, max 500)</label>
        <textarea
          value={peopleBuckleInput}
          onChange={(e) => setPeopleBuckleInput(e.target.value)}
          placeholder="1, 2, 3, 4, 5, 6, 7, 8, 9, 10"
          rows={3}
          style={{ resize: 'vertical', marginBottom: '0.5rem' }}
        />
        <label>Note (optional)</label>
        <input
          value={peopleNote}
          onChange={(e) => setPeopleNote(e.target.value)}
          placeholder="e.g. For bandobast at Sarkhej"
          style={{ marginBottom: '0.5rem' }}
        />
        <button type="button" onClick={submitPeopleRequest} disabled={peopleSubmitting}>
          {peopleSubmitting ? 'Submitting…' : 'Submit people request'}
        </button>
        {peopleRequests.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <strong className="meta">Recent requests</strong>
            {peopleRequests.slice(0, 5).map((r) => (
              <div key={r.id} className="point-card" style={{ marginTop: '0.4rem' }}>
                <strong>Zone {r.from_zone} → Zone {r.to_zone}</strong>
                <span className="meta"> {r.buckle_numbers?.length || 0} people</span>
                {r.note && <p className="meta" style={{ margin: '0.25rem 0 0 0' }}>{r.note}</p>}
                <span className="meta">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Request cars (from another zone)</h2>
        <p className="meta" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
          Requesting zone asks another zone for vehicles. Format: LL-DD-LL-NNNN (e.g. GJ-01-AB-1234).
        </p>
        <label>Requesting zone</label>
        <select value={carFromZone} onChange={(e) => setCarFromZone(Number(e.target.value))}>
          {zones.map((z) => (
            <option key={z} value={z}>Zone {z}</option>
          ))}
        </select>
        <label>Request from zone</label>
        <select value={carToZone} onChange={(e) => setCarToZone(Number(e.target.value))}>
          {zones.map((z) => (
            <option key={z} value={z}>Zone {z}</option>
          ))}
        </select>
        <label>Car numbers (one per line or comma-separated)</label>
        <textarea
          value={carNumbersInput}
          onChange={(e) => setCarNumbersInput(e.target.value)}
          placeholder={'GJ-01-AB-1234\nGJ-01-CD-5678'}
          rows={3}
          style={{ resize: 'vertical', marginBottom: '0.5rem' }}
        />
        <label>Note (optional)</label>
        <input
          value={carNote}
          onChange={(e) => setCarNote(e.target.value)}
          placeholder="e.g. For convoy duty"
          style={{ marginBottom: '0.5rem' }}
        />
        <button type="button" onClick={submitCarRequest} disabled={carSubmitting}>
          {carSubmitting ? 'Submitting…' : 'Submit car request'}
        </button>
        {carRequests.length > 0 && (
          <div style={{ marginTop: '0.75rem' }}>
            <strong className="meta">Recent requests</strong>
            {carRequests.slice(0, 5).map((r) => (
              <div key={r.id} className="point-card" style={{ marginTop: '0.4rem' }}>
                <strong>Zone {r.from_zone} → Zone {r.to_zone}</strong>
                <span className="meta"> {r.car_numbers?.length || 0} cars</span>
                {r.note && <p className="meta" style={{ margin: '0.25rem 0 0 0' }}>{r.note}</p>}
                <span className="meta">{new Date(r.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2>Check my posting (buckle number)</h2>
        <input
          value={checkBuckle}
          onChange={(e) => setCheckBuckle(e.target.value)}
          placeholder="Enter your buckle number"
        />
        <button type="button" className="secondary" onClick={fetchMyNotifications}>
          View my notifications
        </button>
        {showCheck && (
          <div className="notif-list" style={{ marginTop: '0.75rem' }}>
            {myNotifications.length === 0 ? (
              <p className="meta">No notifications for this buckle number.</p>
            ) : (
              myNotifications.map((n) => (
                <div key={n.id} className="point-card">
                  <strong>{n.point_label}</strong>
                  <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem' }}>{n.message}</p>
                  <span className="meta">{new Date(n.created_at).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>
        )}
      </section>
    </aside>
  );
}
