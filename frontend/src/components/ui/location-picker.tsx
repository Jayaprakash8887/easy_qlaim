import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { MapPin, X, Navigation } from 'lucide-react';

// Extend Window interface for Google Maps
declare global {
    interface Window {
        google: typeof google;
    }
}

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
const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 };
const DEFAULT_ZOOM = 12;

// Get Google Maps API key from environment
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

// Check if Google Maps is loaded
const isGoogleMapsLoaded = () => {
    return typeof window !== 'undefined' && window.google && window.google.maps;
};

// Load Google Maps script dynamically
const loadGoogleMapsScript = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (isGoogleMapsLoaded()) {
            resolve();
            return;
        }

        if (!GOOGLE_MAPS_API_KEY) {
            reject(new Error('Google Maps API key is not configured'));
            return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
            existingScript.addEventListener('load', () => resolve());
            existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
            return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Maps'));
        document.head.appendChild(script);
    });
};

// Reverse geocode to get address from coordinates
const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    if (!isGoogleMapsLoaded()) return '';
    
    try {
        const geocoder = new google.maps.Geocoder();
        const response = await geocoder.geocode({ location: { lat, lng } });
        if (response.results && response.results[0]) {
            return response.results[0].formatted_address;
        }
    } catch (error) {
        console.error('Geocoding error:', error);
    }
    return '';
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
    const [mapLoaded, setMapLoaded] = useState(false);
    
    const mapRef = useRef<HTMLDivElement>(null);
    const googleMapRef = useRef<google.maps.Map | null>(null);
    const markerRef = useRef<google.maps.Marker | null>(null);

    // Initialize map when dialog opens
    useEffect(() => {
        if (!isOpen || !mapRef.current || mapLoaded) return;

        const initMap = async () => {
            setIsLoading(true);
            setError(null);

            try {
                await loadGoogleMapsScript();

                const center = value || DEFAULT_CENTER;
                
                googleMapRef.current = new google.maps.Map(mapRef.current!, {
                    center,
                    zoom: value ? 15 : DEFAULT_ZOOM,
                    mapTypeControl: true,
                    streetViewControl: false,
                    fullscreenControl: true,
                    zoomControl: true,
                    styles: [
                        {
                            featureType: 'poi',
                            elementType: 'labels',
                            stylers: [{ visibility: 'off' }],
                        },
                    ],
                });

                // Create marker
                markerRef.current = new google.maps.Marker({
                    map: googleMapRef.current,
                    draggable: true,
                    position: value || null,
                    animation: google.maps.Animation.DROP,
                });

                // Handle map click
                googleMapRef.current.addListener('click', async (event: google.maps.MapMouseEvent) => {
                    if (event.latLng) {
                        const lat = event.latLng.lat();
                        const lng = event.latLng.lng();
                        
                        markerRef.current?.setPosition(event.latLng);
                        
                        const address = await reverseGeocode(lat, lng);
                        setSelectedLocation({ lat, lng, address });
                    }
                });

                // Handle marker drag
                markerRef.current.addListener('dragend', async () => {
                    const position = markerRef.current?.getPosition();
                    if (position) {
                        const lat = position.lat();
                        const lng = position.lng();
                        const address = await reverseGeocode(lat, lng);
                        setSelectedLocation({ lat, lng, address });
                    }
                });

                setMapLoaded(true);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load map');
            } finally {
                setIsLoading(false);
            }
        };

        initMap();
    }, [isOpen, value, mapLoaded]);

    // Reset map loaded state when dialog closes
    useEffect(() => {
        if (!isOpen) {
            setMapLoaded(false);
            googleMapRef.current = null;
            markerRef.current = null;
        }
    }, [isOpen]);

    // Sync selected location with value prop
    useEffect(() => {
        setSelectedLocation(value || null);
    }, [value]);

    const handleOpenDialog = () => {
        if (!disabled) {
            setSelectedLocation(value || null);
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
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                const newLocation = { lat, lng };
                
                if (googleMapRef.current) {
                    googleMapRef.current.setCenter(newLocation);
                    googleMapRef.current.setZoom(15);
                }
                
                markerRef.current?.setPosition(newLocation);
                
                const address = await reverseGeocode(lat, lng);
                setSelectedLocation({ lat, lng, address });
                setIsLoading(false);
            },
            (error) => {
                setError('Unable to get your location: ' + error.message);
                setIsLoading(false);
            },
            { enableHighAccuracy: true }
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
                                Use Current Location
                            </Button>
                            {selectedLocation && (
                                <span className="text-sm text-muted-foreground">
                                    {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                                </span>
                            )}
                        </div>

                        {/* Map container */}
                        <div className="relative">
                            {isLoading && !mapLoaded && (
                                <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-lg">
                                    <div className="text-center">
                                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                                        <p className="text-sm text-muted-foreground">Loading map...</p>
                                    </div>
                                </div>
                            )}
                            
                            {error && (
                                <div className="absolute inset-0 flex items-center justify-center bg-destructive/10 z-10 rounded-lg">
                                    <div className="text-center p-4">
                                        <p className="text-sm text-destructive">{error}</p>
                                        {!GOOGLE_MAPS_API_KEY && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                                Set VITE_GOOGLE_MAPS_API_KEY in your environment
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div
                                ref={mapRef}
                                className="w-full h-[400px] rounded-lg border bg-muted"
                            />
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
