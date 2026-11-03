import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  replace: vi.fn(),
  toast: vi.fn(),
}));

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
  return { api: { get: mocks.get, post: mocks.post }, ApiError };
});

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock('../../lib/toast', () => ({ toast: mocks.toast }));

import { ApiError } from '../../api/client';
import FinanceDashboardView from '../FinanceDashboardView.vue';

const { get, post, replace, toast } = mocks;

const summary = {
  outstanding_paise: 200075,
  outstanding_count: 1,
  paid_paise: 500000,
  paid_count: 2,
  from: '2026-11-01',
  to: '2026-11-30',
};

const outstanding = [
  {
    id: 7,
    title: 'Client visit',
    status: 'approved',
    total_paise: 200075,
    submitted_at: '2026-10-18T05:00:00Z',
    decided_at: '2026-10-20T05:00:00Z',
    employee: { id: 2, name: 'Priya Sharma' },
    manager: { id: 3, name: 'Ravi Kumar' },
    waiting_days: 4,
  },
];

const payments = [
  {
    id: 11,
    report_id: 4,
    amount_paise: 500000,
    payment_date: '2026-11-02',
    payment_reference: 'NEFT-778',
    employee: { id: 5, name: 'Anil Rao' },
    report_title: 'Team offsite',
    recorded_by: { id: 9, name: 'Finance One' },
    created_at: '2026-11-02T06:00:00Z',
  },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function mockLoad(): void {
  get.mockImplementation((path: string) => {
    if (path.startsWith('/api/finance/summary')) return Promise.resolve(summary);
    if (path.startsWith('/api/finance/outstanding')) return Promise.resolve({ data: outstanding });
    if (path.startsWith('/api/finance/payments')) return Promise.resolve({ data: payments });
    return Promise.reject(new Error(`unexpected ${path}`));
  });
}

function mountView() {
  return mount(FinanceDashboardView, {
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
      },
    },
  });
}

