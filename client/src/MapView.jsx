import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, useMap, Polyline, Marker, Popup, CircleMarker } from 'react-leaflet';
import L from 'leaflet';

// Fix default marker icons in Leaflet with bundlers
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

function FitBounds({ route, locationA, locationB, points, liveLocations }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    const latlngs = [];
    if (locationA?.lat != null) latlngs.push([locationA.lat, locationA.lng]);
    if (locationB?.lat != null) latlngs.push([locationB.lat, locationB.lng]);
    if (route?.coordinates) {
      route.coordinates.forEach(([lng, lat]) => latlngs.push([lat, lng]));
    }
    points.forEach((p) => {
      if (p.lat != null && p.lng != null) latlngs.push([p.lat, p.lng]);
    });
    (liveLocations || []).forEach((loc) => latlngs.push([loc.lat, loc.lng]));
    if (latlngs.length >= 2 && !done.current) {
      map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 14 });
      done.current = true;
    }
  }, [map, route, locationA, locationB, points, liveLocations]);
  return null;
}

export default function MapView({
  center,
  route,
  points,
  locationA,
  locationB,
  selectedPointId,
  liveLocations = [],
  onLocationSelect,
  onRouteReady,
  onPointsChange,
  onSelectPoint,
}) {
  const path = route?.coordinates?.map(([lng, lat]) => [lat, lng]);

  return (
    <div className="map-wrap">
      <MapContainer
        center={center}
        zoom={11}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {path && path.length > 0 && (
          <Polyline positions={path} color="#2563eb" weight={5} opacity={0.8} />
        )}
        {locationA?.lat != null && (
          <Marker
            position={[locationA.lat, locationA.lng]}
            eventHandlers={{
              click: () => {},
            }}
          >
            <Popup>
              <strong>Location A</strong>
              <br />
              {locationA.name || 'Start'}
            </Popup>
          </Marker>
        )}
        {locationB?.lat != null && (
          <Marker position={[locationB.lat, locationB.lng]}>
            <Popup>
              <strong>Location B</strong>
              <br />
              {locationB.name || 'End'}
            </Popup>
          </Marker>
        )}
        {points.map((p) => (
          <Marker
            key={p.id}
            position={[p.lat, p.lng]}
            eventHandlers={{
              click: () => onSelectPoint && onSelectPoint(p.id),
            }}
            opacity={selectedPointId === p.id ? 1 : 0.9}
          >
            <Popup>
              <strong>Point {p.point_number}</strong>
              <br />
              {p.label}
              <br />
              Buckles: {(p.buckle_numbers || []).join(', ') || '—'}
            </Popup>
          </Marker>
        ))}
        {liveLocations.map((loc) => (
          <CircleMarker
            key={loc.buckle_number}
            center={[loc.lat, loc.lng]}
            radius={10}
            pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.9, weight: 2 }}
          >
            <Popup>
              <strong>Live: Buckle {loc.buckle_number}</strong>
            </Popup>
          </CircleMarker>
        ))}
        <FitBounds route={route} locationA={locationA} locationB={locationB} points={points} liveLocations={liveLocations} />
      </MapContainer>
    </div>
  );
}
