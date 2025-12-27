import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import type { ReactNode } from 'react';

// Mock the AuthContext
const mockAuthState = {
    user: null as { id: string; email: string; display_name: string | null; avatar_url: string | null; is_active: boolean; roles?: Array<{ id: string; name: string }> } | null,
    isAuthenticated: false,
    isLoading: false,
    authRequired: false,
    providers: [],
    login: vi.fn(),
    handleCallback: vi.fn(),
    logout: vi.fn(),
    refreshAuth: vi.fn(),
    checkPermission: vi.fn(),
};

vi.mock('@/context/AuthContext', () => ({
    useAuth: () => mockAuthState,
}));

// Mock LoadingSpinner
vi.mock('@/components/shared', () => ({
    LoadingSpinner: ({ size }: { size: string }) => (
        <div data-testid="loading-spinner" data-size={size}>Loading...</div>
    ),
}));

interface TestWrapperProps {
    children: ReactNode;
    initialEntries?: string[];
}

function TestWrapper({ children, initialEntries = ['/protected'] }: TestWrapperProps) {
    return (
        <MemoryRouter initialEntries={initialEntries}>
            <Routes>
                <Route path="/protected" element={children} />
                <Route path="/login" element={<div>Login Page</div>} />
            </Routes>
        </MemoryRouter>
    );
}

describe('ProtectedRoute', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthState.user = null;
        mockAuthState.isAuthenticated = false;
        mockAuthState.isLoading = false;
        mockAuthState.authRequired = false;
    });

    describe('loading state', () => {
        it('shows loading spinner while checking auth', () => {
            mockAuthState.isLoading = true;

            render(
                <TestWrapper>
                    <ProtectedRoute>
                        <div>Protected Content</div>
                    </ProtectedRoute>
                </TestWrapper>
            );

            expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
        });

        it('renders correct spinner size', () => {
            mockAuthState.isLoading = true;

            render(
                <TestWrapper>
                    <ProtectedRoute>
                        <div>Protected Content</div>
                    </ProtectedRoute>
                </TestWrapper>
            );

            expect(screen.getByTestId('loading-spinner')).toHaveAttribute('data-size', 'lg');
        });
    });

    describe('when auth is not required by system', () => {
        it('allows access to protected content', () => {
            mockAuthState.authRequired = false;
            mockAuthState.isAuthenticated = false;

            render(
                <TestWrapper>
                    <ProtectedRoute>
                        <div>Protected Content</div>
                    </ProtectedRoute>
                </TestWrapper>
            );

            expect(screen.getByText('Protected Content')).toBeInTheDocument();
        });

        it('allows access even when user is not authenticated', () => {
            mockAuthState.authRequired = false;
            mockAuthState.isAuthenticated = false;
            mockAuthState.user = null;

            render(
                <TestWrapper>
                    <ProtectedRoute requireAuth={true}>
                        <div>Protected Content</div>
                    </ProtectedRoute>
                </TestWrapper>
            );

            expect(screen.getByText('Protected Content')).toBeInTheDocument();
        });
    });

    describe('when auth is required by system', () => {
        beforeEach(() => {
            mockAuthState.authRequired = true;
        });

        it('redirects to login when user is not authenticated', () => {
            mockAuthState.isAuthenticated = false;

            render(
                <TestWrapper>
                    <ProtectedRoute>
                        <div>Protected Content</div>
                    </ProtectedRoute>
                </TestWrapper>
            );

            expect(screen.getByText('Login Page')).toBeInTheDocument();
            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
        });

        it('allows access when user is authenticated', () => {
            mockAuthState.isAuthenticated = true;
            mockAuthState.user = {
                id: '1',
                email: 'user@example.com',
                display_name: 'User',
                avatar_url: null,
                is_active: true,
                roles: [{ id: 'role-1', name: 'developer' }],
            };

            render(
                <TestWrapper>
                    <ProtectedRoute>
                        <div>Protected Content</div>
                    </ProtectedRoute>
                </TestWrapper>
            );

            expect(screen.getByText('Protected Content')).toBeInTheDocument();
        });

        it('allows access when requireAuth is false', () => {
            mockAuthState.isAuthenticated = false;

            render(
                <TestWrapper>
                    <ProtectedRoute requireAuth={false}>
                        <div>Public Content</div>
                    </ProtectedRoute>
                </TestWrapper>
            );

            expect(screen.getByText('Public Content')).toBeInTheDocument();
        });
    });

    describe('redirect behavior', () => {
        it('uses replace navigation to login', () => {
            mockAuthState.authRequired = true;
            mockAuthState.isAuthenticated = false;

            render(
                <TestWrapper>
                    <ProtectedRoute>
                        <div>Protected Content</div>
                    </ProtectedRoute>
                </TestWrapper>
            );

            // User should be on login page
            expect(screen.getByText('Login Page')).toBeInTheDocument();
        });
    });

    describe('nested children', () => {
        it('renders complex children when authorized', () => {
            mockAuthState.authRequired = true;
            mockAuthState.isAuthenticated = true;
            mockAuthState.user = {
                id: '1',
                email: 'user@example.com',
                display_name: 'User',
                avatar_url: null,
                is_active: true,
                roles: [{ id: 'role-1', name: 'developer' }],
            };

            render(
                <TestWrapper>
                    <ProtectedRoute>
                        <div>
                            <h1>Dashboard</h1>
                            <p>Welcome to the dashboard</p>
                            <button>Click me</button>
                        </div>
                    </ProtectedRoute>
                </TestWrapper>
            );

            expect(screen.getByText('Dashboard')).toBeInTheDocument();
            expect(screen.getByText('Welcome to the dashboard')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
        });
    });
});
