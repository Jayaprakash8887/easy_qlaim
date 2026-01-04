import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { MapPin, X, Navigation } from 'lucide-react';

// Import Leaflet
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

// Default center (Bangalore, India) - can be customized
const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];
const DEFAULT_ZOOM = 12;

// Reverse geocode using Nominatim (free OpenStreetMap service)
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
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
        console.error('Geocoding error:', error);
        return '';
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
    
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const mapInitializedRef = useRef(false);

    // Initialize map when dialog opens
    useEffect(() => {
        if (!isOpen) {
            // Cleanup when dialog closes
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
                mapInitializedRef.current = false;
                setMapReady(false);
            }
            return;
        }

        // Prevent double initialization
        if (mapInitializedRef.current) {
            if (mapRef.current) {
                setTimeout(() => mapRef.current?.invalidateSize(), 100);
            }
            return;
        }

        // Wait for DOM to be ready
        const initMap = () => {
            const container = mapContainerRef.current;
            if (!container) {
                console.log('Map container not ready, retrying...');
                setTimeout(initMap, 100);
                return;
            }

            // Check container has dimensions
            const rect = container.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                console.log('Map container has no dimensions, retrying...');
                setTimeout(initMap, 100);
                return;
            }

            try {
                mapInitializedRef.current = true;
                const center: [number, number] = value 
                    ? [value.lat, value.lng] 
                    : DEFAULT_CENTER;

                console.log('Initializing Leaflet map at:', center);

                // Create map
                const map = L.map(container, {
                    center,
                    zoom: value ? 15 : DEFAULT_ZOOM,
                    zoomControl: true,
                });

                // Add OpenStreetMap tile layer
                const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '© OpenStreetMap contributors',
                    maxZoom: 19,
                });
                
                tileLayer.on('load', () => {
                    console.log('Tile layer loaded');
                });
                
                tileLayer.on('tileerror', (e) => {
                    console.error('Tile error:', e);
                });
                
                tileLayer.addTo(map);

                // Create draggable marker
                const marker = L.marker(center, {
                    draggable: true,
                }).addTo(map);

                // Handle map click
                map.on('click', async (e: L.LeafletMouseEvent) => {
                    const { lat, lng } = e.latlng;
                    marker.setLatLng(e.latlng);
                    
                    setIsLoading(true);
                    const address = await reverseGeocode(lat, lng);
                    setSelectedLocation({ lat, lng, address });
                    setIsLoading(false);
                });

                // Handle marker drag
                marker.on('dragend', async () => {
                    const position = marker.getLatLng();
                    
                    setIsLoading(true);
                    const address = await reverseGeocode(position.lat, position.lng);
                    setSelectedLocation({ lat: position.lat, lng: position.lng, address });
                    setIsLoading(false);
                });

                mapRef.current = map;
                markerRef.current = marker;
                setMapReady(true);
                console.log('Map initialized successfully');

                // Force resize after rendering
                requestAnimationFrame(() => {
                    map.invalidateSize();
                    setTimeout(() => map.invalidateSize(), 100);
                    setTimeout(() => map.invalidateSize(), 300);
                });
            } catch (err) {
                console.error('Error initializing map:', err);
                setError('Failed to initialize map');
                mapInitializedRef.current = false;
            }
        };

        // Start initialization after dialog animation
        setTimeout(initMap, 200);

    }, [isOpen]);

    // Sync selected location with value prop
    useEffect(() => {
        setSelectedLocation(value || null);
    }, [value]);

    // Update marker when selected location changes from current location
    useEffect(() => {
        if (mapRef.current && markerRef.current && selectedLocation) {
            markerRef.current.setLatLng([selectedLocation.lat, selectedLocation.lng]);
            mapRef.current.setView([selectedLocation.lat, selectedLocation.lng], 15);
        }
    }, [selectedLocation?.lat, selectedLocation?.lng]);

    const handleOpenDialog = () => {
        if (!disabled) {
            setSelectedLocation(value || null);
            setError(null);
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
                
                if (mapRef.current && markerRef.current) {
                    mapRef.current.setView([lat, lng], 15);
                    markerRef.current.setLatLng([lat, lng]);
                }
                
                const address = await reverseGeocode(lat, lng);
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
                        <div className="relative" style={{ height: '400px' }}>
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
