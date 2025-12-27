import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

// Create mock functions before the mock
const mockGet = vi.fn();
const mockPost = vi.fn();

// Mock the API client - vi.mock is hoisted automatically
vi.mock('../api/client', () => ({
    default: {
        get: (...args: unknown[]) => mockGet(...args),
        post: (...args: unknown[]) => mockPost(...args),
    },
}));

// Import after mock definition
import { AuthProvider, useAuth, getStoredAccessToken } from './AuthContext';

function TestWrapper({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>;
}

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        sessionStorage.clear();

        // Default mock responses
        mockGet.mockImplementation((url: string) => {
            if (url === '/api/v1/auth/providers') {
                return Promise.resolve({
                    data: { providers: [], auth_required: false },
                });
            }
            if (url === '/api/v1/auth/me') {
                return Promise.resolve({
                    data: {
                        id: '1',
                        email: 'user@example.com',
                        display_name: 'Test User',
                        avatar_url: null,
                        is_active: true,
                        roles: [],
                    },
                });
            }
            return Promise.reject(new Error('Unknown URL'));
        });
    });

    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    describe('useAuth hook', () => {
        it('throws error when used outside AuthProvider', () => {
            // Suppress console.error for this test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => {
                renderHook(() => useAuth());
            }).toThrow('useAuth must be used within an AuthProvider');

            consoleSpy.mockRestore();
        });

        it('returns auth context when used inside AuthProvider', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current).toHaveProperty('user');
            expect(result.current).toHaveProperty('isAuthenticated');
            expect(result.current).toHaveProperty('login');
            expect(result.current).toHaveProperty('logout');
            expect(result.current).toHaveProperty('checkPermission');
        });
    });

    describe('initial state', () => {
        it('starts with loading state', () => {
            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            expect(result.current.isLoading).toBe(true);
        });

        it('fetches providers on mount', async () => {
            renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(mockGet).toHaveBeenCalledWith('/api/v1/auth/providers');
            });
        });

        it('sets authRequired based on providers response', async () => {
            mockGet.mockImplementation((url: string) => {
                if (url === '/api/v1/auth/providers') {
                    return Promise.resolve({
                        data: { providers: [], auth_required: true },
                    });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.authRequired).toBe(true);
        });

        it('loads user from localStorage if stored', async () => {
            const storedUser = {
                id: '1',
                email: 'stored@example.com',
                display_name: 'Stored User',
                avatar_url: null,
                is_active: true,
                roles: [],
            };
            localStorage.setItem('pulsar_console_user', JSON.stringify(storedUser));
            localStorage.setItem('pulsar_console_access_token', 'test-token');
            localStorage.setItem('pulsar_console_token_expiry', (Date.now() + 3600000).toString());

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            // Initial user from localStorage
            expect(result.current.user).toEqual(storedUser);
        });
    });

    describe('login', () => {
        it('calls login API and returns authorization URL', async () => {
            mockPost.mockResolvedValue({
                data: {
                    authorization_url: 'https://auth.example.com/authorize',
                    state: 'random-state',
                },
            });

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const url = await result.current.login('env-1', 'http://localhost/callback');

            expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/login', {
                environment_id: 'env-1',
                redirect_uri: 'http://localhost/callback',
            });
            expect(url).toBe('https://auth.example.com/authorize');
            expect(sessionStorage.getItem('oauth_state')).toBe('random-state');
        });
    });

    describe('handleCallback', () => {
        it('exchanges code for tokens and fetches user', async () => {
            sessionStorage.setItem('oauth_state', 'valid-state');

            mockPost.mockImplementation((url: string) => {
                if (url === '/api/v1/auth/callback') {
                    return Promise.resolve({
                        data: {
                            access_token: 'new-access-token',
                            refresh_token: 'new-refresh-token',
                            token_type: 'Bearer',
                            expires_in: 3600,
                        },
                    });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.handleCallback('auth-code', 'valid-state');
            });

            expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/callback', {
                code: 'auth-code',
                state: 'valid-state',
            });
            expect(localStorage.getItem('pulsar_console_access_token')).toBe('new-access-token');
            expect(localStorage.getItem('pulsar_console_refresh_token')).toBe('new-refresh-token');
        });

        it('throws error on invalid state', async () => {
            sessionStorage.setItem('oauth_state', 'expected-state');

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await expect(
                result.current.handleCallback('auth-code', 'wrong-state')
            ).rejects.toThrow('Invalid OAuth state');
        });
    });

    describe('logout', () => {
        it('clears tokens and user state', async () => {
            localStorage.setItem('pulsar_console_access_token', 'test-token');
            localStorage.setItem('pulsar_console_refresh_token', 'refresh-token');
            localStorage.setItem('pulsar_console_user', JSON.stringify({ id: '1' }));

            mockPost.mockResolvedValue({});

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.logout();
            });

            expect(mockPost).toHaveBeenCalledWith('/api/v1/auth/logout');
            expect(localStorage.getItem('pulsar_console_access_token')).toBeNull();
            expect(localStorage.getItem('pulsar_console_refresh_token')).toBeNull();
            expect(localStorage.getItem('pulsar_console_user')).toBeNull();
            expect(result.current.user).toBeNull();
        });

        it('clears local state even if API call fails', async () => {
            localStorage.setItem('pulsar_console_access_token', 'test-token');
            localStorage.setItem('pulsar_console_user', JSON.stringify({ id: '1' }));

            mockPost.mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await act(async () => {
                await result.current.logout();
            });

            expect(localStorage.getItem('pulsar_console_access_token')).toBeNull();
            expect(result.current.user).toBeNull();
        });
    });

    describe('checkPermission', () => {
        it('returns false when not authenticated', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            const allowed = await result.current.checkPermission('write', 'tenant');
            expect(allowed).toBe(false);
        });

        it('checks permission via API for all users (superuser check on backend)', async () => {
            localStorage.setItem('pulsar_console_access_token', 'test-token');
            localStorage.setItem('pulsar_console_token_expiry', (Date.now() + 3600000).toString());

            mockGet.mockImplementation((url: string) => {
                if (url === '/api/v1/auth/providers') {
                    return Promise.resolve({
                        data: { providers: [], auth_required: true },
                    });
                }
                if (url === '/api/v1/auth/me') {
                    return Promise.resolve({
                        data: {
                            id: '1',
                            email: 'admin@example.com',
                            display_name: 'Admin',
                            avatar_url: null,
                            is_active: true,
                            roles: [{ id: 'role-1', name: 'superuser' }],
                        },
                    });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            mockPost.mockImplementation((url: string) => {
                if (url === '/api/v1/rbac/check') {
                    return Promise.resolve({ data: { allowed: true } });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await waitFor(() => {
                expect(result.current.user?.roles).toHaveLength(1);
            });

            const allowed = await result.current.checkPermission('write', 'tenant');
            expect(allowed).toBe(true);
            // API is always called for permission checks (superuser check happens on backend)
            expect(mockPost).toHaveBeenCalledWith('/api/v1/rbac/check', expect.anything());
        });

        it('calls API for regular users', async () => {
            localStorage.setItem('pulsar_console_access_token', 'test-token');
            localStorage.setItem('pulsar_console_token_expiry', (Date.now() + 3600000).toString());

            mockGet.mockImplementation((url: string) => {
                if (url === '/api/v1/auth/providers') {
                    return Promise.resolve({
                        data: { providers: [], auth_required: true },
                    });
                }
                if (url === '/api/v1/auth/me') {
                    return Promise.resolve({
                        data: {
                            id: '2',
                            email: 'user@example.com',
                            display_name: 'User',
                            avatar_url: null,
                            is_active: true,
                            roles: [{ id: 'role-2', name: 'developer' }],
                        },
                    });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            mockPost.mockImplementation((url: string) => {
                if (url === '/api/v1/rbac/check') {
                    return Promise.resolve({ data: { allowed: true } });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await waitFor(() => {
                expect(result.current.user).not.toBeNull();
            });

            const allowed = await result.current.checkPermission('write', 'tenant', 'public');
            expect(allowed).toBe(true);
            expect(mockPost).toHaveBeenCalledWith('/api/v1/rbac/check', {
                action: 'write',
                resource_level: 'tenant',
                resource_path: 'public',
            });
        });

        it('returns false when API check fails', async () => {
            localStorage.setItem('pulsar_console_access_token', 'test-token');
            localStorage.setItem('pulsar_console_token_expiry', (Date.now() + 3600000).toString());

            mockGet.mockImplementation((url: string) => {
                if (url === '/api/v1/auth/providers') {
                    return Promise.resolve({
                        data: { providers: [], auth_required: true },
                    });
                }
                if (url === '/api/v1/auth/me') {
                    return Promise.resolve({
                        data: {
                            id: '2',
                            email: 'user@example.com',
                            display_name: 'User',
                            avatar_url: null,
                            is_active: true,
                            roles: [],
                        },
                    });
                }
                return Promise.reject(new Error('Unknown URL'));
            });

            mockPost.mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            await waitFor(() => {
                expect(result.current.user).not.toBeNull();
            });

            const allowed = await result.current.checkPermission('write', 'tenant');
            expect(allowed).toBe(false);
        });
    });

    describe('getStoredAccessToken', () => {
        it('returns null when no token stored', () => {
            expect(getStoredAccessToken()).toBeNull();
        });

        it('returns stored token', () => {
            localStorage.setItem('pulsar_console_access_token', 'my-token');
            expect(getStoredAccessToken()).toBe('my-token');
        });
    });

    describe('isAuthenticated', () => {
        it('is false when no user and no token', async () => {
            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            expect(result.current.isAuthenticated).toBe(false);
        });

        it('is false when user exists but no token', async () => {
            localStorage.setItem('pulsar_console_user', JSON.stringify({ id: '1' }));

            const { result } = renderHook(() => useAuth(), { wrapper: TestWrapper });

            await waitFor(() => {
                expect(result.current.isLoading).toBe(false);
            });

            // No access token means not authenticated
            expect(result.current.isAuthenticated).toBe(false);
        });
    });
});
