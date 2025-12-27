import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
    const defaultProps = {
        open: true,
        onOpenChange: vi.fn(),
        title: 'Confirm Action',
        description: 'Are you sure you want to proceed?',
        onConfirm: vi.fn(),
    };

    it('renders when open is true', () => {
        render(<ConfirmDialog {...defaultProps} />);

        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
        expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('does not render when open is false', () => {
        render(<ConfirmDialog {...defaultProps} open={false} />);

        expect(screen.queryByText('Confirm Action')).not.toBeInTheDocument();
    });

    it('renders default button labels', () => {
        render(<ConfirmDialog {...defaultProps} />);

        expect(screen.getByText('Confirm')).toBeInTheDocument();
        expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders custom button labels', () => {
        render(
            <ConfirmDialog
                {...defaultProps}
                confirmLabel="Delete"
                cancelLabel="Keep"
            />
        );

        expect(screen.getByText('Delete')).toBeInTheDocument();
        expect(screen.getByText('Keep')).toBeInTheDocument();
    });

    it('calls onConfirm when confirm button is clicked', async () => {
        const onConfirm = vi.fn();
        render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

        fireEvent.click(screen.getByText('Confirm'));

        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalledTimes(1);
        });
    });

    it('calls onOpenChange with false when cancel is clicked', () => {
        const onOpenChange = vi.fn();
        render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

        fireEvent.click(screen.getByText('Cancel'));

        expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows loading state when loading is true', () => {
        render(<ConfirmDialog {...defaultProps} loading={true} />);

        expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('disables buttons when loading', () => {
        render(<ConfirmDialog {...defaultProps} loading={true} />);

        expect(screen.getByText('Loading...')).toBeDisabled();
        expect(screen.getByText('Cancel')).toBeDisabled();
    });

    it('renders danger variant with correct styling', () => {
        render(<ConfirmDialog {...defaultProps} variant="danger" />);

        const confirmButton = screen.getByText('Confirm');
        expect(confirmButton).toHaveClass('bg-red-500');
    });

    it('renders warning variant', () => {
        render(<ConfirmDialog {...defaultProps} variant="warning" />);

        // Dialog should render with warning icon
        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('renders success variant', () => {
        render(<ConfirmDialog {...defaultProps} variant="success" />);

        expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('handles async onConfirm', async () => {
        const onConfirm = vi.fn().mockImplementation(
            () => new Promise((resolve) => setTimeout(resolve, 100))
        );

        render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />);

        fireEvent.click(screen.getByText('Confirm'));

        await waitFor(() => {
            expect(onConfirm).toHaveBeenCalled();
        });
    });

    it('closes dialog after successful confirm', async () => {
        const onOpenChange = vi.fn();
        const onConfirm = vi.fn().mockResolvedValue(undefined);

        render(
            <ConfirmDialog
                {...defaultProps}
                onOpenChange={onOpenChange}
                onConfirm={onConfirm}
            />
        );

        fireEvent.click(screen.getByText('Confirm'));

        await waitFor(() => {
            expect(onOpenChange).toHaveBeenCalledWith(false);
        });
    });

    it('closes dialog when X button is clicked', () => {
        const onOpenChange = vi.fn();
        render(<ConfirmDialog {...defaultProps} onOpenChange={onOpenChange} />);

        // Find the close button (X icon)
        const closeButton = document.querySelector('button[class*="hover:bg-white"]');
        if (closeButton) {
            fireEvent.click(closeButton);
            expect(onOpenChange).toHaveBeenCalled();
        }
    });
});
