import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, 'data.json');
const uploadsDir = join(__dirname, 'uploads');

if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
      const name = [req.body.buckle_number, req.body.point_id, Date.now()].filter(Boolean).join('_');
      const ext = (file.mimetype.match(/\/(jpeg|jpg|png|webp)/) || ['', 'jpg'])[1];
      cb(null, `${name}.${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// In-memory: officer sessions (token -> username), live locations (buckle_number -> { lat, lng, updatedAt })
const officerTokens = new Map();
const liveLocations = new Map();
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LIVE_LOCATION_MAX_AGE_MS = 5 * 60 * 1000; // consider stale after 5 min

function load() {
  if (!existsSync(dataPath)) {
    return {
      bandobasts: [],
      points: [],
      assignments: [],
      notifications: [],
      people_requests: [],
      car_requests: [],
      // Dummy "web/portal" logins for local demo/testing only.
      officers: [
        { username: 'officer', password: 'officer' },
        { username: 'admin', password: 'admin123' },
        { username: 'control', password: 'control123' },
      ],
      arrival_photos: [],
    };
  }
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  if (!Array.isArray(data.people_requests)) data.people_requests = [];
  if (!Array.isArray(data.car_requests)) data.car_requests = [];
  if (!Array.isArray(data.officers) || data.officers.length === 0) {
    data.officers = [
      { username: 'officer', password: 'officer' },
      { username: 'admin', password: 'admin123' },
      { username: 'control', password: 'control123' },
    ];
  }
  if (!Array.isArray(data.arrival_photos)) data.arrival_photos = [];
  return data;
}

function save(data) {
  writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/api/uploads', express.static(uploadsDir));

function requireOfficer(req, res, next) {
  const auth = req.headers.authorization;
  const token = auth && auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token || !officerTokens.has(token)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.officer = officerTokens.get(token);
  next();
}

// --- Officer login (portal: high-ranked officers)
app.post('/api/auth/officer', (req, res) => {
  const { username, password } = req.body || {};
  const data = load();
  const officer = data.officers.find((o) => o.username === username && o.password === password);
  if (!officer) return res.status(401).json({ error: 'Invalid username or password' });
  const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
  officerTokens.set(token, { username: officer.username });
  res.json({ token, username: officer.username });
});

app.get('/api/auth/me', requireOfficer, (req, res) => {
  res.json({ username: req.officer.username });
});

// --- Live location: app sends location; portal reads (officer only)
app.post('/api/live-location', (req, res) => {
  const { buckle_number, lat, lng } = req.body || {};
  if (!buckle_number || lat == null || lng == null) return res.status(400).json({ error: 'buckle_number, lat, lng required' });
  liveLocations.set(String(buckle_number).trim(), {
    lat: Number(lat),
    lng: Number(lng),
    updatedAt: new Date().toISOString(),
  });
  res.json({ ok: true });
});

app.post('/api/live-location/off', (req, res) => {
  const { buckle_number } = req.body || {};
  if (buckle_number) liveLocations.delete(String(buckle_number).trim());
  res.json({ ok: true });
});

app.get('/api/live-locations', requireOfficer, (req, res) => {
  const now = Date.now();
  const list = [];
  liveLocations.forEach((v, buckle_number) => {
    const age = now - new Date(v.updatedAt).getTime();
    if (age < LIVE_LOCATION_MAX_AGE_MS) list.push({ buckle_number, lat: v.lat, lng: v.lng, updatedAt: v.updatedAt });
  });
  res.json(list);
});

// --- Arrival photo: app uploads when officer reaches posting
app.post('/api/arrival-photo', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Photo file required' });
  const { buckle_number, point_id, bandobast_id } = req.body || {};
  const data = load();
  const id = (data.arrival_photos.length ? Math.max(...data.arrival_photos.map((p) => p.id)) : 0) + 1;
  data.arrival_photos.push({
    id,
    buckle_number: String(buckle_number || '').trim(),
    point_id: point_id ? Number(point_id) : null,
    bandobast_id: bandobast_id ? Number(bandobast_id) : null,
    path: '/api/uploads/' + req.file.filename,
    created_at: new Date().toISOString(),
  });
  save(data);
  res.status(201).json({ id, path: data.arrival_photos[data.arrival_photos.length - 1].path });
});

app.get('/api/arrival-photos', (req, res) => {
  const data = load();
  let list = data.arrival_photos || [];
  if (req.query.bandobast_id) list = list.filter((p) => p.bandobast_id === Number(req.query.bandobast_id));
  if (req.query.point_id) list = list.filter((p) => p.point_id === Number(req.query.point_id));
  list = [...list].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(list);
});

// Portal-protected API (optional: require officer for write operations; allow reads for app too)
// List bandobasts
app.get('/api/bandobasts', (req, res) => {
  const data = load();
  const list = data.bandobasts.map((b) => ({
    id: b.id,
    title: b.title,
    zone: b.zone,
    location_a_name: b.location_a_name,
    location_b_name: b.location_b_name,
    published: b.published,
    created_at: b.created_at,
  }));
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(list);
});

// Get single bandobast with points and assignments
app.get('/api/bandobasts/:id', (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const bandobast = data.bandobasts.find((b) => b.id === id);
  if (!bandobast) return res.status(404).json({ error: 'Not found' });
  const points = data.points.filter((p) => p.bandobast_id === id).sort((a, b) => a.point_number - b.point_number);
  const withAssignments = points.map((p) => ({
    ...p,
    buckle_numbers: data.assignments.filter((a) => a.point_id === p.id).map((a) => a.buckle_number),
  }));
  res.json({ ...bandobast, points: withAssignments });
});

// Create bandobast (portal only)
app.post('/api/bandobasts', requireOfficer, (req, res) => {
  const data = load();
  const { title, zone, location_a_name, location_a_lat, location_a_lng, location_b_name, location_b_lat, location_b_lng, route_geometry } = req.body;
  const id = (data.bandobasts.length ? Math.max(...data.bandobasts.map((b) => b.id)) : 0) + 1;
  data.bandobasts.push({
    id,
    title: title || 'New Bandobast',
    zone: zone ?? 1,
    location_a_name: location_a_name ?? null,
    location_a_lat: location_a_lat ?? null,
    location_a_lng: location_a_lng ?? null,
    location_b_name: location_b_name ?? null,
    location_b_lat: location_b_lat ?? null,
    location_b_lng: location_b_lng ?? null,
    route_geometry: route_geometry ?? null,
    published: 0,
    created_at: new Date().toISOString(),
  });
  save(data);
  res.status(201).json({ id });
});

// Update bandobast (portal only)
app.patch('/api/bandobasts/:id', requireOfficer, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const bandobast = data.bandobasts.find((b) => b.id === id);
  if (!bandobast) return res.status(404).json({ error: 'Not found' });
  const b = req.body;
  if (b.title !== undefined) bandobast.title = b.title;
  if (b.zone !== undefined) bandobast.zone = b.zone;
  if (b.location_a_name !== undefined) bandobast.location_a_name = b.location_a_name;
  if (b.location_a_lat !== undefined) bandobast.location_a_lat = b.location_a_lat;
  if (b.location_a_lng !== undefined) bandobast.location_a_lng = b.location_a_lng;
  if (b.location_b_name !== undefined) bandobast.location_b_name = b.location_b_name;
  if (b.location_b_lat !== undefined) bandobast.location_b_lat = b.location_b_lat;
  if (b.location_b_lng !== undefined) bandobast.location_b_lng = b.location_b_lng;
  if (b.route_geometry !== undefined) bandobast.route_geometry = b.route_geometry;
  save(data);
  res.json({ ok: true });
});

// Replace points for a bandobast (portal only)
app.put('/api/bandobasts/:id/points', requireOfficer, (req, res) => {
  const data = load();
  const bandobastId = Number(req.params.id);
  const points = req.body;
  const oldPointIds = data.points.filter((p) => p.bandobast_id === bandobastId).map((p) => p.id);
  data.assignments = data.assignments.filter((a) => !oldPointIds.includes(a.point_id));
  data.points = data.points.filter((p) => p.bandobast_id !== bandobastId);
  const maxPointId = data.points.length ? Math.max(...data.points.map((p) => p.id)) : 0;
  points.forEach((p, i) => {
    data.points.push({
      id: maxPointId + i + 1,
      bandobast_id: bandobastId,
      point_number: p.point_number,
      lat: p.lat,
      lng: p.lng,
      label: p.label || `Point ${p.point_number}`,
    });
  });
  save(data);
  res.json({ ok: true });
});

// Set assignments for a point (portal only)
app.put('/api/points/:id/assignments', requireOfficer, (req, res) => {
  const data = load();
  const pointId = Number(req.params.id);
  const { buckle_numbers } = req.body;
  data.assignments = data.assignments.filter((a) => a.point_id !== pointId);
  (buckle_numbers || []).forEach((bn) => {
    if (String(bn).trim()) {
      const id = data.assignments.length ? Math.max(...data.assignments.map((a) => a.id)) + 1 : 1;
      data.assignments.push({ id, point_id: pointId, buckle_number: String(bn).trim() });
    }
  });
  save(data);
  res.json({ ok: true });
});

// Publish bandobast -> create notifications (portal only)
app.post('/api/bandobasts/:id/publish', requireOfficer, (req, res) => {
  const data = load();
  const bandobastId = Number(req.params.id);
  const bandobast = data.bandobasts.find((b) => b.id === bandobastId);
  if (!bandobast) return res.status(404).json({ error: 'Not found' });
  const points = data.points.filter((p) => p.bandobast_id === bandobastId);
  let notifId = data.notifications.length ? Math.max(...data.notifications.map((n) => n.id)) + 1 : 1;
  let count = 0;
  for (const point of points) {
    const assignments = data.assignments.filter((a) => a.point_id === point.id);
    const place = point.label || `Point ${point.point_number}`;
    const message = `Your posting for today is at: ${place}. Route: ${bandobast.location_a_name} to ${bandobast.location_b_name}.`;
    for (const { buckle_number } of assignments) {
      data.notifications.push({
        id: notifId++,
        buckle_number,
        bandobast_id: bandobastId,
        point_id: point.id,
        message,
        read_flag: 0,
        created_at: new Date().toISOString(),
      });
      count++;
    }
  }
  bandobast.published = 1;
  save(data);
  res.json({ ok: true, notificationsSent: count });
});

// Get notifications for a buckle number
app.get('/api/notifications/:buckleNumber', (req, res) => {
  const data = load();
  const buckleNumber = decodeURIComponent(req.params.buckleNumber);
  const notifs = data.notifications.filter((n) => n.buckle_number === buckleNumber);
  const bandobastIds = [...new Set(notifs.map((n) => n.bandobast_id))];
  const pointIds = [...new Set(notifs.map((n) => n.point_id))];
  const bandobasts = data.bandobasts.filter((b) => bandobastIds.includes(b.id));
  const points = data.points.filter((p) => pointIds.includes(p.id));
  const rows = notifs
    .map((n) => {
      const b = bandobasts.find((x) => x.id === n.bandobast_id);
      const p = points.find((x) => x.id === n.point_id);
      return {
        ...n,
        title: b?.title,
        location_a_name: b?.location_a_name,
        location_b_name: b?.location_b_name,
        point_label: p?.label,
        lat: p?.lat,
        lng: p?.lng,
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(rows);
});

app.patch('/api/notifications/:id/read', (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const n = data.notifications.find((x) => x.id === id);
  if (n) n.read_flag = 1;
  save(data);
  res.json({ ok: true });
});

// --- People requests (portal only)
app.get('/api/people-requests', requireOfficer, (req, res) => {
  const data = load();
  const list = [...data.people_requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(list);
});

app.post('/api/people-requests', requireOfficer, (req, res) => {
  const data = load();
  const { from_zone, to_zone, buckle_numbers, note } = req.body;
  const numbers = Array.isArray(buckle_numbers) ? buckle_numbers : [];
  if (numbers.length > 500) return res.status(400).json({ error: 'Maximum 500 people per request' });
  const id = (data.people_requests.length ? Math.max(...data.people_requests.map((r) => r.id)) : 0) + 1;
  data.people_requests.push({
    id,
    from_zone: Number(from_zone),
    to_zone: Number(to_zone),
    buckle_numbers: numbers.map((b) => String(b).trim()).filter(Boolean),
    note: note || null,
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  save(data);
  res.status(201).json({ id });
});

app.patch('/api/people-requests/:id', requireOfficer, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const r = data.people_requests.find((x) => x.id === id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (req.body.status !== undefined) r.status = req.body.status;
  save(data);
  res.json({ ok: true });
});

// --- Car requests (portal only)
app.get('/api/car-requests', requireOfficer, (req, res) => {
  const data = load();
  const list = [...data.car_requests].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  res.json(list);
});

const CAR_NUMBER_REGEX = /^[A-Z]{2}-[0-9]{2}-[A-Z]{2}-[0-9]{4}$/i;

app.post('/api/car-requests', requireOfficer, (req, res) => {
  const data = load();
  const { from_zone, to_zone, car_numbers, note } = req.body;
  const numbers = Array.isArray(car_numbers) ? car_numbers : [];
  const invalid = numbers.filter((c) => !CAR_NUMBER_REGEX.test(String(c).trim()));
  if (invalid.length) return res.status(400).json({ error: 'Invalid car number(s). Use format LL-DD-LL-NNNN (e.g. GJ-01-AB-1234)', invalid });
  const id = (data.car_requests.length ? Math.max(...data.car_requests.map((r) => r.id)) : 0) + 1;
  data.car_requests.push({
    id,
    from_zone: Number(from_zone),
    to_zone: Number(to_zone),
    car_numbers: numbers.map((c) => String(c).trim().toUpperCase()),
    note: note || null,
    status: 'pending',
    created_at: new Date().toISOString(),
  });
  save(data);
  res.status(201).json({ id });
});

app.patch('/api/car-requests/:id', requireOfficer, (req, res) => {
  const data = load();
  const id = Number(req.params.id);
  const r = data.car_requests.find((x) => x.id === id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (req.body.status !== undefined) r.status = req.body.status;
  save(data);
  res.json({ ok: true });
});

const PORT = 3001;
const HOST = '127.0.0.1';
app.listen(PORT, HOST, () => console.log(`Bandobast API running at http://${HOST}:${PORT}`));
