import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { MapPin, X, Navigation, Search, Loader2, AlertTriangle } from 'lucide-react';
import { Loader } from '@googlemaps/js-api-loader';

// Import Leaflet for fallback
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon issue
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

// Location value structure
export interface LocationValue {
    lat: number;
    lng: number;
    address?: string;
}

interface LocationPickerProps {
    value?: LocationValue | null;
    onChange: (value: LocationValue | null) => void;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
}

// Map provider type
type MapProvider = 'google' | 'osm' | null;

// Default center (Bangalore, India) - can be customized
const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];
const DEFAULT_ZOOM = 12;

// Check if Google Maps API key is configured
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const isGoogleMapsConfigured = !!GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.length > 10;

// Google Maps loader singleton
let googleMapsLoader: Loader | null = null;
let googleMapsLoadPromise: Promise<typeof google.maps> | null = null;
let googleMapsLoadFailed = false;

const loadGoogleMaps = async (): Promise<typeof google.maps | null> => {
    if (googleMapsLoadFailed) return null;
    if (!isGoogleMapsConfigured) {
        googleMapsLoadFailed = true;
        return null;
    }

    if (!googleMapsLoader) {
        googleMapsLoader = new Loader({
            apiKey: GOOGLE_MAPS_API_KEY,
            version: 'weekly',
            libraries: ['places', 'marker'],
        });
    }

    if (!googleMapsLoadPromise) {
        googleMapsLoadPromise = googleMapsLoader.load()
            .then(() => google.maps)
            .catch((error) => {
                console.error('Failed to load Google Maps:', error);
                googleMapsLoadFailed = true;
                googleMapsLoadPromise = null;
                return null;
            });
    }

    return googleMapsLoadPromise;
};

// Reverse geocode using Google Maps
const reverseGeocodeGoogle = async (lat: number, lng: number): Promise<string> => {
    try {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response.results && response.results[0]) {
            return response.results[0].formatted_address;
        }
        return '';
    } catch (error) {
        console.error('Google geocoding error:', error);
        return '';
    }
};

// Reverse geocode using Nominatim (OpenStreetMap fallback)
const reverseGeocodeOSM = async (lat: number, lng: number): Promise<string> => {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
                headers: {
                    'Accept-Language': 'en',
                    'User-Agent': 'EasyQlaim/1.0'
                }
            }
        );
        const data = await response.json();
        return data.display_name || '';
    } catch (error) {
        console.error('OSM geocoding error:', error);
        return '';
    }
};

// Search for locations using Nominatim (used as fallback search)
interface SearchResult {
    place_id: string | number;
    lat: string;
    lng: string;
    display_name: string;
    type: string;
    source: 'google' | 'osm';
}

