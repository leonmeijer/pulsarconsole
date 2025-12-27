import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import ErrorBoundary, { ErrorMessage } from './ErrorBoundary';

// Component that throws an error
function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
    if (shouldThrow) {
        throw new Error('Test error message');
    }
    return <div>No error</div>;
}

describe('ErrorBoundary', () => {
    beforeEach(() => {
        // Suppress console.error for expected errors
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    it('renders children when no error occurs', () => {
        render(
            <ErrorBoundary>
                <div>Child content</div>
            </ErrorBoundary>
        );

        expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('renders error UI when child throws', () => {
        render(
            <ErrorBoundary>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
        render(
            <ErrorBoundary fallback={<div>Custom error fallback</div>}>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
    });

    it('calls onReset when Try Again is clicked', () => {
        const onReset = vi.fn();

        render(
            <ErrorBoundary onReset={onReset}>
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        fireEvent.click(screen.getByText('Try Again'));
        expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('recovers from error state when reset', async () => {
        // Use a key to force remount
        const { rerender } = render(
            <ErrorBoundary key="error">
                <ThrowError shouldThrow={true} />
            </ErrorBoundary>
        );

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();

        // Click try again
        fireEvent.click(screen.getByText('Try Again'));

        // Rerender with a new key to ensure fresh mount and no error
        rerender(
            <ErrorBoundary key="no-error">
                <ThrowError shouldThrow={false} />
            </ErrorBoundary>
        );

        await waitFor(() => {
            expect(screen.getByText('No error')).toBeInTheDocument();
        });
    });
});

describe('ErrorMessage', () => {
    it('renders title and message', () => {
        render(<ErrorMessage title="Error Title" message="Error description" />);

        expect(screen.getByText('Error Title')).toBeInTheDocument();
        expect(screen.getByText('Error description')).toBeInTheDocument();
    });

    it('renders default title when not provided', () => {
        render(<ErrorMessage message="Error description" />);

        expect(screen.getByText('Error')).toBeInTheDocument();
    });

    it('renders Retry button when onRetry is provided', () => {
        const onRetry = vi.fn();
        render(<ErrorMessage message="Error" onRetry={onRetry} />);

        const retryButton = screen.getByText('Retry');
        expect(retryButton).toBeInTheDocument();

        fireEvent.click(retryButton);
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('does not render Retry button when onRetry is not provided', () => {
        render(<ErrorMessage message="Error" />);

        expect(screen.queryByText('Retry')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(
            <ErrorMessage message="Error" className="custom-class" />
        );

        expect(container.firstChild).toHaveClass('custom-class');
    });
});