describe('FinanceDashboardView', () => {
  beforeEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
    get.mockReset();
    post.mockReset();
    replace.mockReset();
    toast.mockReset();
  });

  it('shows the approved unpaid total, its count and the paid-period total', async () => {
    mockLoad();
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.get('[data-testid="outstanding-total"]').text()).toBe('₹2,000.75');
    expect(wrapper.get('[data-testid="paid-total"]').text()).toBe('₹5,000.00');
    expect(wrapper.text()).toContain('1 reports');
    expect(wrapper.text()).toContain('2 payments');
  });

  it('selects the current month as the period on open', async () => {
    mockLoad();
    mountView();
    await flushPromises();

    const summaryCall = get.mock.calls.find(([path]) => String(path).startsWith('/api/finance/summary'));
    expect(summaryCall).toBeDefined();
    const url = new URL(String(summaryCall![0]), 'http://localhost');
    const from = url.searchParams.get('from')!;
    const to = url.searchParams.get('to')!;
    expect(from).toMatch(/^\d{4}-\d{2}-01$/);
    expect(from.slice(0, 7)).toBe(to.slice(0, 7));
  });

  it('lists the approved unpaid reports with employee, title, approval date and total', async () => {
    mockLoad();
    const wrapper = mountView();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('Priya Sharma');
    expect(text).toContain('Client visit');
    expect(text).toContain('20 Oct 2026, 10:30');
    expect(text).toContain('₹2,000.75');
  });

  it('opens the Record payment dialog with the full amount filled in and not editable', async () => {
    mockLoad();
    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('.record').trigger('click');

    const dialog = wrapper.get('[role="dialog"]');
    expect(dialog.text()).toContain('Record payment');
    const amount = dialog.get('#payment-amount').element as HTMLInputElement;
    expect(amount.value).toBe('₹2,000.75');
    expect(amount.readOnly).toBe(true);
    expect(dialog.find('#payment-date').exists()).toBe(true);
    expect(dialog.find('#payment-reference').exists()).toBe(true);
  });

  it('moves focus into the dialog, traps Tab, closes with Escape and restores focus', async () => {
    mockLoad();
    const wrapper = mountView();
    document.body.appendChild(wrapper.element);
    await flushPromises();

    const trigger = wrapper.get<HTMLButtonElement>('.record');
    trigger.element.focus();
    await trigger.trigger('click');
    await flushPromises();

    const dialog = wrapper.get('[role="dialog"]');
    const paymentDate = wrapper.get<HTMLInputElement>('#payment-date');
    const confirm = dialog.findAll<HTMLButtonElement>('button').at(-1)!;
    expect(document.activeElement).toBe(paymentDate.element);

    confirm.element.focus();
    await dialog.trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(paymentDate.element);

    await dialog.trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirm.element);

    await dialog.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
  });

  it('posts the payment date and reference and reloads on success', async () => {
    mockLoad();
    post.mockResolvedValue({ data: { id: 12 } });
    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('.record').trigger('click');
    await wrapper.get('#payment-reference').setValue('NEFT-999');
    await wrapper.get('.finance-dialog .btn-primary').trigger('click');
    await flushPromises();

    expect(post).toHaveBeenCalledWith('/api/reports/7/reimbursement', {
      payment_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      payment_reference: 'NEFT-999',
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(toast).toHaveBeenCalled();
  });

  it('shows the already-paid message on a 409', async () => {
    mockLoad();
    post.mockRejectedValue(new ApiError(409, 'This report was already paid'));
    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('.record').trigger('click');
    await wrapper.get('#payment-reference').setValue('NEFT-999');
    await wrapper.get('.finance-dialog .btn-primary').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="dialog"]').text()).toContain('This report was already paid');
  });

  it('shows the future-date message and does not post', async () => {
    mockLoad();
    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('.record').trigger('click');
    await wrapper.get('#payment-date').setValue('2999-01-01');
    await wrapper.get('#payment-reference').setValue('NEFT-999');
    await wrapper.get('.finance-dialog .btn-primary').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="dialog"]').text()).toContain('Payment date cannot be in the future');
    expect(post).not.toHaveBeenCalled();
  });

  it('requires a payment reference of at least 3 characters', async () => {
    mockLoad();
    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('.record').trigger('click');
    await wrapper.get('#payment-reference').setValue('ab');
    await wrapper.get('.finance-dialog .btn-primary').trigger('click');
    await flushPromises();

    expect(wrapper.get('[role="dialog"]').text()).toContain('Payment reference must be at least 3 characters');
    expect(post).not.toHaveBeenCalled();
  });

  it('lists the payment history with date, reference, employee, title and amount', async () => {
    mockLoad();
    const wrapper = mountView();
    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('02 Nov 2026');
    expect(text).toContain('NEFT-778');
    expect(text).toContain('Anil Rao');
    expect(text).toContain('Team offsite');
    expect(text).toContain('₹5,000.00');
  });

  it('sorts dates and INR amounts by their raw values while keeping formatted cells', async () => {
    const secondOutstanding = {
      ...outstanding[0],
      id: 8,
      title: 'January trip',
      total_paise: 900,
      decided_at: '2026-01-15T05:00:00Z',
    };
    const secondPayment = {
      ...payments[0],
      id: 12,
      report_title: 'December trip',
      amount_paise: 900,
      payment_date: '2026-12-02',
    };
    get.mockImplementation((path: string) => {
      if (path.startsWith('/api/finance/summary')) return Promise.resolve(summary);
      if (path.startsWith('/api/finance/outstanding')) return Promise.resolve({ data: [outstanding[0], secondOutstanding] });
      return Promise.resolve({ data: [payments[0], secondPayment] });
    });
    const wrapper = mountView();
    await flushPromises();

    const tables = wrapper.findAll('table');
    await tables[0].findAll('button').find((button) => button.text().includes('Total'))!.trigger('click');
    expect(tables[0].find('tbody tr').text()).toContain('₹9.00');

    await tables[1].findAll('button').find((button) => button.text().includes('Payment date'))!.trigger('click');
    expect(tables[1].find('tbody tr').text()).toContain('02 Nov 2026');
    await tables[1].findAll('button').find((button) => button.text().includes('Amount'))!.trigger('click');
    expect(tables[1].find('tbody tr').text()).toContain('₹9.00');
  });

  it('searches the payment history by sending q to the API', async () => {
    vi.useFakeTimers();
    mockLoad();
    const wrapper = mountView();
    await flushPromises();

    await wrapper.get('#payment-search').setValue('Anil');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();

    const paymentCall = get.mock.calls
      .map(([path]) => String(path))
      .filter((path) => path.startsWith('/api/finance/payments'))
      .pop();
    expect(paymentCall).toContain('q=Anil');
    vi.useRealTimers();
  });

  it('ignores an older search response that resolves after the latest search', async () => {
    mockLoad();
    const wrapper = mountView();
    await flushPromises();
    vi.useFakeTimers();

    const older = deferred<{ data: typeof payments }>();
    const latest = deferred<{ data: typeof payments }>();
    get.mockImplementation((path: string) => {
      if (path.startsWith('/api/finance/summary')) return Promise.resolve(summary);
      if (path.startsWith('/api/finance/outstanding')) return Promise.resolve({ data: outstanding });
      if (path.includes('q=Anil')) return latest.promise;
      if (path.includes('q=An')) return older.promise;
      return Promise.resolve({ data: payments });
    });

    const searchInput = wrapper.get('#payment-search');
    await searchInput.setValue('An');
    await vi.advanceTimersByTimeAsync(300);
    await searchInput.setValue('Anil');
    await vi.advanceTimersByTimeAsync(300);

    latest.resolve({ data: [{ ...payments[0], id: 13, employee: { id: 6, name: 'Anil Latest' } }] });
    await flushPromises();
    expect(wrapper.text()).toContain('Anil Latest');

    older.resolve({ data: [{ ...payments[0], id: 14, employee: { id: 7, name: 'An Older' } }] });
    await flushPromises();
    expect(wrapper.text()).toContain('Anil Latest');
    expect(wrapper.text()).not.toContain('An Older');
    vi.useRealTimers();
  });

  it('shows the loading state while the data loads', async () => {
    get.mockReturnValue(new Promise(() => {}));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Loading');
  });

  it('shows the error state when a request fails', async () => {
    get.mockRejectedValue(new ApiError(500, 'The system is busy. Try again.'));
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toContain('The system is busy. Try again.');
  });

  it('shows the empty state when nothing is unpaid and nothing is paid', async () => {
    get.mockImplementation((path: string) => {
      if (path.startsWith('/api/finance/summary')) {
        return Promise.resolve({ ...summary, outstanding_paise: 0, outstanding_count: 0, paid_paise: 0, paid_count: 0 });
      }
      return Promise.resolve({ data: [] });
    });
    const wrapper = mountView();
    await flushPromises();

    expect(wrapper.text()).toContain('Nothing to pay');
    expect(wrapper.text()).toContain('No payments in this period');
  });
});
