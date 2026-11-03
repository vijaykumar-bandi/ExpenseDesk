import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { ApiError } from '../../api/client';
import { useAuthStore, type Role } from '../../stores/auth';
import AdminAuditView from '../AdminAuditView.vue';

const get = vi.fn();

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    api: { get: (...args: unknown[]) => get(...args) },
  };
});

function event(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    report_id: 7,
    action: 'submitted',
    actor: { id: 1, name: 'Asha Rao' },
    created_at: '2026-11-03T04:46:50Z',
    from_status: 'draft',
    to_status: 'submitted',
    reason: null,
    previous_manager: null,
    new_manager: null,
    amount_paise: null,
    payment_date: null,
    payment_reference: null,
    ...overrides,
  };
}

function page(events: unknown[], meta: Record<string, number> = {}) {
  return {
    data: events,
    meta: { current_page: 1, last_page: 1, total: events.length, ...meta },
  };
}

async function mountView(roles: Role[] = ['Administrator']) {
  const pinia = createPinia();
  setActivePinia(pinia);
  useAuthStore().setUser({
    id: 1,
    name: 'Admin',
    email: 'admin@expensedesk.test',
    roles,
    manager_id: null,
    active: true,
  });

  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/dashboard', component: { template: '<div />' } },
      { path: '/admin/users', component: { template: '<div />' } },
      { path: '/admin/categories', component: { template: '<div />' } },
      { path: '/admin/audit', component: { template: '<div />' } },
      { path: '/reports/:id', component: { template: '<div />' } },
    ],
  });
  await router.push('/');
  await router.isReady();

  const wrapper = mount(AdminAuditView, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return wrapper;
}

describe('AdminAuditView', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('lists every event with actor, Asia/Kolkata time, report and state change', async () => {
    get.mockResolvedValue(page([event(2), event(1, { from_status: 'submitted', to_status: 'approved' })]));

    const wrapper = await mountView();

    expect(get).toHaveBeenCalledWith('/api/admin/audit?page=1');

    const rows = wrapper.findAll('tbody tr');
    expect(rows).toHaveLength(2);

    const first = rows[0].text();
    expect(first).toContain('Asha Rao');
    // 04:46:50 UTC is 10:16 in Asia/Kolkata.
    expect(first).toContain('03 Nov 2026, 10:16');
    expect(first).toContain('#7');
    expect(first).toContain('draft → submitted');

    expect(rows[1].text()).toContain('submitted → approved');
  });

  it('shows the reassignment detail when there is no status change', async () => {
    get.mockResolvedValue(
      page([
        event(3, {
          action: 'reassigned',
          from_status: null,
          to_status: null,
          previous_manager: { id: 2, name: 'Priya' },
          new_manager: { id: 3, name: 'Ravi' },
        }),
      ]),
    );

    const wrapper = await mountView();

    expect(wrapper.find('tbody tr').text()).toContain('Manager: Priya → Ravi');
  });

  it('offers no control that edits or deletes an event', async () => {
    get.mockResolvedValue(page([event(1)]));

    const wrapper = await mountView();

    const labels = wrapper.findAll('button').map((button) => button.text());
    expect(labels).not.toContain('Edit');
    expect(labels).not.toContain('Delete');
    // No row offers an edit or delete action; rows only link to the report.
    expect(wrapper.findAll('tbody tr button')).toHaveLength(0);
    expect(wrapper.findAll('tbody tr a')).toHaveLength(1);
  });

  it('pages 50 events at a time', async () => {
    get.mockResolvedValue(page([event(1)], { current_page: 1, last_page: 3, total: 120 }));

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Page 1 of 3 · 120 events');

    const next = wrapper.findAll('button').find((button) => button.text() === 'Next');
    expect(next).toBeDefined();
    await next!.trigger('click');
    await flushPromises();

    expect(get).toHaveBeenLastCalledWith('/api/admin/audit?page=2');
  });

  it('retries the page that failed to load', async () => {
    get
      .mockResolvedValueOnce(page([event(1)], { current_page: 1, last_page: 3, total: 120 }))
      .mockRejectedValueOnce(new ApiError(500, 'Audit history could not be loaded. Try again.'))
      .mockResolvedValueOnce(page([event(2)], { current_page: 2, last_page: 3, total: 120 }));

    const wrapper = await mountView();

    const next = wrapper.findAll('button').find((button) => button.text() === 'Next');
    await next!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('Audit history could not be loaded. Try again.');

    const retry = wrapper.findAll('button').find((button) => button.text() === 'Try again');
    await retry!.trigger('click');
    await flushPromises();

    expect(get).toHaveBeenNthCalledWith(2, '/api/admin/audit?page=2');
    expect(get).toHaveBeenNthCalledWith(3, '/api/admin/audit?page=2');
    expect(wrapper.text()).toContain('Page 2 of 3 · 120 events');
  });

  it('sorts Time by the timestamp rather than its formatted display text', async () => {
    get.mockResolvedValue(
      page([
        event(1, { report_id: 101, created_at: '2026-10-31T18:30:00Z' }),
        event(2, { report_id: 102, created_at: '2026-11-01T18:30:00Z' }),
      ]),
    );

    const wrapper = await mountView();

    const timeHeader = wrapper.findAll('th button').find((button) => button.text().includes('Time'));
    await timeHeader!.trigger('click');

    const reportLinks = wrapper.findAll('tbody tr a').map((link) => link.text());
    expect(reportLinks).toEqual(['#101', '#102']);
    expect(wrapper.findAll('tbody tr')[0].text()).toContain('01 Nov 2026, 00:00');
    expect(wrapper.findAll('tbody tr')[1].text()).toContain('02 Nov 2026, 00:00');
  });

  it('shows the access message to a person without the Administrator role', async () => {
    const wrapper = await mountView(['Employee']);

    expect(wrapper.text()).toContain('You do not have access to this page');
    expect(get).not.toHaveBeenCalled();
  });

  it('lets the real route render the access message for a signed-in non-administrator', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    useAuthStore().setUser({
      id: 2,
      name: 'Employee',
      email: 'employee@expensedesk.test',
      roles: ['Employee'],
      manager_id: 3,
      active: true,
    });
    const { default: router } = await import('../../router');

    await router.push('/admin/audit');
    await router.isReady();

    expect(router.currentRoute.value.name).toBe('admin-audit');
    expect(router.currentRoute.value.meta.showAccessDenied).toBe(true);
  });

  it('shows the access message when the API answers 403', async () => {
    get.mockRejectedValue(new ApiError(403, 'You do not have access to this page'));

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('You do not have access to this page');
  });

  it('shows a loading state until the data arrives', async () => {
    let resolve: (value: unknown) => void = () => {};
    get.mockReturnValue(new Promise((r) => { resolve = r; }));

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Loading');

    resolve(page([event(1)]));
    await flushPromises();

    expect(wrapper.text()).not.toContain('Loading');
    expect(wrapper.findAll('tbody tr')).toHaveLength(1);
  });

  it('shows an empty state when there are no events', async () => {
    get.mockResolvedValue(page([]));

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('No audit events yet');
  });

  it('shows an error message with a retry action when the request fails', async () => {
    get.mockRejectedValue(new ApiError(500, 'The system is busy. Try again.'));

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('The system is busy. Try again.');
    expect(wrapper.text()).toContain('Try again');
  });
});
