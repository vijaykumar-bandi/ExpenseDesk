import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import DataTable from '../DataTable.vue';

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'total', label: 'Total', sortable: true, align: 'right' as const },
];

describe('DataTable', () => {
  it('renders a row per record', () => {
    const wrapper = mount(DataTable, {
      props: {
        columns,
        rows: [
          { id: 1, name: 'Alpha', total: 100 },
          { id: 2, name: 'Beta', total: 200 },
        ],
      },
    });

    expect(wrapper.findAll('tbody tr')).toHaveLength(2);
    expect(wrapper.text()).toContain('Alpha');
  });

  it('sorts when a sortable header is clicked', async () => {
    const wrapper = mount(DataTable, {
      props: {
        columns,
        rows: [
          { id: 1, name: 'Beta', total: 100 },
          { id: 2, name: 'Alpha', total: 200 },
        ],
      },
    });

    await wrapper.findAll('th button')[0].trigger('click');

    const firstCell = wrapper.findAll('tbody tr')[0].findAll('td')[0];
    expect(firstCell.text()).toBe('Alpha');
  });

  it('shows the empty text when there are no rows', () => {
    const wrapper = mount(DataTable, { props: { columns, rows: [], emptyText: 'Nothing here' } });
    expect(wrapper.text()).toContain('Nothing here');
  });
});
