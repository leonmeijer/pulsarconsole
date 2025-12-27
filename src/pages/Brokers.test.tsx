import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import BrokersPage from './Brokers';

describe('BrokersPage', () => {
    it('renders page title', () => {
        render(<BrokersPage />);

        expect(screen.getByText('Brokers')).toBeInTheDocument();
        expect(screen.getByText(/Monitor Pulsar cluster brokers/)).toBeInTheDocument();
    });

    it('displays loading state initially', () => {
        render(<BrokersPage />);

        const skeletons = document.querySelectorAll('.animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('displays brokers after loading', async () => {
        render(<BrokersPage />);

        await waitFor(() => {
            expect(screen.getByText('localhost:8080')).toBeInTheDocument();
        });
    });

    it('shows broker statistics', async () => {
        render(<BrokersPage />);

        await waitFor(() => {
            expect(screen.getByText('localhost:8080')).toBeInTheDocument();
        });

        // Check for topic and bundle counts
        expect(screen.getByText(/15 topics/)).toBeInTheDocument();
        expect(screen.getByText(/4 bundles/)).toBeInTheDocument();
    });

    it('shows CPU usage', async () => {
        render(<BrokersPage />);

        await waitFor(() => {
            expect(screen.getByText('localhost:8080')).toBeInTheDocument();
        });

        // The page shows "CPU" label and percentage value
        expect(screen.getByText('CPU')).toBeInTheDocument();
        expect(screen.getByText('45.5%')).toBeInTheDocument();
    });

    it('shows memory usage', async () => {
        render(<BrokersPage />);

        await waitFor(() => {
            expect(screen.getByText('localhost:8080')).toBeInTheDocument();
        });

        // The page shows "Memory" label and percentage value
        expect(screen.getByText('Memory')).toBeInTheDocument();
        expect(screen.getByText('60.2%')).toBeInTheDocument();
    });

    it('has refresh button', () => {
        render(<BrokersPage />);

        const refreshButton = document.querySelector('svg.lucide-refresh-ccw')?.closest('button');
        expect(refreshButton).toBeInTheDocument();
    });

    it('shows producer and consumer counts', async () => {
        render(<BrokersPage />);

        await waitFor(() => {
            expect(screen.getByText('localhost:8080')).toBeInTheDocument();
        });

        // The page shows producer and consumer counts
        expect(screen.getByText('10 producers')).toBeInTheDocument();
        expect(screen.getByText('20 consumers')).toBeInTheDocument();
    });
});
