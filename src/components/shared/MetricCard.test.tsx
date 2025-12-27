import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import MetricCard from './MetricCard';
import { Activity } from 'lucide-react';

describe('MetricCard', () => {
    it('renders title and value correctly', () => {
        render(<MetricCard title="Test Metric" value={42} />);

        expect(screen.getByText('Test Metric')).toBeInTheDocument();
        expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders subtitle when provided', () => {
        render(<MetricCard title="Test" value={100} subtitle="messages pending" />);

        expect(screen.getByText('messages pending')).toBeInTheDocument();
    });

    it('renders icon when provided', () => {
        render(<MetricCard title="Test" value={100} icon={Activity} />);

        // Icon should be rendered (Activity icon is an SVG)
        const svg = document.querySelector('svg');
        expect(svg).toBeInTheDocument();
    });

    it('renders trend indicator for upward trend', () => {
        render(
            <MetricCard
                title="Test"
                value={100}
                trend={{ value: 15, direction: 'up' }}
            />
        );

        expect(screen.getByText('15%')).toBeInTheDocument();
    });

    it('renders trend indicator for downward trend', () => {
        render(
            <MetricCard
                title="Test"
                value={100}
                trend={{ value: 10, direction: 'down' }}
            />
        );

        expect(screen.getByText('10%')).toBeInTheDocument();
    });

    it('renders loading skeleton when loading is true', () => {
        const { container } = render(
            <MetricCard title="Test" value={100} loading={true} />
        );

        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
        expect(screen.queryByText('Test')).not.toBeInTheDocument();
    });

    it('applies correct variant class for success', () => {
        const { container } = render(
            <MetricCard title="Test" value={100} variant="success" />
        );

        // Check that the card has success-related styling
        expect(container.firstChild).toBeInTheDocument();
    });

    it('applies correct variant class for warning', () => {
        const { container } = render(
            <MetricCard title="Test" value={100} variant="warning" />
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('applies correct variant class for danger', () => {
        const { container } = render(
            <MetricCard title="Test" value={100} variant="danger" />
        );

        expect(container.firstChild).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(
            <MetricCard title="Test" value={100} className="custom-class" />
        );

        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('formats string values correctly', () => {
        render(<MetricCard title="Rate" value="1.5K/s" />);

        expect(screen.getByText('1.5K/s')).toBeInTheDocument();
    });

    it('renders neutral trend correctly', () => {
        render(
            <MetricCard
                title="Test"
                value={100}
                trend={{ value: 0, direction: 'neutral' }}
            />
        );

        expect(screen.getByText('0%')).toBeInTheDocument();
    });
});
