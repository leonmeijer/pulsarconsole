import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import TokensPage from './TokensPage';
import { mockApiTokens } from '@/test/mocks/handlers';

describe('TokensPage', () => {
    it('renders page title', async () => {
        render(<TokensPage />);

        expect(screen.getByText('API Tokens')).toBeInTheDocument();
    });

    it('displays tokens list after loading', async () => {
        render(<TokensPage />);

        await waitFor(() => {
            expect(screen.getByText(mockApiTokens[0].name)).toBeInTheDocument();
        });

        expect(screen.getByText(mockApiTokens[1].name)).toBeInTheDocument();
    });

    it('has Generate Pulsar Token button', async () => {
        render(<TokensPage />);

        await waitFor(() => {
            expect(screen.getByRole('button', { name: /Generate Pulsar Token/i })).toBeInTheDocument();
        });
    });

    it('has revoke buttons for tokens', async () => {
        render(<TokensPage />);

        await waitFor(() => {
            expect(screen.getByText(mockApiTokens[0].name)).toBeInTheDocument();
        });

        // Find trash/revoke icons
        const trashIcons = document.querySelectorAll('svg.lucide-trash-2');
        expect(trashIcons.length).toBeGreaterThan(0);
    });

    it('displays expiration info for tokens with expiry', async () => {
        render(<TokensPage />);

        await waitFor(() => {
            expect(screen.getByText(mockApiTokens[0].name)).toBeInTheDocument();
        });

        // Expiration info should be displayed
        const expiresText = screen.getAllByText(/Expires/);
        expect(expiresText.length).toBeGreaterThan(0);
    });
});
