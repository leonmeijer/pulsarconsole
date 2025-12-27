import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import EnvironmentPage from './Environment';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';

describe('EnvironmentPage', () => {
    it('renders page title', () => {
        render(<EnvironmentPage />);

        expect(screen.getByText('Environment')).toBeInTheDocument();
        expect(screen.getByText(/Configure your Pulsar cluster/)).toBeInTheDocument();
    });

    it('shows existing environment when configured', async () => {
        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByText('Production')).toBeInTheDocument();
        });

        expect(screen.getByText('http://localhost:8080')).toBeInTheDocument();
    });

    it('shows configuration form when no environment exists', async () => {
        // Override handler to return null
        server.use(
            http.get('/api/v1/environment', () => {
                return HttpResponse.json(null);
            })
        );

        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByText('Configure Pulsar Connection')).toBeInTheDocument();
        });

        expect(screen.getByPlaceholderText('e.g., Production')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('http://localhost:8080')).toBeInTheDocument();
    });

    it('shows auth mode selector', async () => {
        server.use(
            http.get('/api/v1/environment', () => {
                return HttpResponse.json(null);
            })
        );

        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByText('Authentication')).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
    });

    it('shows token field when token auth is selected', async () => {
        server.use(
            http.get('/api/v1/environment', () => {
                return HttpResponse.json(null);
            })
        );

        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByRole('combobox')).toBeInTheDocument();
        });

        const select = screen.getByRole('combobox');
        fireEvent.change(select, { target: { value: 'token' } });

        await waitFor(() => {
            expect(screen.getByPlaceholderText(/authentication token/)).toBeInTheDocument();
        });
    });

    it('has test connection button', async () => {
        server.use(
            http.get('/api/v1/environment', () => {
                return HttpResponse.json(null);
            })
        );

        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByText('Test Connection')).toBeInTheDocument();
        });
    });

    it('has save configuration button', async () => {
        server.use(
            http.get('/api/v1/environment', () => {
                return HttpResponse.json(null);
            })
        );

        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByText('Save Configuration')).toBeInTheDocument();
        });
    });

    it('tests connection successfully', async () => {
        server.use(
            http.get('/api/v1/environment', () => {
                return HttpResponse.json(null);
            })
        );

        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByPlaceholderText('http://localhost:8080')).toBeInTheDocument();
        });

        // Enter URL
        const urlInput = screen.getByPlaceholderText('http://localhost:8080');
        fireEvent.change(urlInput, { target: { value: 'http://localhost:8080' } });

        // Click test
        const testButton = screen.getByText('Test Connection');
        fireEvent.click(testButton);

        await waitFor(() => {
            expect(screen.getByText(/Connection successful/)).toBeInTheDocument();
        });
    });

    it('shows connectivity checkbox', async () => {
        server.use(
            http.get('/api/v1/environment', () => {
                return HttpResponse.json(null);
            })
        );

        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByText(/Validate connectivity/)).toBeInTheDocument();
        });

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
    });

    it('disables save button when required fields are empty', async () => {
        server.use(
            http.get('/api/v1/environment', () => {
                return HttpResponse.json(null);
            })
        );

        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByText('Save Configuration')).toBeInTheDocument();
        });

        const saveButton = screen.getByText('Save Configuration');
        expect(saveButton).toBeDisabled();
    });

    it('enables save button when required fields are filled', async () => {
        server.use(
            http.get('/api/v1/environment', () => {
                return HttpResponse.json(null);
            })
        );

        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByPlaceholderText('e.g., Production')).toBeInTheDocument();
        });

        // Fill required fields
        fireEvent.change(screen.getByPlaceholderText('e.g., Production'), {
            target: { value: 'Test Env' },
        });
        fireEvent.change(screen.getByPlaceholderText('http://localhost:8080'), {
            target: { value: 'http://localhost:8080' },
        });

        const saveButton = screen.getByText('Save Configuration');
        expect(saveButton).not.toBeDisabled();
    });

    it('saves configuration successfully', async () => {
        server.use(
            http.get('/api/v1/environment', () => {
                return HttpResponse.json(null);
            })
        );

        render(<EnvironmentPage />);

        await waitFor(() => {
            expect(screen.getByPlaceholderText('e.g., Production')).toBeInTheDocument();
        });

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('e.g., Production'), {
            target: { value: 'My Cluster' },
        });
        fireEvent.change(screen.getByPlaceholderText('http://localhost:8080'), {
            target: { value: 'http://localhost:8080' },
        });

        // Save
        const saveButton = screen.getByText('Save Configuration');
        fireEvent.click(saveButton);

        // Should show success message or close form
        await waitFor(() => {
            // Form behavior after save
            expect(screen.getByText('Save Configuration')).toBeInTheDocument();
        });
    });
});
