import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  upload: vi.fn(),
}));

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return { ...actual, api: apiMock };
});

import ReportEditorView from '../ReportEditorView.vue';
import { ApiError } from '../../api/client';

const CATEGORIES = [
  { id: 1, name: 'Travel' },
  { id: 2, name: 'Meals' },
  { id: 3, name: 'Accommodation' },
  { id: 4, name: 'Office Supplies' },
  { id: 5, name: 'Other' },
];

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reports/new', name: 'report-new', component: ReportEditorView },
      { path: '/reports/:id/edit', name: 'report-edit', component: ReportEditorView },
      { path: '/reports/:id', name: 'report-details', component: { template: '<div />' } },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
    ],
  });
}

async function mountEditor(path = '/reports/new'): Promise<{ wrapper: ReturnType<typeof mount>; router: Router }> {
  const router = makeRouter();
  await router.push(path);
  await router.isReady();

  const wrapper = mount(ReportEditorView, {
    global: { plugins: [router] },
  });

  await flushPromises();
  return { wrapper, router };
}

function lineCards(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('.line-card');
}

async function addLine(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.find('.add-line').trigger('click');
}

async function fillLine(
  wrapper: ReturnType<typeof mount>,
  index: number,
  values: { date?: string; category?: string; merchant?: string; amount?: string; note?: string },
): Promise<void> {
  const card = lineCards(wrapper)[index];
  if (values.date !== undefined) await card.find('input[type="date"]').setValue(values.date);
  if (values.category !== undefined) await card.find('select').setValue(values.category);
  if (values.merchant !== undefined) await card.find('input[type="text"]').setValue(values.merchant);
  if (values.amount !== undefined) await card.find('input[inputmode="decimal"]').setValue(values.amount);
  if (values.note !== undefined) await card.find('textarea').setValue(values.note);
}

function todayIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function tomorrowIso(): string {
  const date = new Date(`${todayIso()}T00:00:00+05:30`);
  date.setDate(date.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

beforeEach(() => {
  setActivePinia(createPinia());
  vi.clearAllMocks();
  sessionStorage.clear();
  apiMock.get.mockImplementation((path: string) => {
    if (path === '/api/categories') return Promise.resolve({ data: CATEGORIES });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
});

describe('ReportEditorView', () => {
  it('shows the title, business purpose and running total of an empty draft', async () => {
    const { wrapper } = await mountEditor();

    expect(wrapper.find('#report-title').exists()).toBe(true);
    expect(wrapper.find('#report-purpose').exists()).toBe(true);
    expect(wrapper.find('.total-value').text()).toBe('₹0.00');
    expect(wrapper.text()).toContain('Add line');
    expect(wrapper.text()).toContain('Save draft');
    expect(wrapper.text()).toContain('Submit');
  });

  it('adds a line with every field and the five categories', async () => {
    const { wrapper } = await mountEditor();
    await addLine(wrapper);

    const card = lineCards(wrapper)[0];
    expect(card.find('input[type="date"]').exists()).toBe(true);
    expect(card.find('input[type="text"]').exists()).toBe(true);
    expect(card.find('input[inputmode="decimal"]').exists()).toBe(true);
    expect(card.find('textarea').exists()).toBe(true);

    const options = card.findAll('select option').map((option) => option.text());
    expect(options).toEqual(['Select a category', 'Travel', 'Meals', 'Accommodation', 'Office Supplies', 'Other']);
  });

  it('adds up the running total in INR', async () => {
    const { wrapper } = await mountEditor();
    await addLine(wrapper);
    await addLine(wrapper);

    await fillLine(wrapper, 0, { amount: '750.50' });
    await fillLine(wrapper, 1, { amount: '1250.25' });

    expect(wrapper.find('.total-value').text()).toBe('₹2,000.75');
  });

  it('removes a line and updates the total', async () => {
    const { wrapper } = await mountEditor();
    await addLine(wrapper);
    await addLine(wrapper);
    await fillLine(wrapper, 0, { amount: '100' });
    await fillLine(wrapper, 1, { amount: '200' });

    await lineCards(wrapper)[0].find('button').trigger('click');

    expect(lineCards(wrapper)).toHaveLength(1);
    expect(wrapper.find('.total-value').text()).toBe('₹200.00');
  });

  it('shows the file name of an accepted receipt beside its line', async () => {
    const { wrapper } = await mountEditor('/reports/7/edit');
    apiMock.get.mockImplementation((path: string) => {
      if (path === '/api/categories') return Promise.resolve({ data: CATEGORIES });
      if (path === '/api/reports/7') {
        return Promise.resolve({
          data: {
            id: 7,
            title: 'Trip',
            business_purpose: 'Client visit',
            status: 'draft',
            total_paise: 100000,
            lines: [
              {
                id: 11,
                expense_date: todayIso(),
                category: { id: 1, name: 'Travel' },
                merchant: 'IndiGo',
                amount_paise: 100000,
                note: null,
                receipt: null,
              },
            ],
          },
        });
      }
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    const { wrapper: reloaded } = await mountEditor('/reports/7/edit');
    apiMock.upload.mockResolvedValue({
      data: { id: 3, file_name: 'ticket.pdf', mime_type: 'application/pdf', size: 1024 },
    });

    const input = reloaded.find('.receipt-input');
    const file = new File(['%PDF-1.4'], 'ticket.pdf', { type: 'application/pdf' });
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
    await input.trigger('change');

    expect(reloaded.find('.receipt-name').text()).toBe('ticket.pdf');
    expect(apiMock.upload).not.toHaveBeenCalled();
    expect(wrapper.exists()).toBe(true);
  });

  it('rejects a file that is not a PDF, JPEG or PNG and keeps the line values', async () => {
    const { wrapper } = await mountEditor();
    await addLine(wrapper);
    await fillLine(wrapper, 0, { merchant: 'Cafe', amount: '1200' });

    const input = wrapper.find('.receipt-input');
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
    await input.trigger('change');

    expect(wrapper.text()).toContain('Receipts must be a PDF, JPEG or PNG of up to 5 MB');
    expect(wrapper.find('.line-card input[type="text"]').element).toHaveProperty('value', 'Cafe');
    expect(wrapper.find('input[inputmode="decimal"]').element).toHaveProperty('value', '1200');
    expect(apiMock.upload).not.toHaveBeenCalled();
  });

  it('rejects a file larger than 5 MB', async () => {
    const { wrapper } = await mountEditor();
    await addLine(wrapper);

    const input = wrapper.find('.receipt-input');
    const file = new File(['x'], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
    await input.trigger('change');

    expect(wrapper.text()).toContain('Receipts must be a PDF, JPEG or PNG of up to 5 MB');
  });

  it('shows Required beside every empty field and Receipt required for a line of ₹1,000 or more', async () => {
    const { wrapper } = await mountEditor();
    await addLine(wrapper);
    await fillLine(wrapper, 0, { amount: '1000' });

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Required');
    expect(wrapper.text()).toContain('Receipt required');
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('shows Add at least one expense line and does not submit an empty report', async () => {
    const { wrapper } = await mountEditor();

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Add at least one expense line');
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('shows the amount and future date messages beside the line', async () => {
    const { wrapper } = await mountEditor();
    await addLine(wrapper);
    await fillLine(wrapper, 0, {
      date: tomorrowIso(),
      category: '1',
      merchant: 'Hotel',
      amount: '0',
    });

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Amount must be more than zero');
    expect(wrapper.text()).toContain('Expense date cannot be in the future');
    const errorList = wrapper.find('[role="alert"] > ul.line-errors');
    expect(errorList.exists()).toBe(true);
    expect(errorList.attributes('role')).toBeUndefined();
    expect(errorList.findAll('li')).toHaveLength(2);
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('saves a draft even when the fields are empty', async () => {
    const { wrapper, router } = await mountEditor();
    apiMock.post.mockImplementation((path: string) => {
      if (path === '/api/reports') return Promise.resolve({ data: { id: 42 } });
      if (path === '/api/reports/42/lines') return Promise.resolve({ data: { id: 99 } });
      return Promise.reject(new Error(`unexpected POST ${path}`));
    });

    await addLine(wrapper);
    await fillLine(wrapper, 0, { merchant: 'Partially entered merchant' });

    await wrapper.findAll('button').find((button) => button.text() === 'Save draft')!.trigger('click');
    await flushPromises();

    expect(apiMock.post).toHaveBeenCalledWith('/api/reports', { title: '', business_purpose: '' });
    expect(apiMock.post).toHaveBeenCalledWith('/api/reports/42/lines', {
      expense_date: null,
      category_id: null,
      merchant: 'Partially entered merchant',
      amount_paise: null,
      note: null,
      draft: true,
    });
    expect(router.currentRoute.value.path).toBe('/dashboard');
  });

  it('patches edited lines and deletes removed persisted lines before saving a draft', async () => {
    apiMock.get.mockImplementation((path: string) => {
      if (path === '/api/categories') return Promise.resolve({ data: CATEGORIES });
      if (path === '/api/reports/7') return Promise.resolve({
        data: {
          id: 7,
          title: 'Trip',
          business_purpose: 'Client visit',
          status: 'draft',
          total_paise: 30000,
          lines: [
            { id: 11, expense_date: todayIso(), category: CATEGORIES[0], merchant: 'Old', amount_paise: 10000, note: null, receipt: null },
            { id: 12, expense_date: todayIso(), category: CATEGORIES[1], merchant: 'Remove me', amount_paise: 20000, note: null, receipt: null },
          ],
        },
      });
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });
    apiMock.patch.mockResolvedValue({ data: {} });
    apiMock.del.mockResolvedValue(undefined);

    const { wrapper } = await mountEditor('/reports/7/edit');
    await fillLine(wrapper, 0, { merchant: 'Updated', amount: '150.50' });
    await lineCards(wrapper)[1].find('button').trigger('click');
    await wrapper.findAll('button').find((button) => button.text() === 'Save draft')!.trigger('click');
    await flushPromises();

    expect(apiMock.del).toHaveBeenCalledWith('/api/reports/7/lines/12');
    expect(apiMock.patch).toHaveBeenCalledWith('/api/reports/7/lines/11', {
      expense_date: todayIso(),
      category_id: 1,
      merchant: 'Updated',
      amount_paise: 15050,
      note: null,
      draft: true,
    });
  });

  it('keeps the entered values when the save fails', async () => {
    const { wrapper } = await mountEditor();
    apiMock.post.mockRejectedValue(new ApiError(500, 'Something went wrong. Try again.'));

    await wrapper.find('#report-title').setValue('November travel');
    await addLine(wrapper);
    await fillLine(wrapper, 0, { merchant: 'IndiGo', amount: '4500' });

    await wrapper.findAll('button').find((button) => button.text() === 'Save draft')!.trigger('click');
    await flushPromises();

    expect(wrapper.find('#report-title').element).toHaveProperty('value', 'November travel');
    expect(wrapper.find('.line-card input[type="text"]').element).toHaveProperty('value', 'IndiGo');
    expect(wrapper.find('input[inputmode="decimal"]').element).toHaveProperty('value', '4500');
    expect(wrapper.text()).toContain('Something went wrong. Try again.');
  });

  it('submits ₹999.99 without requiring a receipt and opens report details', async () => {
    const { wrapper, router } = await mountEditor();
    apiMock.post.mockImplementation((path: string) => {
      if (path === '/api/reports') return Promise.resolve({ data: { id: 41 } });
      if (path === '/api/reports/41/lines') return Promise.resolve({ data: { id: 98 } });
      if (path === '/api/reports/41/submit') {
        return Promise.resolve({
          data: {
            id: 41,
            status: 'submitted',
            manager: { id: 7, name: 'Manager' },
            audit: [{ action: 'submitted' }],
          },
        });
      }
      return Promise.reject(new Error(`unexpected POST ${path}`));
    });

    await wrapper.find('#report-title').setValue('Local travel');
    await wrapper.find('#report-purpose').setValue('Client meeting');
    await addLine(wrapper);
    await fillLine(wrapper, 0, {
      date: todayIso(),
      category: '1',
      merchant: 'Metro',
      amount: '999.99',
    });

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).not.toContain('Receipt required');
    expect(apiMock.post).toHaveBeenCalledWith('/api/reports/41/submit');
    expect(router.currentRoute.value.path).toBe('/reports/41');
  });

  it('submits a valid report and opens its details', async () => {
    const { wrapper, router } = await mountEditor();
    const events: string[] = [];
    apiMock.post.mockImplementation((path: string) => {
      events.push(path);
      if (path === '/api/reports') return Promise.resolve({ data: { id: 42 } });
      if (path === '/api/reports/42/lines') return Promise.resolve({ data: { id: 99 } });
      if (path === '/api/reports/42/submit') return Promise.resolve({ data: { id: 42 } });
      return Promise.reject(new Error(`unexpected POST ${path}`));
    });
    apiMock.upload.mockImplementation(async (path: string) => {
      events.push(`upload:${path}:started`);
      await Promise.resolve();
      events.push(`upload:${path}:finished`);
      return { data: { id: 3, file_name: 'ticket.pdf', mime_type: 'application/pdf', size: 8 } };
    });

    await wrapper.find('#report-title').setValue('November travel');
    await wrapper.find('#report-purpose').setValue('Client visit in Pune');
    await addLine(wrapper);
    await fillLine(wrapper, 0, {
      date: todayIso(),
      category: '1',
      merchant: 'IndiGo',
      amount: '4500',
    });

    const input = wrapper.find('.receipt-input');
    const file = new File(['%PDF-1.4'], 'ticket.pdf', { type: 'application/pdf' });
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true });
    await input.trigger('change');

    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(apiMock.post.mock.calls.map((call) => call[0])).toEqual([
      '/api/reports',
      '/api/reports/42/lines',
      '/api/reports/42/submit',
    ]);
    expect(events).toEqual([
      '/api/reports',
      '/api/reports/42/lines',
      'upload:/api/reports/42/lines/99/receipt:started',
      'upload:/api/reports/42/lines/99/receipt:finished',
      '/api/reports/42/submit',
    ]);
    expect(apiMock.post.mock.calls[0][1]).toEqual({
      title: 'November travel',
      business_purpose: 'Client visit in Pune',
    });
    expect(apiMock.post.mock.calls[1][1]).toEqual({
      expense_date: todayIso(),
      category_id: 1,
      merchant: 'IndiGo',
      amount_paise: 450000,
      note: null,
      draft: false,
    });
    expect(router.currentRoute.value.path).toBe('/reports/42');
  });
});
