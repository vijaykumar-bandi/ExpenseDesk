import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';

const get = vi.fn();

vi.mock('../../api/client', () => {
  class ApiError extends Error {
    status: number;
    errors: Record<string, string[]>;
    constructor(status: number, message: string, errors: Record<string, string[]> = {}) {
      super(message);
      this.name = 'ApiError';
      this.status = status;
      this.errors = errors;
    }
  }
  return {
    ApiError,
    api: { get: (...args: unknown[]) => get(...args) },
  };
});

import ApprovalInboxView from '../ApprovalInboxView.vue';
import { ApiError } from '../../api/client';

interface Summary {
  id: number;
  title: string | null;
  status: string;
  total_paise: number;
  submitted_at: string | null;
  employee: { id: number; name: string } | null;
  waiting_days: number;
}

const reports: Summary[] = [
  {
    id: 11,
    title: 'Client visit in Pune',
    status: 'submitted',
    total_paise: 200075,
    submitted_at: '2026-10-01T04:30:00Z',
    employee: { id: 2, name: 'Asha Rao' },
    waiting_days: 5,
  },
  {
    id: 12,
    title: 'Team lunch',
    status: 'submitted',
    total_paise: 45000,
    submitted_at: '2026-10-20T04:30:00Z',
    employee: { id: 3, name: 'Bilal Khan' },
    waiting_days: 1,
  },
  {
    id: 13,
    title: 'Office chairs',
    status: 'submitted',
    total_paise: 1200000,
    submitted_at: '2026-10-25T04:30:00Z',
    employee: { id: 2, name: 'Asha Rao' },
    waiting_days: 3,
  },
];

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/approvals', name: 'approvals', component: { template: '<div />' } },
      { path: '/reports/:id', name: 'report-details', component: { template: '<div />' } },
    ],
  });
}

async function mountView(): Promise<ReturnType<typeof mount>> {
  const router = makeRouter();
  await router.push('/approvals');
  await router.isReady();

  const wrapper = mount(ApprovalInboxView, {
    global: {
      plugins: [router],
      stubs: { AppShell: { template: '<div><slot /></div>' } },
    },
  });

  await flushPromises();
  return wrapper;
}

function bodyRows(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('table.data-table tbody tr.row');
}

