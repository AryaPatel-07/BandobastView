# Ahmedabad Police Bandobast Portal

Web portal for managing **bandobast** (security arrangements) across **7 zones** in Ahmedabad. When a high-profile visit is planned, you define a route from **Location A** to **Location B**, add **posting points** (1, 2, 3, 4, 5…) along the route, assign **buckle numbers** (personnel) to each point, and **publish** so every assigned officer gets a notification with their posting details.

## Features

- **Portal (officers)**: Login with officer credentials. Create bandobasts, set route A→B, add points, assign buckle numbers, publish. Request people/cars from other zones. See **live locations** of personnel (red dots on map) when they turn on “Share live location” in the app.
- **App (personnel)**: Login with **buckle number** only. View your postings, open a bandobast to see the full route (A→B), data points, and which buckle numbers are posted where (same as portal). **“I’ve reached”** – add a photo from your phone. **Share live location** – when ON, your position appears on the portal as a red dot.
- **Ahmedabad-centric map** (OpenStreetMap), flexible A→B, route drawing (OSRM), posting points, buckle assignments, publish and notifications.

## Tech stack

- **Frontend**: React (Vite), Leaflet (OpenStreetMap), Nominatim (geocoding), OSRM (routing).
- **Backend**: Node.js, Express, file-based JSON store (no database setup required).

No Google Maps API key required; all map and routing use free services.

## Setup

```bash
npm run install:all
npm run dev          # portal + API
# In another terminal, to run the mobile app:
npm run dev:app
```

- **API**: http://127.0.0.1:3001  
- **Portal**: http://localhost:5173 (officer login: default `officer` / `officer`)  
- **App** (personnel): http://localhost:5175 (dummy login: buckle number + PIN)  

See `DUMMY_CREDENTIALS.md` for all dummy logins.

## Portal (officers)

1. Open the portal URL and **sign in** (default: username `officer`, password `officer`).
2. **New Bandobast** – Create a new event; set **Zone** (1–7) and **Title**.
2. **Location A** – Search (e.g. “Gandhinagar”) and pick from results; same for **Location B** (e.g. “Sarkhej”).
3. **Draw route** – Click “Draw route A → B & create 5 points” to get the road route and 5 posting points.
4. **Assign buckle numbers** – For each point (1–5), add buckle numbers; multiple per point is fine.
5. **Publish** – When ready, click “Publish – Send notifications to all buckle numbers”. Each person gets a notification with their posting place and route.
6. **Check posting** – Use “Check my posting” at the bottom: enter a buckle number and click “View my notifications” to see that person’s posting and message.
7. **Live locations** – When personnel turn on “Share live location” in the app, their position appears on the portal map as a **red dot**.

## App (personnel / buckle number)

1. Open the app URL (e.g. http://localhost:5175) and **log in with your buckle number + PIN** (dummy for local demo).
2. See **My postings** – list of bandobasts you’re assigned to.
3. Tap a posting to open **Bandobast detail**: full route (A→B), data points, and who is posted where (same view as portal).
4. **Share live location** – turn ON to let the portal see your position as a red dot; turn OFF to stop.
5. **“I’ve reached – Add photo”** – take/upload a photo when you reach your posting (stored for officers to see).

## API (for integrations)

- `GET /api/bandobasts` – List bandobasts  
- `GET /api/bandobasts/:id` – Get one with points and assignments  
- `POST /api/bandobasts` – Create  
- `PATCH /api/bandobasts/:id` – Update  
- `PUT /api/bandobasts/:id/points` – Replace points for a bandobast  
- `PUT /api/points/:id/assignments` – Set buckle numbers for a point  
- `POST /api/bandobasts/:id/publish` – Publish and send notifications  
- `GET /api/notifications/:buckleNumber` – Notifications for an officer  

Notifications are stored in the DB; you can later plug in SMS/email/push by consuming the same publish flow.
