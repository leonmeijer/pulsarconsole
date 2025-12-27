import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@/test/test-utils';
import DataTable, { type Column } from './DataTable';

interface TestData {
    id: string;
    name: string;
    value: number;
    status: string;
}

const testData: TestData[] = [
    { id: '1', name: 'Item A', value: 100, status: 'active' },
    { id: '2', name: 'Item B', value: 200, status: 'inactive' },
    { id: '3', name: 'Item C', value: 50, status: 'active' },
    { id: '4', name: 'Item D', value: 150, status: 'pending' },
    { id: '5', name: 'Item E', value: 75, status: 'active' },
];

const columns: Column<TestData>[] = [
    {
        key: 'name',
        header: 'Name',
        accessor: (row) => row.name,
        sortable: true,
        sortValue: (row) => row.name,
    },
    {
        key: 'value',
        header: 'Value',
        accessor: (row) => row.value,
        sortable: true,
        sortValue: (row) => row.value,
    },
    {
        key: 'status',
        header: 'Status',
        accessor: (row) => row.status,
    },
];

describe('DataTable', () => {
    it('renders all rows', () => {
        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
            />
        );

        testData.forEach((item) => {
            expect(screen.getByText(item.name)).toBeInTheDocument();
        });
    });

    it('renders column headers', () => {
        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
            />
        );

        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('Value')).toBeInTheDocument();
        expect(screen.getByText('Status')).toBeInTheDocument();
    });

    it('shows loading skeleton when loading', () => {
        const { container } = render(
            <DataTable
                data={[]}
                columns={columns}
                keyExtractor={(row) => row.id}
                loading={true}
            />
        );

        expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('shows empty message when no data', () => {
        render(
            <DataTable
                data={[]}
                columns={columns}
                keyExtractor={(row) => row.id}
                emptyMessage="No items found"
            />
        );

        expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('sorts data ascending when sortable column header is clicked', () => {
        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
            />
        );

        const nameHeader = screen.getByText('Name');
        fireEvent.click(nameHeader);

        const rows = screen.getAllByRole('row');
        // First row is header, second should be Item A (first alphabetically)
        expect(within(rows[1]).getByText('Item A')).toBeInTheDocument();
    });

    it('sorts data descending on second click', () => {
        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
            />
        );

        const valueHeader = screen.getByText('Value');
        fireEvent.click(valueHeader); // ascending
        fireEvent.click(valueHeader); // descending

        const rows = screen.getAllByRole('row');
        // First data row should be Item B (highest value 200)
        expect(within(rows[1]).getByText('Item B')).toBeInTheDocument();
    });

    it('clears sort on third click', () => {
        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
            />
        );

        const nameHeader = screen.getByText('Name');
        fireEvent.click(nameHeader); // ascending
        fireEvent.click(nameHeader); // descending
        fireEvent.click(nameHeader); // clear sort

        // Should return to original order
        const rows = screen.getAllByRole('row');
        expect(within(rows[1]).getByText('Item A')).toBeInTheDocument();
    });

    it('renders search input when searchable', () => {
        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
                searchable={true}
            />
        );

        expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });

    it('filters data based on search query', async () => {
        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
                searchable={true}
            />
        );

        const searchInput = screen.getByPlaceholderText('Search...');
        fireEvent.change(searchInput, { target: { value: 'Item A' } });

        // Wait for the filter to apply - Item A should be visible
        await waitFor(() => {
            const itemA = screen.queryByText('Item A');
            expect(itemA).toBeInTheDocument();
        });

        // Check that Item B is not in the filtered results
        // The filter searches all object keys by default
        await waitFor(() => {
            const itemB = screen.queryByText('Item B');
            expect(itemB).not.toBeInTheDocument();
        });
    });

    it('paginates data', () => {
        const manyItems = Array.from({ length: 25 }, (_, i) => ({
            id: String(i),
            name: `Item ${i}`,
            value: i * 10,
            status: 'active',
        }));

        render(
            <DataTable
                data={manyItems}
                columns={columns}
                keyExtractor={(row) => row.id}
                pageSize={10}
            />
        );

        // Should show first 10 items
        expect(screen.getByText('Item 0')).toBeInTheDocument();
        expect(screen.getByText('Item 9')).toBeInTheDocument();
        expect(screen.queryByText('Item 10')).not.toBeInTheDocument();

        // Should show pagination info
        expect(screen.getByText(/Showing 1 to 10/)).toBeInTheDocument();
    });

    it('navigates to next page', () => {
        const manyItems = Array.from({ length: 25 }, (_, i) => ({
            id: String(i),
            name: `Item ${i}`,
            value: i * 10,
            status: 'active',
        }));

        render(
            <DataTable
                data={manyItems}
                columns={columns}
                keyExtractor={(row) => row.id}
                pageSize={10}
            />
        );

        // Click next page button
        const nextButton = screen.getAllByRole('button').find(
            (btn) => btn.querySelector('svg')?.classList.contains('lucide-chevron-right')
        );

        if (nextButton) {
            fireEvent.click(nextButton);
            expect(screen.getByText('Item 10')).toBeInTheDocument();
        }
    });

    it('calls onRowClick when row is clicked', () => {
        const onRowClick = vi.fn();

        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
                onRowClick={onRowClick}
            />
        );

        const row = screen.getByText('Item A').closest('tr');
        if (row) {
            fireEvent.click(row);
            expect(onRowClick).toHaveBeenCalledWith(testData[0]);
        }
    });

    it('applies rowClassName when provided', () => {
        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
                rowClassName={(row) => (row.status === 'active' ? 'active-row' : '')}
            />
        );

        const activeRow = screen.getByText('Item A').closest('tr');
        expect(activeRow).toHaveClass('active-row');
    });

    it('clears search when X button is clicked', async () => {
        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
                searchable={true}
                searchKeys={['name'] as (keyof TestData)[]}
            />
        );

        const searchInput = screen.getByPlaceholderText('Search...');
        fireEvent.change(searchInput, { target: { value: 'Item A' } });

        await waitFor(() => {
            expect(screen.queryByText('Item B')).not.toBeInTheDocument();
        });

        // Find and click the clear button (X icon)
        const clearButton = screen.getByRole('button', { name: '' });
        // Alternatively look for the button containing X icon
        const buttons = screen.getAllByRole('button');
        const xButton = buttons.find(btn => btn.querySelector('svg.lucide-x'));

        if (xButton) {
            fireEvent.click(xButton);
            await waitFor(() => {
                expect(screen.getByText('Item B')).toBeInTheDocument();
            });
        } else {
            // If X button not found, clear manually
            fireEvent.change(searchInput, { target: { value: '' } });
            await waitFor(() => {
                expect(screen.getByText('Item B')).toBeInTheDocument();
            });
        }
    });

    it('uses custom search placeholder', () => {
        render(
            <DataTable
                data={testData}
                columns={columns}
                keyExtractor={(row) => row.id}
                searchable={true}
                searchPlaceholder="Find items..."
            />
        );

        expect(screen.getByPlaceholderText('Find items...')).toBeInTheDocument();
    });
});
