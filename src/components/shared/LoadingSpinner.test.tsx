import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/test-utils';
import LoadingSpinner, { LoadingSkeleton, TableSkeleton, CardSkeleton } from './LoadingSpinner';

describe('LoadingSpinner', () => {
    it('renders spinner with default size', () => {
        render(<LoadingSpinner />);

        const spinner = document.querySelector('.animate-spin');
        expect(spinner).toBeInTheDocument();
    });

    it('renders spinner with small size', () => {
        render(<LoadingSpinner size="sm" />);

        const spinner = document.querySelector('.w-4');
        expect(spinner).toBeInTheDocument();
    });

    it('renders spinner with large size', () => {
        render(<LoadingSpinner size="lg" />);

        const spinner = document.querySelector('.w-8');
        expect(spinner).toBeInTheDocument();
    });

    it('renders spinner with xl size', () => {
        render(<LoadingSpinner size="xl" />);

        const spinner = document.querySelector('.w-12');
        expect(spinner).toBeInTheDocument();
    });

    it('renders label when provided', () => {
        render(<LoadingSpinner label="Loading data..." />);

        expect(screen.getByText('Loading data...')).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(<LoadingSpinner className="custom-class" />);

        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('renders fullScreen overlay when fullScreen is true', () => {
        render(<LoadingSpinner fullScreen={true} />);

        const overlay = document.querySelector('.fixed.inset-0');
        expect(overlay).toBeInTheDocument();
    });
});

describe('LoadingSkeleton', () => {
    it('renders skeleton with animate-pulse class', () => {
        const { container } = render(<LoadingSkeleton />);

        expect(container.firstChild).toHaveClass('animate-pulse');
    });

    it('applies custom className', () => {
        const { container } = render(<LoadingSkeleton className="h-10 w-full" />);

        expect(container.firstChild).toHaveClass('h-10');
        expect(container.firstChild).toHaveClass('w-full');
    });
});

describe('TableSkeleton', () => {
    it('renders default 5 rows and 4 columns', () => {
        const { container } = render(<TableSkeleton />);

        const rows = container.querySelectorAll('.flex.gap-4.py-3');
        expect(rows.length).toBe(5);
    });

    it('renders custom number of rows', () => {
        const { container } = render(<TableSkeleton rows={3} />);

        const rows = container.querySelectorAll('.flex.gap-4.py-3');
        expect(rows.length).toBe(3);
    });

    it('renders custom number of columns', () => {
        const { container } = render(<TableSkeleton rows={1} cols={6} />);

        // Header + 1 row, each with 6 columns
        const headerCols = container.querySelectorAll('.flex.gap-4.pb-3 > div');
        expect(headerCols.length).toBe(6);
    });
});

describe('CardSkeleton', () => {
    it('renders default 3 cards', () => {
        const { container } = render(<CardSkeleton />);

        const cards = container.querySelectorAll('.glass.h-48');
        expect(cards.length).toBe(3);
    });

    it('renders custom number of cards', () => {
        const { container } = render(<CardSkeleton count={5} />);

        const cards = container.querySelectorAll('.glass.h-48');
        expect(cards.length).toBe(5);
    });

    it('has grid layout', () => {
        const { container } = render(<CardSkeleton />);

        expect(container.firstChild).toHaveClass('grid');
    });
});
