import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
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

interface AllProvidersProps {
    children: ReactNode;
    queryClient?: QueryClient;
}

function AllProviders({ children, queryClient }: AllProvidersProps) {
    const client = queryClient || createTestQueryClient();

    return (
        <QueryClientProvider client={client}>
            <BrowserRouter>
                {children}
                <Toaster />
            </BrowserRouter>
        </QueryClientProvider>
    );
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
    queryClient?: QueryClient;
    route?: string;
}

function customRender(
    ui: ReactElement,
    { queryClient, route = '/', ...options }: CustomRenderOptions = {}
) {
    window.history.pushState({}, 'Test page', route);

    return render(ui, {
        wrapper: ({ children }) => (
            <AllProviders queryClient={queryClient}>{children}</AllProviders>
        ),
        ...options,
    });
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };
export { createTestQueryClient };
