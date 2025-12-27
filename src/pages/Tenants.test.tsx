import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import TenantsPage from './Tenants';
import { mockTenants } from '@/test/mocks/handlers';

describe('TenantsPage', () => {
    it('renders page title', async () => {
        render(<TenantsPage />);

        expect(screen.getByText('Tenants')).toBeInTheDocument();
        expect(screen.getByText(/Manage all tenants/)).toBeInTheDocument();
    });

    it('displays loading state initially', () => {
        render(<TenantsPage />);

        // Should show loading skeleton
        const skeletons = document.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('displays tenants after loading', async () => {
        render(<TenantsPage />);

        await waitFor(() => {
            expect(screen.getByText('public')).toBeInTheDocument();
        });

        expect(screen.getByText('sample')).toBeInTheDocument();
    });

    it('shows tenant statistics', async () => {
        render(<TenantsPage />);

        await waitFor(() => {
            expect(screen.getByText('public')).toBeInTheDocument();
        });

        // Check namespace and topic counts are displayed
        expect(screen.getByText(/3 Namespaces/)).toBeInTheDocument();
        expect(screen.getByText(/10 Topics/)).toBeInTheDocument();
    });

    it('shows Create Tenant button', () => {
        render(<TenantsPage />);

        expect(screen.getByText('Create Tenant')).toBeInTheDocument();
    });

    it('opens create form when Create Tenant is clicked', async () => {
        render(<TenantsPage />);

        const createButton = screen.getByText('Create Tenant');
        fireEvent.click(createButton);

        await waitFor(() => {
            expect(screen.getByText('Create New Tenant')).toBeInTheDocument();
        });

        expect(screen.getByPlaceholderText('Tenant name')).toBeInTheDocument();
    });

    it('closes create form when Cancel is clicked', async () => {
        render(<TenantsPage />);

        // Open form
        fireEvent.click(screen.getByText('Create Tenant'));

        await waitFor(() => {
            expect(screen.getByText('Create New Tenant')).toBeInTheDocument();
        });

        // Close form
        fireEvent.click(screen.getByText('Cancel'));

        await waitFor(() => {
            expect(screen.queryByText('Create New Tenant')).not.toBeInTheDocument();
        });
    });

    it('validates empty tenant name', async () => {
        render(<TenantsPage />);

        // Open form
        fireEvent.click(screen.getByText('Create Tenant'));

        await waitFor(() => {
            expect(screen.getByText('Create New Tenant')).toBeInTheDocument();
        });

        // Try to create with empty name
        const createButton = screen.getByRole('button', { name: 'Create' });
        fireEvent.click(createButton);

        // Should show error toast (handled by sonner)
        // The form should still be visible
        expect(screen.getByText('Create New Tenant')).toBeInTheDocument();
    });

    it('creates new tenant successfully', async () => {
        render(<TenantsPage />);

        // Open form
        fireEvent.click(screen.getByText('Create Tenant'));

        await waitFor(() => {
            expect(screen.getByPlaceholderText('Tenant name')).toBeInTheDocument();
        });

        // Enter tenant name
        const input = screen.getByPlaceholderText('Tenant name');
        fireEvent.change(input, { target: { value: 'new-tenant' } });

        // Submit
        const createButton = screen.getByRole('button', { name: 'Create' });
        fireEvent.click(createButton);

        // Form should close after successful creation
        await waitFor(() => {
            expect(screen.queryByText('Create New Tenant')).not.toBeInTheDocument();
        });
    });

    it('has refresh button', async () => {
        render(<TenantsPage />);

        const refreshButton = document.querySelector('button svg.lucide-refresh-ccw')?.closest('button');
        expect(refreshButton).toBeInTheDocument();
    });

    it('shows View Namespaces link for each tenant', async () => {
        render(<TenantsPage />);

        await waitFor(() => {
            expect(screen.getByText('public')).toBeInTheDocument();
        });

        const viewLinks = screen.getAllByText('View Namespaces');
        expect(viewLinks.length).toBe(mockTenants.length);
    });

    it('shows message rates for tenants', async () => {
        render(<TenantsPage />);

        await waitFor(() => {
            expect(screen.getByText('public')).toBeInTheDocument();
        });

        // Check for message rate display
        expect(screen.getAllByText(/Msg In/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/Msg Out/).length).toBeGreaterThan(0);
    });

    it('shows backlog count for tenants', async () => {
        render(<TenantsPage />);

        await waitFor(() => {
            expect(screen.getByText('public')).toBeInTheDocument();
        });

        expect(screen.getByText(/Backlog: 1,000/)).toBeInTheDocument();
    });

    it('handles delete tenant with confirmation', async () => {
        // Mock window.confirm
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

        render(<TenantsPage />);

        await waitFor(() => {
            expect(screen.getByText('public')).toBeInTheDocument();
        });

        // Find delete button (trash icon)
        const deleteButtons = document.querySelectorAll('svg.lucide-trash-2');
        expect(deleteButtons.length).toBeGreaterThan(0);

        // Click delete on first tenant
        const deleteButton = deleteButtons[0].closest('button');
        if (deleteButton) {
            fireEvent.click(deleteButton);
        }

        expect(confirmSpy).toHaveBeenCalled();
        confirmSpy.mockRestore();
    });
});
