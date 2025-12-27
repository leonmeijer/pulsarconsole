import { ReactElement, ReactNode, createContext, useContext } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { Toaster } from 'sonner';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: 0,
                staleTime: 0,
            },
            mutations: {
                retry: false,
            },
        },
    });
}

// =============================================================================
// Mock Auth Context for Testing
// =============================================================================

export interface MockUser {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    is_active: boolean;
    roles?: Array<{ id: string; name: string }>;
}

export interface MockAuthState {
    user: MockUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    authRequired: boolean;
    providers: Array<{ id: string; name: string; issuer_url: string }>;
    login: (environmentId: string, redirectUri: string) => Promise<string>;
    handleCallback: (code: string, state: string) => Promise<void>;
    logout: () => Promise<void>;
    refreshAuth: () => Promise<void>;
    checkPermission: (action: string, resourceLevel: string, resourcePath?: string) => Promise<boolean>;
}

const defaultMockAuth: MockAuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    authRequired: false,
    providers: [],
    login: async () => 'https://example.com/auth',
    handleCallback: async () => {},
    logout: async () => {},
    refreshAuth: async () => {},
    checkPermission: async () => true,
};

const MockAuthContext = createContext<MockAuthState>(defaultMockAuth);

export function MockAuthProvider({
    children,
    value = {}
}: {
    children: ReactNode;
    value?: Partial<MockAuthState>;
}) {
    const authValue = { ...defaultMockAuth, ...value };
    return (
        <MockAuthContext.Provider value={authValue}>
            {children}
        </MockAuthContext.Provider>
    );
}

export function useMockAuth() {
    return useContext(MockAuthContext);
}

// =============================================================================
// Default Providers
// =============================================================================

interface AllProvidersProps {
    children: ReactNode;
    queryClient?: QueryClient;
    authState?: Partial<MockAuthState>;
    initialEntries?: string[];
    useMemoryRouter?: boolean;
}

function AllProviders({
    children,
    queryClient,
    authState,
    initialEntries,
    useMemoryRouter = false,
}: AllProvidersProps) {
    const client = queryClient || createTestQueryClient();

    const RouterComponent = useMemoryRouter
        ? ({ children: routerChildren }: { children: ReactNode }) => (
            <MemoryRouter initialEntries={initialEntries || ['/']}>
                {routerChildren}
            </MemoryRouter>
          )
        : ({ children: routerChildren }: { children: ReactNode }) => (
            <BrowserRouter>
                {routerChildren}
            </BrowserRouter>
          );

    return (
        <QueryClientProvider client={client}>
            <MockAuthProvider value={authState}>
                <RouterComponent>
                    {children}
                    <Toaster />
                </RouterComponent>
            </MockAuthProvider>
        </QueryClientProvider>
    );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    queryClient?: QueryClient;
    route?: string;
    authState?: Partial<MockAuthState>;
    initialEntries?: string[];
    useMemoryRouter?: boolean;
}

function customRender(
    ui: ReactElement,
    { queryClient, route = '/', authState, initialEntries, useMemoryRouter, ...options }: CustomRenderOptions = {}
) {
    if (!useMemoryRouter) {
        window.history.pushState({}, 'Test page', route);
    }

    return render(ui, {
        wrapper: ({ children }) => (
            <AllProviders
                queryClient={queryClient}
                authState={authState}
                initialEntries={initialEntries || [route]}
                useMemoryRouter={useMemoryRouter}
            >
                {children}
            </AllProviders>
        ),
        ...options,
    });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient };
