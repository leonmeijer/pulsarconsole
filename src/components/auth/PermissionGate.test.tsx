import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import PermissionGate, { usePermission, withPermission } from './PermissionGate';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

// Mock the AuthContext
const mockCheckPermission = vi.fn();
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
    checkPermission: mockCheckPermission,
};

vi.mock('@/context/AuthContext', () => ({
    useAuth: () => mockAuthState,
}));

function TestWrapper({ children }: { children: ReactNode }) {
    return <BrowserRouter>{children}</BrowserRouter>;
}

describe('PermissionGate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthState.user = null;
        mockAuthState.isAuthenticated = false;
        mockAuthState.authRequired = false;
        mockCheckPermission.mockResolvedValue(true);
    });

    describe('when auth is not required', () => {
        it('renders children immediately', async () => {
            mockAuthState.authRequired = false;

            render(
                <PermissionGate action="write" resourceLevel="tenant">
                    <div>Protected Content</div>
                </PermissionGate>,
                { wrapper: TestWrapper }
            );

            await waitFor(() => {
                expect(screen.getByText('Protected Content')).toBeInTheDocument();
            });
        });

        it('does not call checkPermission', async () => {
            mockAuthState.authRequired = false;

            render(
                <PermissionGate action="write" resourceLevel="tenant">
                    <div>Protected Content</div>
                </PermissionGate>,
                { wrapper: TestWrapper }
            );

            await waitFor(() => {
                expect(screen.getByText('Protected Content')).toBeInTheDocument();
            });

            expect(mockCheckPermission).not.toHaveBeenCalled();
        });
    });

    describe('when auth is required', () => {
        beforeEach(() => {
            mockAuthState.authRequired = true;
        });

        it('renders nothing when user is not authenticated', async () => {
            mockAuthState.isAuthenticated = false;

            const { container } = render(
                <PermissionGate action="write" resourceLevel="tenant">
                    <div>Protected Content</div>
                </PermissionGate>,
                { wrapper: TestWrapper }
            );

            await waitFor(() => {
                expect(container).toBeEmptyDOMElement();
            });
        });

        it('renders children when user has permission (superuser check on backend)', async () => {
            mockAuthState.isAuthenticated = true;
            mockAuthState.user = {
                id: '1',
                email: 'admin@example.com',
                display_name: 'Admin',
                avatar_url: null,
                is_active: true,
                roles: [{ id: 'role-1', name: 'superuser' }],
            };
            mockCheckPermission.mockResolvedValue(true);

            render(
                <PermissionGate action="write" resourceLevel="tenant">
                    <div>Protected Content</div>
                </PermissionGate>,
                { wrapper: TestWrapper }
            );

            await waitFor(() => {
                expect(screen.getByText('Protected Content')).toBeInTheDocument();
            });

            // API is always called for permission checks (superuser check happens on backend)
            expect(mockCheckPermission).toHaveBeenCalled();
        });

        it('checks permission via API for regular users', async () => {
            mockAuthState.isAuthenticated = true;
            mockAuthState.user = {
                id: '2',
                email: 'user@example.com',
                display_name: 'User',
                avatar_url: null,
                is_active: true,
                roles: [{ id: 'role-2', name: 'developer' }],
            };
            mockCheckPermission.mockResolvedValue(true);

            render(
                <PermissionGate action="write" resourceLevel="tenant" resourcePath="public">
                    <div>Protected Content</div>
                </PermissionGate>,
                { wrapper: TestWrapper }
            );

            await waitFor(() => {
                expect(mockCheckPermission).toHaveBeenCalledWith('write', 'tenant', 'public');
            });

            expect(screen.getByText('Protected Content')).toBeInTheDocument();
        });

        it('renders nothing when permission is denied', async () => {
            mockAuthState.isAuthenticated = true;
            mockAuthState.user = {
                id: '2',
                email: 'user@example.com',
                display_name: 'User',
                avatar_url: null,
                is_active: true,
                roles: [],
            };
            mockCheckPermission.mockResolvedValue(false);

            const { container } = render(
                <PermissionGate action="write" resourceLevel="tenant">
                    <div>Protected Content</div>
                </PermissionGate>,
                { wrapper: TestWrapper }
            );

            await waitFor(() => {
                expect(mockCheckPermission).toHaveBeenCalled();
            });

            // Wait for the permission state to update
            await waitFor(() => {
                expect(container.textContent).toBe('');
            });
        });

        it('renders fallback when permission is denied and fallback is provided', async () => {
            mockAuthState.isAuthenticated = true;
            mockAuthState.user = {
                id: '2',
                email: 'user@example.com',
                display_name: 'User',
                avatar_url: null,
                is_active: true,
                roles: [],
            };
            mockCheckPermission.mockResolvedValue(false);

            render(
                <PermissionGate
                    action="write"
                    resourceLevel="tenant"
                    fallback={<div>No Access</div>}
                >
                    <div>Protected Content</div>
                </PermissionGate>,
                { wrapper: TestWrapper }
            );

            await waitFor(() => {
                expect(screen.getByText('No Access')).toBeInTheDocument();
            });

            expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
        });

        it('shows access denied message when showDenied is true', async () => {
            mockAuthState.isAuthenticated = true;
            mockAuthState.user = {
                id: '2',
                email: 'user@example.com',
                display_name: 'User',
                avatar_url: null,
                is_active: true,
                roles: [],
            };
            mockCheckPermission.mockResolvedValue(false);

            render(
                <PermissionGate action="write" resourceLevel="tenant" showDenied>
                    <div>Protected Content</div>
                </PermissionGate>,
                { wrapper: TestWrapper }
            );

            await waitFor(() => {
                expect(screen.getByText('Access Denied')).toBeInTheDocument();
            });

            expect(screen.getByText(/don't have permission/)).toBeInTheDocument();
        });
    });
});

