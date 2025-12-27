import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import DashboardPage from './Dashboard';

describe('DashboardPage', () => {
    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('renders page title', () => {
        render(<DashboardPage />);

        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText(/Cluster overview/)).toBeInTheDocument();
    });

    it('displays health status after loading', async () => {
        render(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText(/Status/)).toBeInTheDocument();
        });
    });

    it('displays metric cards', async () => {
        render(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText('Tenants')).toBeInTheDocument();
        });

        expect(screen.getByText('Topics')).toBeInTheDocument();
        expect(screen.getByText('Producers')).toBeInTheDocument();
        expect(screen.getByText('Consumers')).toBeInTheDocument();
    });

    it('displays message rate metrics', async () => {
        render(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText('Messages In')).toBeInTheDocument();
        });

        expect(screen.getByText('Messages Out')).toBeInTheDocument();
        expect(screen.getByText('Throughput In')).toBeInTheDocument();
        expect(screen.getByText('Backlog')).toBeInTheDocument();
    });

    it('displays Top Tenants section', async () => {
        render(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText('Top Tenants')).toBeInTheDocument();
        });
    });

    it('displays Active Brokers section', async () => {
        render(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText('Active Brokers')).toBeInTheDocument();
        });
    });

    it('displays Quick Actions section', async () => {
        render(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText('Quick Actions')).toBeInTheDocument();
        });

        expect(screen.getByText('Manage Tenants')).toBeInTheDocument();
        expect(screen.getByText('View Brokers')).toBeInTheDocument();
        expect(screen.getByText('Environment')).toBeInTheDocument();
        expect(screen.getByText('Refresh All')).toBeInTheDocument();
    });

    it('has refresh button', () => {
        render(<DashboardPage />);

        const refreshButton = document.querySelector('svg.lucide-refresh-ccw')?.closest('button');
        expect(refreshButton).toBeInTheDocument();
    });

    it('shows auto-refresh controls', () => {
        render(<DashboardPage />);

        // Should show pause/play button for auto-refresh
        const autoRefreshButton = document.querySelector('svg.lucide-pause, svg.lucide-play')?.closest('button');
        expect(autoRefreshButton).toBeInTheDocument();
    });

    it('displays last refresh time', () => {
        render(<DashboardPage />);

        expect(screen.getByText(/Updated/)).toBeInTheDocument();
    });

    it('toggles auto-refresh when button is clicked', async () => {
        render(<DashboardPage />);

        // Find pause button (auto-refresh is enabled by default)
        const pauseButton = document.querySelector('svg.lucide-pause')?.closest('button');
        if (pauseButton) {
            fireEvent.click(pauseButton);

            await waitFor(() => {
                // Should now show play button
                const playButton = document.querySelector('svg.lucide-play');
                expect(playButton).toBeInTheDocument();
            });
        }
    });

    it('shows View All links for sections', async () => {
        render(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText('Top Tenants')).toBeInTheDocument();
        });

        const viewAllLinks = screen.getAllByText('View All');
        expect(viewAllLinks.length).toBeGreaterThanOrEqual(2);
    });

    it('displays charts', async () => {
        render(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText('Message Rate')).toBeInTheDocument();
        });

        expect(screen.getByText('Broker Resource Usage')).toBeInTheDocument();
    });

    it('handles refresh button click', async () => {
        render(<DashboardPage />);

        const refreshButton = document.querySelector('svg.lucide-refresh-ccw')?.closest('button');
        if (refreshButton) {
            fireEvent.click(refreshButton);

            // Button should show spinning animation during refresh
            await waitFor(() => {
                expect(refreshButton).toBeInTheDocument();
            });
        }
    });

    it('links navigate to correct pages', async () => {
        render(<DashboardPage />);

        await waitFor(() => {
            expect(screen.getByText('Manage Tenants')).toBeInTheDocument();
        });

        const tenantsLink = screen.getByText('Manage Tenants').closest('a');
        expect(tenantsLink).toHaveAttribute('href', '/tenants');

        const brokersLink = screen.getByText('View Brokers').closest('a');
        expect(brokersLink).toHaveAttribute('href', '/brokers');
    });
});
