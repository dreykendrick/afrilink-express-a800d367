import { useState, useCallback, useRef, useEffect } from 'react';
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

const DEFAULT_CENTER: [number, number] = [-6.7924, 39.2083];
const DEFAULT_ZOOM = 13;
const PLACED_ZOOM = 15;

export function MapPinSelector({ lat, lng, onChange }: MapPinSelectorProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [pinPlaced, setPinPlaced] = useState(lat != null && lng != null);
  const [geoLoading, setGeoLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const placeOrMovePin = useCallback(
    (newLat: number, newLng: number, fly = true) => {
      const map = mapRef.current;
      if (!map) return;

      if (markerRef.current) {
        markerRef.current.setLatLng([newLat, newLng]);
      } else {
        const marker = L.marker([newLat, newLng], { draggable: true }).addTo(map);
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onChange(pos.lat, pos.lng);
        });
        markerRef.current = marker;
      }

      if (fly) map.flyTo([newLat, newLng], PLACED_ZOOM, { duration: 1 });
      setPinPlaced(true);
      onChange(newLat, newLng);
    },
    [onChange],
  );

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const center: [number, number] =
      lat != null && lng != null ? [lat, lng] : DEFAULT_CENTER;
    const zoom = lat != null && lng != null ? PLACED_ZOOM : DEFAULT_ZOOM;

    const map = L.map(containerRef.current, {
      center,
      zoom,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      placeOrMovePin(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;

    // Place initial marker if coordinates exist
    if (lat != null && lng != null) {
      placeOrMovePin(lat, lng, false);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        placeOrMovePin(pos.coords.latitude, pos.coords.longitude);
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
  }, [placeOrMovePin]);

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
          placeOrMovePin(parseFloat(results[0].lat), parseFloat(results[0].lon));
        }
      } catch {
        // Search failed silently
      } finally {
        setSearchLoading(false);
      }
    },
    [searchQuery, placeOrMovePin],
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
        <div ref={containerRef} className="w-full h-full z-0" style={{ height: '100%', width: '100%' }} />

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

      {geoError && <p className="text-xs text-destructive">{geoError}</p>}

      {pinPlaced && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3 text-primary" />
          Delivery pin placed — drag to adjust
        </p>
      )}
    </div>
  );
}
