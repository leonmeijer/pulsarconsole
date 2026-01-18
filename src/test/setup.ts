import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, vi } from 'vitest';
import { server } from './mocks/server';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: vi.fn((key: string) => store[key] || null),
        setItem: vi.fn((key: string, value: string) => {
            store[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
            delete store[key];
        }),
        clear: vi.fn(() => {
            store = {};
        }),
        get length() {
            return Object.keys(store).length;
        },
        key: vi.fn((index: number) => Object.keys(store)[index] || null),
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
});

// Establish API mocking before all tests
beforeAll(() => {
    server.listen({ onUnhandledRequest: 'error' });
});

// Reset any request handlers that we may add during the tests
afterEach(() => {
    cleanup();
    server.resetHandlers();
});

// Clean up after the tests are finished
afterAll(() => {
    server.close();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Mock ResizeObserver - using class syntax for proper constructor behavior
class ResizeObserverMock {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
}
global.ResizeObserver = ResizeObserverMock;

// Mock IntersectionObserver - using class syntax for proper constructor behavior
class IntersectionObserverMock {
    root = null;
    rootMargin = '';
    thresholds = [];
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
}
global.IntersectionObserver = IntersectionObserverMock as unknown as typeof IntersectionObserver;

// Mock scrollTo
window.scrollTo = vi.fn();

// Suppress console errors during tests (optional)
const originalError = console.error;
console.error = (...args) => {
    if (
        typeof args[0] === 'string' &&
        (args[0].includes('Warning: ReactDOM.render is no longer supported') ||
            args[0].includes('Warning: An update to') ||
            args[0].includes('act(...)'))
    ) {
        return;
    }
    originalError.call(console, ...args);
};
