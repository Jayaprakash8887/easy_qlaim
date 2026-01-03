import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const TOUR_SEEN_KEY = 'hasSeenTour';

interface TourContextType {
    isTourOpen: boolean;
    startTour: () => void;
    endTour: () => void;
    hasSeenTour: boolean;
    isLoading: boolean;
    markTourComplete: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
    const { getAccessToken } = useAuth();
    const [isTourOpen, setIsTourOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [hasSeenTour, setHasSeenTour] = useState(() => {
        // Initialize from localStorage as fallback
        return localStorage.getItem(TOUR_SEEN_KEY) === 'true';
    });

    // Sync tour status from backend on mount
    useEffect(() => {
        const fetchTourStatus = async () => {
            const token = getAccessToken();
            if (!token) {
                // No token yet, keep loading to wait for auth
                // Use a small timeout to retry
                const retryTimer = setTimeout(() => {
                    setIsLoading(false);
                }, 1000);
                return () => clearTimeout(retryTimer);
            }

            try {
                const response = await fetch(`${API_BASE_URL}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });
                if (response.ok) {
                    const data = await response.json();
                    const backendHasSeen = data.has_seen_tour === true;
                    setHasSeenTour(backendHasSeen);
                    // Sync to localStorage
                    if (backendHasSeen) {
                        localStorage.setItem(TOUR_SEEN_KEY, 'true');
                    } else {
                        // Clear localStorage if backend says not seen (source of truth)
                        localStorage.removeItem(TOUR_SEEN_KEY);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch tour status:', error);
                // Keep using localStorage value on error
            } finally {
                setIsLoading(false);
            }
        };

        fetchTourStatus();
    }, [getAccessToken]);

    const startTour = useCallback(() => {
        setIsTourOpen(true);
    }, []);

    const endTour = useCallback(() => {
        setIsTourOpen(false);
    }, []);

    const markTourComplete = useCallback(async () => {
        // Update local state immediately
        setHasSeenTour(true);
        setIsTourOpen(false);
        localStorage.setItem(TOUR_SEEN_KEY, 'true');

        // Call backend API to persist
        const token = getAccessToken();
        if (token) {
            try {
                await fetch(`${API_BASE_URL}/auth/me/tour-status`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
            } catch (error) {
                console.error('Failed to save tour status to backend:', error);
                // Tour is still marked complete locally
            }
        }
    }, [getAccessToken]);

    return (
        <TourContext.Provider
            value={{
                isTourOpen,
                startTour,
                endTour,
                hasSeenTour,
                isLoading,
                markTourComplete,
            }}
        >
            {children}
        </TourContext.Provider>
    );
}

export function useTour() {
    const context = useContext(TourContext);
    if (context === undefined) {
        throw new Error('useTour must be used within a TourProvider');
    }
    return context;
}
