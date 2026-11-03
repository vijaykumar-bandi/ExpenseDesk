import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { defineComponent, h } from 'vue';

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
  return { api: { get: (...args: unknown[]) => get(...args) }, ApiError };
});

import EmployeeDashboardView from '../EmployeeDashboardView.vue';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../stores/auth';

const Stub = defineComponent({ render: () => h('div') });

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Stub },
      { path: '/dashboard', component: Stub },
      { path: '/reports/new', component: Stub },
      { path: '/reports/:id', component: Stub },
      { path: '/reports/:id/edit', component: Stub },
    ],
  });
}

async function mountView() {
  const router = makeRouter();
  await router.push('/dashboard');
  await router.isReady();
  const wrapper = mount(EmployeeDashboardView, { global: { plugins: [router] } });
  await flushPromises();
  return { wrapper, router };
}

function report(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    title: 'Trip to Pune',
    status: 'draft',
    total_paise: 200075,
    updated_at: '2026-11-01T04:00:00Z',
    ...overrides,
  };
}

describe('EmployeeDashboardView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    get.mockReset();
    useAuthStore().setUser({
      id: 7,
      name: 'Asha Rao',
      email: 'employee@expensedesk.test',
      roles: ['Employee'],
      manager_id: null,
      active: true,
    });
  });

  it('shows the person name and a New report link', async () => {
    get.mockResolvedValue({ data: [] });
    const { wrapper } = await mountView();

    expect(wrapper.find('h1').text()).toBe('Asha Rao');
    const newReport = wrapper.findAll('a').find((a) => a.text() === 'New report');
    expect(newReport?.attributes('href')).toBe('/reports/new');
  });

  it('shows the five status groups in order with count and INR total', async () => {
    get.mockResolvedValue({
      data: [
        report({ id: 1, status: 'draft', total_paise: 10000 }),
        report({ id: 2, status: 'draft', total_paise: 20050 }),
        report({ id: 3, status: 'submitted', total_paise: 50000 }),
        report({ id: 4, status: 'changes_requested', total_paise: 30000 }),
        report({ id: 5, status: 'approved', total_paise: 40000 }),
        report({ id: 6, status: 'paid', total_paise: 60000 }),
      ],
    });
    const { wrapper } = await mountView();

    const cards = wrapper.findAll('.status-card');
    expect(cards.map((c) => c.attributes('data-status'))).toEqual([
      'draft',
      'submitted',
      'changes_requested',
      'approved',
      'paid',
    ]);
    expect(cards.map((c) => c.find('.status-label').text())).toEqual([
      'Draft',
      'Awaiting approval',
      'Changes requested',
      'Approved',
      'Paid',
    ]);
    expect(cards.map((c) => c.find('.status-count').text())).toEqual(['2', '1', '1', '1', '1']);
    expect(cards[0].find('.status-total').text()).toBe('₹300.50');
    expect(cards[1].find('.status-total').text()).toBe('₹500.00');
    expect(cards[4].find('.status-total').text()).toBe('₹600.00');
  });

  it('lists reports newest first with title, total, status and last updated', async () => {
    get.mockResolvedValue({
      data: [
        report({ id: 1, title: 'Older', updated_at: '2026-10-01T04:00:00Z' }),
        report({ id: 2, title: 'Newer', updated_at: '2026-11-02T04:00:00Z', total_paise: 75050 }),
      ],
    });
    const { wrapper } = await mountView();

    const rows = wrapper.findAll('.report-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].find('.report-title').text()).toBe('Newer');
    expect(rows[0].find('.report-total').text()).toBe('₹750.50');
    expect(rows[0].find('.badge').text()).toBe('Draft');
    expect(rows[0].find('.report-updated').text()).toContain('02 Nov 2026');
    expect(rows[1].find('.report-title').text()).toBe('Older');
    expect(wrapper.find('.report-header-title').text()).toBe('Title');
    expect(wrapper.find('.report-header-total').text()).toBe('Total');
    expect(wrapper.find('.report-header-status').text()).toBe('Status');
    expect(wrapper.find('.report-header-updated').text()).toBe('Last updated');
  });

  it('renders the accessible success treatment for a paid report', async () => {
    get.mockResolvedValue({ data: [report({ id: 7, status: 'paid' })] });
    const { wrapper } = await mountView();

    const badge = wrapper.find('.badge-paid');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('Paid');
  });

  it('links a report to its details and a Changes requested report to the editor', async () => {
    get.mockResolvedValue({
      data: [
        report({ id: 11, status: 'submitted', updated_at: '2026-11-02T04:00:00Z' }),
        report({ id: 12, status: 'changes_requested', updated_at: '2026-11-01T04:00:00Z' }),
      ],
    });
    const { wrapper } = await mountView();

    const links = wrapper.findAll('.report-link');
    expect(links[0].attributes('href')).toBe('/reports/11');
    expect(links[1].attributes('href')).toBe('/reports/12/edit');
  });

  it('shows the empty message with a New report button', async () => {
    get.mockResolvedValue({ data: [] });
    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('You have no expense reports yet');
    const newReport = wrapper.findAll('a').find((a) => a.text() === 'New report');
    expect(newReport?.attributes('href')).toBe('/reports/new');
  });

  it('shows a loading state in place of the list', async () => {
    let resolve: (value: unknown) => void = () => {};
    get.mockReturnValue(new Promise((r) => (resolve = r)));
    const router = makeRouter();
    await router.push('/dashboard');
    await router.isReady();
    const wrapper = mount(EmployeeDashboardView, { global: { plugins: [router] } });
    await flushPromises();

    expect(wrapper.find('[role="status"]').exists()).toBe(true);
    expect(wrapper.find('[role="status"]').text()).toBe('Loading reports…');
    expect(wrapper.find('.report-list').exists()).toBe(false);

    resolve({ data: [] });
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('shows the error message with Try again, which reloads', async () => {
    get.mockRejectedValueOnce(new ApiError(500, 'Something went wrong. Try again.'));
    get.mockResolvedValueOnce({ data: [report({ id: 3, title: 'Recovered' })] });
    const { wrapper } = await mountView();

    expect(wrapper.text()).toContain('Reports could not be loaded');
    const retry = wrapper.findAll('button').find((b) => b.text() === 'Try again');
    expect(retry).toBeTruthy();

    await retry!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).not.toContain('Reports could not be loaded');
    expect(wrapper.find('.report-title').text()).toBe('Recovered');
    expect(get).toHaveBeenCalledTimes(2);
  });
});
