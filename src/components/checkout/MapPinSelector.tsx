import { useState, useCallback, useRef, useEffect } from 'react';
// react-leaflet v4 for React 18 compatibility
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Navigation, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapPinSelectorProps {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
}

// Default center: Dar es Salaam
const DEFAULT_CENTER: [number, number] = [-6.7924, 39.2083];
const DEFAULT_ZOOM = 13;
const PLACED_ZOOM = 15;

/** Draggable marker that reports position changes */
function DraggableMarker({
  position,
  onMove,
}: {
  position: [number, number];
  onMove: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const { lat, lng } = marker.getLatLng();
        onMove(lat, lng);
      }
    },
  };

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
}

/** Click-to-place handler */
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Fly the map to a given position */
function FlyTo({ position, zoom }: { position: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(position, zoom, { duration: 1 });
  }, [position[0], position[1], zoom]);
  return null;
}

export function MapPinSelector({ lat, lng, onChange }: MapPinSelectorProps) {
  const [pinPlaced, setPinPlaced] = useState(lat != null && lng != null);
  const [position, setPosition] = useState<[number, number]>(
    lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER,
  );
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const handlePinMove = useCallback(
    (newLat: number, newLng: number) => {
      const pos: [number, number] = [newLat, newLng];
      setPosition(pos);
      setPinPlaced(true);
      onChange(newLat, newLng);
    },
    [onChange],
  );

  const handleMapClick = useCallback(
    (newLat: number, newLng: number) => {
      const pos: [number, number] = [newLat, newLng];
      setPosition(pos);
      setFlyTarget(pos);
      setPinPlaced(true);
      onChange(newLat, newLng);
    },
    [onChange],
  );

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPosition(newPos);
        setFlyTarget(newPos);
        setPinPlaced(true);
        onChange(pos.coords.latitude, pos.coords.longitude);
        setGeoLoading(false);
      },
      (err) => {
        setGeoError(
          err.code === 1
            ? 'Location access denied. Please enable location permissions.'
            : 'Could not get your location. Please place the pin manually.',
        );
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, [onChange]);

  const handleSearch = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const q = searchQuery.trim();
      if (!q) return;
      setSearchLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1&countrycodes=tz`,
        );
        const results = await res.json();
        if (results.length > 0) {
          const newLat = parseFloat(results[0].lat);
          const newLng = parseFloat(results[0].lon);
          const newPos: [number, number] = [newLat, newLng];
          setPosition(newPos);
          setFlyTarget(newPos);
          setPinPlaced(true);
          onChange(newLat, newLng);
        }
      } catch {
        // Search failed silently; user can still pin manually
      } finally {
        setSearchLoading(false);
      }
    },
    [searchQuery, onChange],
  );

  return (
    <div className="space-y-3">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search area e.g. Mikocheni, Dar es Salaam"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 pl-9 text-sm"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="h-10 px-3"
          disabled={searchLoading || !searchQuery.trim()}
        >
          {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Go'}
        </Button>
      </form>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-border relative" style={{ height: 260 }}>
        <MapContainer
          center={position}
          zoom={pinPlaced ? PLACED_ZOOM : DEFAULT_ZOOM}
          scrollWheelZoom
          className="w-full h-full z-0"
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onClick={handleMapClick} />
          {flyTarget && <FlyTo position={flyTarget} zoom={PLACED_ZOOM} />}
          {pinPlaced && <DraggableMarker position={position} onMove={handlePinMove} />}
        </MapContainer>

        {/* Overlay hint when no pin */}
        {!pinPlaced && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
            <div className="bg-background/90 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground shadow-md">
              <MapPin className="w-4 h-4 text-primary" />
              Tap the map to drop your delivery pin
            </div>
          </div>
        )}
      </div>

      {/* Use my location button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full h-10 text-sm"
        onClick={handleUseMyLocation}
        disabled={geoLoading}
      >
        {geoLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Getting location...
          </>
        ) : (
          <>
            <Navigation className="w-4 h-4 mr-2" />
            Use my current location
          </>
        )}
      </Button>

      {geoError && (
        <p className="text-xs text-destructive">{geoError}</p>
      )}

      {pinPlaced && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3 text-primary" />
          Delivery pin placed — drag to adjust
        </p>
      )}
    </div>
  );
}
