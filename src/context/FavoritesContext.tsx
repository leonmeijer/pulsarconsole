import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type FavoriteType = 'tenant' | 'namespace' | 'topic' | 'subscription';

export interface Favorite {
    id: string;
    type: FavoriteType;
    name: string;
    path: string;
    // Additional context for display
    tenant?: string;
    namespace?: string;
    topic?: string;
}

interface FavoritesContextType {
    favorites: Favorite[];
    addFavorite: (favorite: Omit<Favorite, 'id'>) => void;
    removeFavorite: (id: string) => void;
    isFavorite: (type: FavoriteType, name: string, tenant?: string, namespace?: string, topic?: string) => boolean;
    toggleFavorite: (favorite: Omit<Favorite, 'id'>) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

const STORAGE_KEY = 'pulsar-favorites';

function generateId(type: FavoriteType, name: string, tenant?: string, namespace?: string, topic?: string): string {
    if (type === 'tenant') return `tenant:${name}`;
    if (type === 'namespace') return `namespace:${tenant}/${name}`;
    if (type === 'topic') return `topic:${tenant}/${namespace}/${name}`;
    return `subscription:${tenant}/${namespace}/${topic}/${name}`;
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
    const [favorites, setFavorites] = useState<Favorite[]>(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    });

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    }, [favorites]);

    const addFavorite = (favorite: Omit<Favorite, 'id'>) => {
        const id = generateId(favorite.type, favorite.name, favorite.tenant, favorite.namespace, favorite.topic);
        setFavorites(prev => {
            if (prev.some(f => f.id === id)) return prev;
            return [...prev, { ...favorite, id }];
        });
    };

    const removeFavorite = (id: string) => {
        setFavorites(prev => prev.filter(f => f.id !== id));
    };

    const isFavorite = (type: FavoriteType, name: string, tenant?: string, namespace?: string, topic?: string): boolean => {
        const id = generateId(type, name, tenant, namespace, topic);
        return favorites.some(f => f.id === id);
    };

    const toggleFavorite = (favorite: Omit<Favorite, 'id'>) => {
        const id = generateId(favorite.type, favorite.name, favorite.tenant, favorite.namespace, favorite.topic);
        if (favorites.some(f => f.id === id)) {
            removeFavorite(id);
        } else {
            addFavorite(favorite);
        }
    };

    return (
        <FavoritesContext.Provider value={{ favorites, addFavorite, removeFavorite, isFavorite, toggleFavorite }}>
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites() {
    const context = useContext(FavoritesContext);
    if (context === undefined) {
        throw new Error('useFavorites must be used within a FavoritesProvider');
    }
    return context;
}