describe('usePermission hook', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthState.user = null;
        mockAuthState.isAuthenticated = false;
        mockAuthState.authRequired = false;
        mockCheckPermission.mockResolvedValue(true);
    });

    it('returns hasPermission true when auth not required', async () => {
        mockAuthState.authRequired = false;

        const { result } = renderHook(
            () => usePermission('write', 'tenant'),
            { wrapper: TestWrapper }
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.hasPermission).toBe(true);
    });

    it('returns hasPermission false when not authenticated', async () => {
        mockAuthState.authRequired = true;
        mockAuthState.isAuthenticated = false;

        const { result } = renderHook(
            () => usePermission('write', 'tenant'),
            { wrapper: TestWrapper }
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.hasPermission).toBe(false);
    });

    it('checks permission via API for all users (superuser check on backend)', async () => {
        mockAuthState.authRequired = true;
        mockAuthState.isAuthenticated = true;
        mockAuthState.user = {
            id: '1',
            email: 'admin@example.com',
            display_name: 'Admin',
            avatar_url: null,
            is_active: true,
            roles: [{ id: 'role-1', name: 'superuser' }],
        };
        mockCheckPermission.mockResolvedValue(true);

        const { result } = renderHook(
            () => usePermission('write', 'tenant'),
            { wrapper: TestWrapper }
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.hasPermission).toBe(true);
        expect(mockCheckPermission).toHaveBeenCalled();
    });

    it('calls checkPermission for regular users', async () => {
        mockAuthState.authRequired = true;
        mockAuthState.isAuthenticated = true;
        mockAuthState.user = {
            id: '2',
            email: 'user@example.com',
            display_name: 'User',
            avatar_url: null,
            is_active: true,
            roles: [{ id: 'role-2', name: 'developer' }],
        };
        mockCheckPermission.mockResolvedValue(true);

        const { result } = renderHook(
            () => usePermission('write', 'tenant', 'public'),
            { wrapper: TestWrapper }
        );

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockCheckPermission).toHaveBeenCalledWith('write', 'tenant', 'public');
        expect(result.current.hasPermission).toBe(true);
    });
});

describe('withPermission HOC', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthState.authRequired = false;
    });

    it('wraps component with PermissionGate', async () => {
        const TestComponent = ({ message }: { message: string }) => (
            <div>{message}</div>
        );

        const WrappedComponent = withPermission(TestComponent, 'write', 'tenant');

        render(<WrappedComponent message="Hello World" />, { wrapper: TestWrapper });

        await waitFor(() => {
            expect(screen.getByText('Hello World')).toBeInTheDocument();
        });
    });
});
