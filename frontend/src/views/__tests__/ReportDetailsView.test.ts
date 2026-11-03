import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import ReportDetailsView from '../ReportDetailsView.vue';
import ApprovalInboxView from '../ApprovalInboxView.vue';
import { ApiError } from '../../api/client';
import { useAuthStore, type CurrentUser } from '../../stores/auth';

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => apiGet(...args),
      post: (...args: unknown[]) => apiPost(...args),
    },
  };
});

const employee = { id: 10, name: 'Asha Rao' };
const manager = { id: 20, name: 'Priya Menon' };

function report(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 7,
    title: 'Client visit to Pune',
    business_purpose: 'Meet the client about the renewal',
    status: 'submitted',
    total_paise: 200075,
    employee,
    manager,
    lines: [
      {
        id: 1,
        expense_date: '2026-10-20',
        category: { id: 1, name: 'Travel' },
        merchant: 'IndiGo',
        amount_paise: 75050,
        note: 'Flight to Pune',
        receipt: { id: 31, file_name: 'flight.pdf', mime_type: 'application/pdf', size: 1024 },
      },
      {
        id: 2,
        expense_date: '2026-10-21',
        category: { id: 2, name: 'Meals' },
        merchant: 'Cafe Goodluck',
        amount_paise: 125025,
        note: null,
        receipt: null,
      },
    ],
    reimbursement: null,
    audit: [
      {
        id: 2,
        action: 'submitted',
        actor: employee,
        created_at: '2026-10-22T04:30:00Z',
        from_status: 'draft',
        to_status: 'submitted',
        reason: null,
        previous_manager: null,
        new_manager: null,
        amount_paise: null,
        payment_date: null,
        payment_reference: null,
      },
      {
        id: 1,
        action: 'changes_requested',
        actor: manager,
        created_at: '2026-10-21T04:30:00Z',
        from_status: 'submitted',
        to_status: 'changes_requested',
        reason: 'Please attach the hotel bill',
        previous_manager: null,
        new_manager: null,
        amount_paise: null,
        payment_date: null,
        payment_reference: null,
      },
    ],
    ...overrides,
  };
}

function signInAs(user: CurrentUser): void {
  useAuthStore().setUser(user);
}

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div />' } },
      { path: '/reports/:id', name: 'report-details', component: ReportDetailsView },
      { path: '/sign-in', name: 'sign-in', component: { template: '<div />' } },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
      { path: '/approvals', name: 'approvals', component: { template: '<div />' } },
      { path: '/finance', name: 'finance', component: { template: '<div />' } },
      { path: '/admin/users', name: 'admin-users', component: { template: '<div />' } },
      { path: '/admin/categories', name: 'admin-categories', component: { template: '<div />' } },
      { path: '/admin/audit', name: 'admin-audit', component: { template: '<div />' } },
    ],
  });
}