describe('ApprovalInboxView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    get.mockReset();
    get.mockResolvedValue({ data: reports });
  });

  it('lists the submitted reports with Employee, Report, Submitted, Total and Waiting', async () => {
    const wrapper = await mountView();

    expect(get).toHaveBeenCalledWith('/api/reports?scope=inbox');

    const headers = wrapper.findAll('table.data-table thead th').map((th) => th.text());
    expect(headers[0]).toContain('Employee');
    expect(headers[1]).toContain('Report');
    expect(headers[2]).toContain('Submitted');
    expect(headers[3]).toContain('Total');
    expect(headers[4]).toContain('Waiting');

    const rows = bodyRows(wrapper);
    expect(rows).toHaveLength(3);
    expect(rows[0].text()).toContain('Asha Rao');
    expect(rows[0].text()).toContain('Client visit in Pune');
    expect(rows[0].text()).toContain('₹2,000.75');
    expect(rows[0].text()).toContain('5 days');
  });

  it('shows the "Waiting 3+ days" label only for reports that waited more than 3 days', async () => {
    const wrapper = await mountView();

    const rows = bodyRows(wrapper);
    expect(rows[0].text()).toContain('Waiting 3+ days');
    expect(rows[1].text()).not.toContain('Waiting 3+ days');
    expect(rows[2].text()).not.toContain('Waiting 3+ days');
  });

  it('filters by Employee', async () => {
    const wrapper = await mountView();

    await wrapper.find('#filter-employee').setValue('3');

    const rows = bodyRows(wrapper);
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('Bilal Khan');
  });

  it('filters by a submission date range', async () => {
    const wrapper = await mountView();

    await wrapper.find('#filter-from').setValue('2026-10-15');
    await wrapper.find('#filter-to').setValue('2026-10-22');

    const rows = bodyRows(wrapper);
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('Team lunch');
  });

  it('filters submission dates by the Asia/Kolkata calendar date', async () => {
    get.mockResolvedValue({
      data: [{
        ...reports[0],
        submitted_at: '2026-10-14T20:00:00Z',
      }],
    });
    const wrapper = await mountView();

    await wrapper.find('#filter-from').setValue('2026-10-15');
    await wrapper.find('#filter-to').setValue('2026-10-15');

    const rows = bodyRows(wrapper);
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('Client visit in Pune');
  });

  it('filters by an amount range', async () => {
    const wrapper = await mountView();

    await wrapper.find('#filter-amount-min').setValue('1000');
    await wrapper.find('#filter-amount-max').setValue('5000');

    const rows = bodyRows(wrapper);
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('Client visit in Pune');
  });

  it('matches every filter set together', async () => {
    const wrapper = await mountView();

    await wrapper.find('#filter-employee').setValue('2');
    await wrapper.find('#filter-amount-min').setValue('5000');

    const rows = bodyRows(wrapper);
    expect(rows).toHaveLength(1);
    expect(rows[0].text()).toContain('Office chairs');
  });

  it('shows "No reports match these filters" when nothing matches', async () => {
    const wrapper = await mountView();

    await wrapper.find('#filter-employee').setValue('3');
    await wrapper.find('#filter-amount-min').setValue('100000');

    expect(wrapper.text()).toContain('No reports match these filters');
    expect(bodyRows(wrapper)).toHaveLength(0);
  });

  it('opens the report details when a row is clicked', async () => {
    const wrapper = await mountView();
    const router = wrapper.vm.$router as Router;

    await bodyRows(wrapper)[0].trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/reports/11');
  });

  it('sorts the table by each sortable column', async () => {
    const wrapper = await mountView();
    const sortButtons = wrapper.findAll('table.data-table thead button.sort');

    expect(sortButtons).toHaveLength(5);
    await sortButtons[0].trigger('click');
    expect(bodyRows(wrapper)[0].text()).toContain('Asha Rao');
    await sortButtons[0].trigger('click');
    expect(bodyRows(wrapper)[0].text()).toContain('Bilal Khan');
  });

  it('renders named filter controls and phone report cards', async () => {
    const wrapper = await mountView();

    expect(wrapper.find('label[for="filter-employee"]').text()).toBe('Employee');
    expect(wrapper.find('input[aria-label="Submitted from"]').exists()).toBe(true);
    expect(wrapper.find('label[for="filter-amount-min"]').exists()).toBe(true);
    expect(wrapper.findAll('.inbox-cards .inbox-card')).toHaveLength(3);
  });

  it('shows a loading state until the reports arrive', async () => {
    let resolve: (value: { data: Summary[] }) => void = () => {};
    get.mockReturnValue(new Promise((r) => { resolve = r; }));

    const router = makeRouter();
    await router.push('/approvals');
    await router.isReady();

    const wrapper = mount(ApprovalInboxView, {
      global: {
        plugins: [router],
        stubs: { AppShell: { template: '<div><slot /></div>' } },
      },
    });

    expect(wrapper.text()).toContain('Loading the approval inbox…');
    expect(wrapper.find('table.data-table').exists()).toBe(false);

    resolve({ data: reports });
    await flushPromises();

    expect(wrapper.text()).not.toContain('Loading the approval inbox…');
    expect(bodyRows(wrapper)).toHaveLength(3);
  });

  it('explains that the approval inbox failed to load and offers a retry', async () => {
    get.mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Try again.'));

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Approval inbox could not be loaded. Try again.');
    expect(wrapper.text()).not.toContain('Something went wrong.');
    expect(wrapper.find('button').text()).toBe('Try again');

    get.mockResolvedValue({ data: reports });
    await wrapper.find('button').trigger('click');
    await flushPromises();

    expect(bodyRows(wrapper)).toHaveLength(3);
  });

  it('shows an empty state when the inbox has no reports at all', async () => {
    get.mockResolvedValue({ data: [] });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Nothing waiting');
  });
});