const searchLocationsOSM = async (query: string): Promise<SearchResult[]> => {
    if (!query || query.length < 3) return [];
    
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`,
            {
                headers: {
                    'Accept-Language': 'en',
                    'User-Agent': 'EasyQlaim/1.0'
                }
            }
        );
        const results = await response.json();
        return results.map((r: any) => ({
            place_id: r.place_id,
            lat: r.lat,
            lng: r.lon,
            display_name: r.display_name,
            type: r.type,
            source: 'osm' as const
        }));
    } catch (error) {
        console.error('OSM search error:', error);
        return [];
    }
};

export function LocationPicker({
    value,
    onChange,
    placeholder = 'Select location on map',
    disabled = false,
    required = false,
}: LocationPickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<LocationValue | null>(value || null);
    const [mapReady, setMapReady] = useState(false);
    const [mapProvider, setMapProvider] = useState<MapProvider>(null);
    const [providerMessage, setProviderMessage] = useState<string>('');
    
    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    
    // Map container ref
    const mapContainerRef = useRef<HTMLDivElement>(null);
    
    // Google Maps refs
    const googleMapRef = useRef<google.maps.Map | null>(null);
    const googleMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
    const googleAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    
    // Leaflet (OSM) refs
    const leafletMapRef = useRef<L.Map | null>(null);
    const leafletMarkerRef = useRef<L.Marker | null>(null);
    
    const mapInitializedRef = useRef(false);

    // Cleanup function
    const cleanupMaps = useCallback(() => {
        // Cleanup Google Maps
        if (googleMapRef.current) {
            // Google Maps doesn't have a destroy method, but we can clear refs
            googleMapRef.current = null;
            googleMarkerRef.current = null;
            if (googleAutocompleteRef.current) {
                google.maps.event.clearInstanceListeners(googleAutocompleteRef.current);
                googleAutocompleteRef.current = null;
            }
        }
        
        // Cleanup Leaflet
        if (leafletMapRef.current) {
            leafletMapRef.current.remove();
            leafletMapRef.current = null;
            leafletMarkerRef.current = null;
        }
        
        mapInitializedRef.current = false;
        setMapReady(false);
        setMapProvider(null);
    }, []);

    // Initialize Google Maps
    const initGoogleMaps = async (container: HTMLDivElement, center: { lat: number; lng: number }) => {
        try {
            const maps = await loadGoogleMaps();
            if (!maps) return false;
            
            // Import the marker library
            const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
            
            const map = new google.maps.Map(container, {
                center,
                zoom: value ? 15 : DEFAULT_ZOOM,
                mapId: 'EASY_QLAIM_MAP', // Required for AdvancedMarkerElement
                mapTypeControl: false,
                streetViewControl: false,
                fullscreenControl: false,
            });

            // Create draggable marker
            const marker = new AdvancedMarkerElement({
                map,
                position: center,
                gmpDraggable: true,
                title: 'Drag to select location',
            });

            // Handle marker drag
            marker.addListener('dragend', async () => {
                const position = marker.position as google.maps.LatLngLiteral;
                if (position) {
                    setIsLoading(true);
                    const address = await reverseGeocodeGoogle(position.lat, position.lng);
                    setSelectedLocation({ lat: position.lat, lng: position.lng, address });
                    setIsLoading(false);
                }
            });

            // Handle map click
            map.addListener('click', async (e: google.maps.MapMouseEvent) => {
                if (e.latLng) {
                    const lat = e.latLng.lat();
                    const lng = e.latLng.lng();
                    marker.position = { lat, lng };
                    
                    setIsLoading(true);
                    const address = await reverseGeocodeGoogle(lat, lng);
                    setSelectedLocation({ lat, lng, address });
                    setIsLoading(false);
                }
            });

            // Setup Places Autocomplete
            if (searchInputRef.current) {
                const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
                    componentRestrictions: { country: 'in' },
                    fields: ['formatted_address', 'geometry', 'name'],
                });

                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place.geometry?.location) {
                        const lat = place.geometry.location.lat();
                        const lng = place.geometry.location.lng();
                        const address = place.formatted_address || place.name || '';
                        
                        map.setCenter({ lat, lng });
                        map.setZoom(15);
                        marker.position = { lat, lng };
                        setSelectedLocation({ lat, lng, address });
                        setSearchQuery('');
                    }
                });

                googleAutocompleteRef.current = autocomplete;
            }

            googleMapRef.current = map;
            googleMarkerRef.current = marker;
            
            return true;
        } catch (error) {
            console.error('Error initializing Google Maps:', error);
            return false;
        }
    };

    // Initialize Leaflet (OSM) Maps
    const initLeafletMaps = (container: HTMLDivElement, center: [number, number]) => {
        try {
            const map = L.map(container, {
                center,
                zoom: value ? 15 : DEFAULT_ZOOM,
                zoomControl: true,
            });

            // Add OpenStreetMap tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
            }).addTo(map);

            // Create draggable marker
            const marker = L.marker(center, {
                draggable: true,
            }).addTo(map);

            // Handle map click
            map.on('click', async (e: L.LeafletMouseEvent) => {
                const { lat, lng } = e.latlng;
                marker.setLatLng(e.latlng);
                
                setIsLoading(true);
                const address = await reverseGeocodeOSM(lat, lng);
                setSelectedLocation({ lat, lng, address });
                setIsLoading(false);
            });

            // Handle marker drag
            marker.on('dragend', async () => {
                const position = marker.getLatLng();
                
                setIsLoading(true);
                const address = await reverseGeocodeOSM(position.lat, position.lng);
                setSelectedLocation({ lat: position.lat, lng: position.lng, address });
                setIsLoading(false);
            });

            leafletMapRef.current = map;
            leafletMarkerRef.current = marker;

            // Force resize after rendering
            requestAnimationFrame(() => {
                map.invalidateSize();
                setTimeout(() => map.invalidateSize(), 100);
                setTimeout(() => map.invalidateSize(), 300);
            });

            return true;
        } catch (error) {
            console.error('Error initializing Leaflet:', error);
            return false;
        }
    };

    // Initialize map when dialog opens
    useEffect(() => {
        if (!isOpen) {
            cleanupMaps();
            return;
        }

        if (mapInitializedRef.current) {
            // Resize existing map
            if (googleMapRef.current) {
                google.maps.event.trigger(googleMapRef.current, 'resize');
            }
            if (leafletMapRef.current) {
                setTimeout(() => leafletMapRef.current?.invalidateSize(), 100);
            }
            return;
        }

        const initMap = async () => {
            const container = mapContainerRef.current;
            if (!container) {
                setTimeout(initMap, 100);
                return;
            }

            const rect = container.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                setTimeout(initMap, 100);
                return;
            }

            mapInitializedRef.current = true;
            const center = value 
                ? { lat: value.lat, lng: value.lng }
                : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };

            // Try Google Maps first
            if (isGoogleMapsConfigured && !googleMapsLoadFailed) {
                console.log('Attempting to load Google Maps...');
                const googleSuccess = await initGoogleMaps(container, center);
                if (googleSuccess) {
                    setMapProvider('google');
                    setMapReady(true);
                    setProviderMessage('');
                    console.log('Google Maps initialized successfully');
                    return;
                }
                console.log('Google Maps failed, falling back to OpenStreetMap...');
            }

            // Fallback to OpenStreetMap
            console.log('Initializing OpenStreetMap...');
            const osmSuccess = initLeafletMaps(container, [center.lat, center.lng]);
            if (osmSuccess) {
                setMapProvider('osm');
                setMapReady(true);
                if (isGoogleMapsConfigured) {
                    setProviderMessage('Using OpenStreetMap (Google Maps unavailable)');
                } else {
                    setProviderMessage('Using OpenStreetMap');
                }
                console.log('OpenStreetMap initialized successfully');
            } else {
                setError('Failed to initialize map');
                mapInitializedRef.current = false;
            }
        };

        setTimeout(initMap, 200);
    }, [isOpen, cleanupMaps]);

    // Sync selected location with value prop
    useEffect(() => {
        setSelectedLocation(value || null);
    }, [value]);

    // Update marker when selected location changes
    useEffect(() => {
        if (!selectedLocation) return;

        if (googleMapRef.current && googleMarkerRef.current) {
            googleMarkerRef.current.position = { lat: selectedLocation.lat, lng: selectedLocation.lng };
            googleMapRef.current.setCenter({ lat: selectedLocation.lat, lng: selectedLocation.lng });
        }
        
        if (leafletMapRef.current && leafletMarkerRef.current) {
            leafletMarkerRef.current.setLatLng([selectedLocation.lat, selectedLocation.lng]);
            leafletMapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 15);
        }
    }, [selectedLocation?.lat, selectedLocation?.lng]);

    const handleOpenDialog = () => {
        if (!disabled) {
            setSelectedLocation(value || null);
            setError(null);
            setProviderMessage('');
            setIsOpen(true);
        }
    };

    const handleConfirm = () => {
        onChange(selectedLocation);
        setIsOpen(false);
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange(null);
        setSelectedLocation(null);
    };

    const handleGetCurrentLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser');
            return;
        }

        setIsLoading(true);
        setError(null);
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                // Update map view and marker
                if (googleMapRef.current && googleMarkerRef.current) {
                    googleMapRef.current.setCenter({ lat, lng });
                    googleMapRef.current.setZoom(15);
                    googleMarkerRef.current.position = { lat, lng };
                }
                
                if (leafletMapRef.current && leafletMarkerRef.current) {
                    leafletMapRef.current.setView([lat, lng], 15);
                    leafletMarkerRef.current.setLatLng([lat, lng]);
                }
                
                // Reverse geocode based on provider
                const address = mapProvider === 'google' 
                    ? await reverseGeocodeGoogle(lat, lng)
                    : await reverseGeocodeOSM(lat, lng);
                    
                setSelectedLocation({ lat, lng, address });
                setIsLoading(false);
            },
            (error) => {
                setError('Unable to get your location: ' + error.message);
                setIsLoading(false);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Handle search input change with debounce (for OSM fallback)
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const query = e.target.value;
        setSearchQuery(query);
        
        // If using Google Maps, let autocomplete handle it
        if (mapProvider === 'google') {
            return;
        }
        
        // OSM search with debounce
        setShowResults(true);
        
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        
        if (query.length < 3) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        
        setIsSearching(true);
        searchTimeoutRef.current = setTimeout(async () => {
            const results = await searchLocationsOSM(query);
            setSearchResults(results);
            setIsSearching(false);
        }, 300);
    };

    // Handle selecting a search result (for OSM)
    const handleSelectResult = (result: SearchResult) => {
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lng);
        
        setSelectedLocation({
            lat,
            lng,
            address: result.display_name
        });
        
        if (leafletMapRef.current && leafletMarkerRef.current) {
            leafletMapRef.current.setView([lat, lng], 15);
            leafletMarkerRef.current.setLatLng([lat, lng]);
        }
        
        setSearchQuery('');
        setSearchResults([]);
        setShowResults(false);
    };

    const displayValue = value?.address || (value ? `${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}` : '');

    return (
        <>
            <div className="relative">
                <div
                    className={`flex items-center border rounded-md px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors ${
                        disabled ? 'opacity-50 cursor-not-allowed' : ''
                    } ${!value ? 'text-muted-foreground' : ''}`}
                    onClick={handleOpenDialog}
                >
                    <MapPin className="h-4 w-4 mr-2 text-muted-foreground flex-shrink-0" />
                    <span className="flex-1 truncate text-sm">
                        {displayValue || placeholder}
                    </span>
                    {value && !disabled && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 ml-2"
                            onClick={handleClear}
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
                    <DialogHeader>
                        <DialogTitle>Select Location</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* Provider status message */}
                        {providerMessage && (
                            <div className="flex items-center gap-2 p-2 bg-muted rounded-md text-sm text-muted-foreground">
                                <AlertTriangle className="h-4 w-4" />
                                {providerMessage}
                            </div>
                        )}

                        {/* Search input */}
                        <div className="relative">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder={mapProvider === 'google' 
                                        ? "Search for a place..." 
                                        : "Search for a place or address..."}
                                    value={searchQuery}
                                    onChange={handleSearchChange}
                                    onFocus={() => mapProvider === 'osm' && setShowResults(true)}
                                    className="pl-9 pr-9"
                                />
                                {isSearching && (
                                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                            </div>
                            
                            {/* Search results dropdown (OSM only - Google uses native autocomplete) */}
                            {mapProvider === 'osm' && showResults && searchResults.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.place_id}
                                            className="w-full text-left px-3 py-2 hover:bg-accent text-sm border-b last:border-b-0 flex items-start gap-2"
                                            onClick={() => handleSelectResult(result)}
                                        >
                                            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                            <span className="line-clamp-2">{result.display_name}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Current location button */}
                        <div className="flex items-center justify-between">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleGetCurrentLocation}
                                disabled={isLoading}
                            >
                                <Navigation className="h-4 w-4 mr-2" />
                                {isLoading ? 'Getting location...' : 'Use Current Location'}
                            </Button>
                            {selectedLocation && (
                                <span className="text-sm text-muted-foreground">
                                    {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                                </span>
                            )}
                        </div>

                        {/* Error display */}
                        {error && (
                            <div className="p-3 bg-destructive/10 rounded-lg">
                                <p className="text-sm text-destructive">{error}</p>
                            </div>
                        )}

                        {/* Map container */}
                        <div className="relative" style={{ height: '350px' }}>
                            <div
                                ref={mapContainerRef}
                                className="w-full h-full rounded-lg border"
                                style={{ 
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    zIndex: 1,
                                    background: '#e0e0e0'
                                }}
                            />
                            {!mapReady && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                                        <p className="text-sm text-muted-foreground">Loading map...</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Selected address display */}
                        {selectedLocation?.address && (
                            <div className="p-3 bg-muted rounded-lg">
                                <Label className="text-xs text-muted-foreground">Selected Address</Label>
                                <p className="text-sm mt-1">{selectedLocation.address}</p>
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                            Click on the map to select a location, or drag the marker to adjust.
                            {mapProvider === 'google' && ' • Powered by Google Maps'}
                            {mapProvider === 'osm' && ' • Powered by OpenStreetMap'}
                        </p>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirm} disabled={!selectedLocation}>
                            Confirm Location
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

// Compact display component for showing selected location
export function LocationDisplay({ value }: { value?: LocationValue | null }) {
    if (!value) return <span className="text-muted-foreground">No location selected</span>;
    
    return (
        <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
                {value.address || `${value.lat.toFixed(4)}, ${value.lng.toFixed(4)}`}
            </span>
        </div>
    );
}