async function mountView(): Promise<ReturnType<typeof mount>> {
  const router = makeRouter();
  await router.push('/reports/7');
  await router.isReady();
  const wrapper = mount(ReportDetailsView, {
    global: { plugins: [router] },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  setActivePinia(createPinia());
  apiGet.mockReset();
  apiPost.mockReset();
  signInAs({
    id: 20,
    name: 'Priya Menon',
    email: 'manager@expensedesk.test',
    roles: ['Manager'],
    manager_id: null,
    active: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('ReportDetailsView', () => {
  it('offers a keyboard-focusable report link in the approval inbox', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/approvals', component: ApprovalInboxView },
        { path: '/reports/:id', component: { template: '<div>Report details</div>' } },
        { path: '/dashboard', component: { template: '<div />' } },
        { path: '/finance', component: { template: '<div />' } },
        { path: '/admin/users', component: { template: '<div />' } },
        { path: '/admin/categories', component: { template: '<div />' } },
        { path: '/admin/audit', component: { template: '<div />' } },
        { path: '/sign-in', component: { template: '<div />' } },
      ],
    });
    apiGet.mockResolvedValueOnce({
      data: [
        {
          id: 7,
          title: 'Client visit to Pune',
          status: 'submitted',
          total_paise: 200075,
          submitted_at: '2026-10-22T04:30:00Z',
          employee,
          waiting_days: 1,
        },
      ],
    });
    await router.push('/approvals');
    await router.isReady();
    const wrapper = mount(ApprovalInboxView, {
      global: { plugins: [router] },
      attachTo: document.body,
    });
    await flushPromises();

    const reportLink = wrapper.find('a[href="/reports/7"]');
    expect(reportLink.exists()).toBe(true);
    (reportLink.element as HTMLElement).focus();
    expect(document.activeElement).toBe(reportLink.element);
    await reportLink.trigger('click');
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/reports/7');
  });

  it('shows the report header, lines and receipts', async () => {
    apiGet.mockResolvedValueOnce({ data: report() });
    const wrapper = await mountView();

    const text = wrapper.text();
    expect(text).toContain('Client visit to Pune');
    expect(text).toContain('Meet the client about the renewal');
    expect(text).toContain('Asha Rao');
    expect(text).toContain('Priya Menon');
    expect(text).toContain('Awaiting approval');
    expect(text).toContain('₹2,000.75');

    // Each line with its date, category, merchant, amount and note.
    expect(text).toContain('Travel');
    expect(text).toContain('IndiGo');
    expect(text).toContain('₹750.50');
    expect(text).toContain('Flight to Pune');
    expect(text).toContain('Meals');
    expect(text).toContain('Cafe Goodluck');
    expect(text).toContain('₹1,250.25');

    // The receipt is a link that opens the file.
    const link = wrapper.find('a[href="/api/receipts/31"]');
    expect(link.exists()).toBe(true);
    expect(link.text()).toBe('flight.pdf');
    expect(link.attributes('target')).toBe('_blank');
  });

  it('shows the activity history newest first with action, actor, Kolkata time and reason', async () => {
    apiGet.mockResolvedValueOnce({ data: report() });
    const wrapper = await mountView();

    const entries = wrapper.findAll('.timeline .entry');
    expect(entries).toHaveLength(2);
    expect(entries[0].text()).toContain('Submitted');
    expect(entries[0].text()).toContain('Asha Rao');
    // 04:30 UTC is 10:00 in Asia/Kolkata.
    expect(entries[0].text()).toContain('10:00');
    expect(entries[1].text()).toContain('Changes requested');
    expect(entries[1].text()).toContain('Priya Menon');
    expect(entries[1].text()).toContain('Please attach the hotel bill');
  });

  it('shows the decision buttons to the report Manager and posts the reason', async () => {
    apiGet.mockResolvedValueOnce({ data: report() });
    const wrapper = await mountView();

    const buttons = wrapper.findAll('.action-buttons button');
    expect(buttons.map((b) => b.text())).toEqual(['Approve', 'Request changes', 'Reject']);

    await buttons[1].trigger('click');
    const dialog = wrapper.find('[role="dialog"]');
    expect(dialog.exists()).toBe(true);
    expect(dialog.text()).toContain('Request changes');

    await dialog.find('textarea').setValue('Please attach the hotel bill');
    apiPost.mockResolvedValueOnce({
      data: report({ status: 'changes_requested' }),
    });
    await dialog.findAll('button').at(-1)!.trigger('click');
    await flushPromises();

    expect(apiPost).toHaveBeenCalledWith('/api/reports/7/decision', {
      decision: 'request_changes',
      reason: 'Please attach the hotel bill',
    });
    expect(wrapper.text()).toContain('Changes requested');
  });

  it('moves focus into the decision dialog, traps Tab, closes on Escape and restores focus', async () => {
    apiGet.mockResolvedValueOnce({ data: report() });
    const wrapper = await mountView();
    const trigger = wrapper.findAll('.action-buttons button')[1];
    (trigger.element as HTMLElement).focus();

    await trigger.trigger('click');
    await flushPromises();
    const dialog = wrapper.find('[role="dialog"]');
    const textarea = dialog.find('textarea');
    expect(document.activeElement).toBe(textarea.element);

    const buttons = dialog.findAll('button');
    (buttons.at(-1)!.element as HTMLElement).focus();
    await buttons.at(-1)!.trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(textarea.element);

    await dialog.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
  });

  it('approves without requiring a reason and hides the decision buttons', async () => {
    apiGet.mockResolvedValueOnce({ data: report() });
    const wrapper = await mountView();

    await wrapper.findAll('.action-buttons button')[0].trigger('click');
    const dialog = wrapper.find('[role="dialog"]');
    expect(dialog.text()).toContain('Approve this report?');
    expect(dialog.find('textarea').exists()).toBe(false);

    apiPost.mockResolvedValueOnce({ data: report({ status: 'approved' }) });
    await dialog.findAll('button').at(-1)!.trigger('click');
    await flushPromises();

    expect(apiPost).toHaveBeenCalledWith('/api/reports/7/decision', {
      decision: 'approve',
    });
    expect(wrapper.text()).toContain('Approved');
    expect(wrapper.find('.action-buttons').exists()).toBe(false);
  });

  it('requires a reason of at least 10 characters before rejecting', async () => {
    apiGet.mockResolvedValueOnce({ data: report() });
    const wrapper = await mountView();

    await wrapper.findAll('.action-buttons button')[2].trigger('click');
    const dialog = wrapper.find('[role="dialog"]');
    await dialog.find('textarea').setValue('too short');
    await dialog.findAll('button').at(-1)!.trigger('click');
    await flushPromises();

    expect(apiPost).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Reason must be at least 10 characters');
  });

  it('hides the decision buttons when the report is not Submitted', async () => {
    apiGet.mockResolvedValueOnce({ data: report({ status: 'approved' }) });
    const wrapper = await mountView();

    expect(wrapper.find('.action-buttons').exists()).toBe(false);
  });

  it('hides the decision buttons for a person who is not the report Manager', async () => {
    signInAs({
      id: 99,
      name: 'Ravi Kumar',
      email: 'other@expensedesk.test',
      roles: ['Manager'],
      manager_id: null,
      active: true,
    });
    apiGet.mockResolvedValueOnce({ data: report() });
    const wrapper = await mountView();

    expect(wrapper.find('.action-buttons').exists()).toBe(false);
  });

  it('reloads the current report and shows the conflict when another Manager decided first', async () => {
    apiGet.mockResolvedValueOnce({ data: report() });
    const wrapper = await mountView();

    await wrapper.findAll('.action-buttons button')[0].trigger('click');
    apiPost.mockRejectedValueOnce(
      new ApiError(409, 'This report was already decided by Ravi Kumar as Approved'),
    );
    apiGet.mockResolvedValueOnce({ data: report({ status: 'approved' }) });
    await wrapper.find('[role="dialog"]').findAll('button').at(-1)!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('This report was already decided by Ravi Kumar as Approved');
    expect(apiGet).toHaveBeenLastCalledWith('/api/reports/7');
    expect(wrapper.find('.action-buttons').exists()).toBe(false);
  });

  it('shows a paid report with its history and no button that changes it', async () => {
    signInAs({
      id: 30,
      name: 'Neha Shah',
      email: 'admin@expensedesk.test',
      roles: ['Administrator'],
      manager_id: null,
      active: true,
    });
    apiGet.mockResolvedValueOnce({
      data: report({
        status: 'paid',
        reimbursement: {
          amount_paise: 200075,
          payment_date: '2026-10-25',
          payment_reference: 'NEFT-7788',
        },
        audit: [
          {
            id: 3,
            action: 'paid',
            actor: { id: 40, name: 'Vikram Iyer' },
            created_at: '2026-10-25T06:00:00Z',
            from_status: 'approved',
            to_status: 'paid',
            reason: null,
            previous_manager: null,
            new_manager: null,
            amount_paise: 200075,
            payment_date: '2026-10-25',
            payment_reference: 'NEFT-7788',
          },
        ],
      }),
    });
    const wrapper = await mountView();

    const text = wrapper.text();
    expect(text).toContain('Paid');
    expect(text).toContain('flight.pdf');
    expect(text).toContain('Vikram Iyer');
    expect(text).toContain('NEFT-7788');
    expect(text).toContain('₹2,000.75');

    expect(wrapper.find('.action-buttons').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('Reassign Manager');
  });

  it('shows the access message and none of the content on a 403', async () => {
    apiGet.mockRejectedValueOnce(
      new ApiError(403, 'You do not have access to this report'),
    );
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('You do not have access to this report');
    expect(wrapper.text()).not.toContain('Client visit to Pune');
    expect(wrapper.find('.timeline').exists()).toBe(false);
  });

  it('lets an Administrator reassign a Submitted report with a reason', async () => {
    signInAs({
      id: 30,
      name: 'Neha Shah',
      email: 'admin@expensedesk.test',
      roles: ['Administrator'],
      manager_id: null,
      active: true,
    });
    apiGet.mockResolvedValueOnce({ data: report() });
    const wrapper = await mountView();

    const reassign = wrapper.find('.reassign');
    expect(reassign.exists()).toBe(true);

    apiGet.mockResolvedValueOnce({
      data: [
        { id: 20, name: 'Priya Menon', roles: ['Manager'], active: true },
        { id: 21, name: 'Sanjay Gupta', roles: ['Manager'], active: true },
      ],
    });
    await reassign.trigger('click');
    await flushPromises();

    const dialog = wrapper.find('[role="dialog"]');
    expect(dialog.exists()).toBe(true);
    await dialog.find('select').setValue('21');
    await dialog.find('textarea').setValue('Priya is on leave this week');
    apiPost.mockResolvedValueOnce({ data: report({ manager: { id: 21, name: 'Sanjay Gupta' } }) });
    apiGet.mockResolvedValueOnce({ data: report({ manager: { id: 21, name: 'Sanjay Gupta' } }) });
    await dialog.findAll('button').at(-1)!.trigger('click');
    await flushPromises();

    expect(apiPost).toHaveBeenCalledWith('/api/admin/reports/7/reassign', {
      manager_id: 21,
      reason: 'Priya is on leave this week',
    });
  });

  it('moves focus into the reassign dialog and restores it after Escape', async () => {
    signInAs({
      id: 30,
      name: 'Neha Shah',
      email: 'admin@expensedesk.test',
      roles: ['Administrator'],
      manager_id: null,
      active: true,
    });
    apiGet.mockResolvedValueOnce({ data: report() });
    const wrapper = await mountView();
    const trigger = wrapper.find('.reassign');
    (trigger.element as HTMLElement).focus();
    apiGet.mockResolvedValueOnce({
      data: [{ id: 21, name: 'Sanjay Gupta', roles: ['Manager'], active: true }],
    });

    await trigger.trigger('click');
    await flushPromises();
    const dialog = wrapper.find('[role="dialog"]');
    expect(document.activeElement).toBe(dialog.find('select').element);

    await dialog.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
  });
});
