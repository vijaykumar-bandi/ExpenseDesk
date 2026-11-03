import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore, type Role } from '../../stores/auth';

const { get, post, patch } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    api: { get, post, patch },
  };
});

import AdminCategoriesView from '../AdminCategoriesView.vue';

const seeded = [
  { id: 1, name: 'Accommodation', active: true },
  { id: 2, name: 'Meals', active: true },
  { id: 3, name: 'Office Supplies', active: true },
  { id: 4, name: 'Other', active: true },
  { id: 5, name: 'Travel', active: true },
];

function signIn(roles: Role[]): void {
  useAuthStore().setUser({
    id: 1,
    name: 'Asha',
    email: 'asha@expensedesk.test',
    roles,
    manager_id: null,
    active: true,
  });
}

async function mountView() {
  const wrapper = mount(AdminCategoriesView, {
    global: { stubs: { AppShell: { template: '<div><slot /></div>' } } },
  });
  await flushPromises();
  return wrapper;
}

describe('AdminCategoriesView', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    setActivePinia(createPinia());
    get.mockReset();
    post.mockReset();
    patch.mockReset();
  });

  it('lists the seeded categories with their active state', async () => {
    signIn(['Administrator']);
    get.mockResolvedValue({ data: seeded });

    const wrapper = await mountView();

    expect(get).toHaveBeenCalledWith('/api/admin/categories');
    const rows = wrapper.findAll('li.admin-category-row');
    expect(rows).toHaveLength(5);
    for (const name of ['Travel', 'Meals', 'Accommodation', 'Office Supplies', 'Other']) {
      expect(wrapper.text()).toContain(name);
    }
    expect(wrapper.text()).toContain('Active');
  });

  it('shows the note that a deactivated category stays on existing reports', async () => {
    signIn(['Administrator']);
    get.mockResolvedValue({ data: seeded });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('A deactivated category stays on the reports that already use it.');
  });

  it('adds a category through the dialog', async () => {
    signIn(['Administrator']);
    get.mockResolvedValue({ data: seeded });
    post.mockResolvedValue({ data: { id: 6, name: 'Training', active: true } });

    const wrapper = await mountView();
    await wrapper.find('button.btn-primary').trigger('click');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);

    await wrapper.find('#category-name').setValue('Training');
    await wrapper.find('form.admin-category-dialog').trigger('submit');
    await flushPromises();

    expect(post).toHaveBeenCalledWith('/api/admin/categories', { name: 'Training' });
    expect(wrapper.text()).toContain('Training');
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('shows the server error beside the name when the category exists', async () => {
    signIn(['Administrator']);
    get.mockResolvedValue({ data: seeded });
    const { ApiError } = await import('../../api/client');
    post.mockRejectedValue(
      new ApiError(422, 'The name has already been taken.', { name: ['The name has already been taken.'] }),
    );

    const wrapper = await mountView();
    await wrapper.find('button.btn-primary').trigger('click');
    await wrapper.find('#category-name').setValue('Travel');
    await wrapper.find('form.admin-category-dialog').trigger('submit');
    await flushPromises();

    expect(wrapper.find('#category-name-error').text()).toBe(
      'The name has already been taken. Choose another name and try again.',
    );
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true);
  });

  it('traps Tab focus inside the dialog and restores focus when it closes', async () => {
    signIn(['Administrator']);
    get.mockResolvedValue({ data: seeded });

    const wrapper = mount(AdminCategoriesView, {
      attachTo: document.body,
      global: { stubs: { AppShell: { template: '<div><slot /></div>' } } },
    });
    await flushPromises();

    const opener = wrapper.find('button.btn-primary');
    (opener.element as HTMLButtonElement).focus();
    await opener.trigger('click');

    const input = wrapper.find('#category-name').element as HTMLInputElement;
    const cancel = wrapper.find('form.admin-category-dialog button[type="button"]').element as HTMLButtonElement;
    const submit = wrapper.find('form.admin-category-dialog button[type="submit"]').element as HTMLButtonElement;
    expect(document.activeElement).toBe(input);

    submit.focus();
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(input);

    input.focus();
    await wrapper.find('[role="dialog"]').trigger('keydown', { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(submit);

    cancel.click();
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(opener.element);
    wrapper.unmount();
  });

  it('deactivates a category and shows it as deactivated', async () => {
    signIn(['Administrator']);
    get.mockResolvedValue({ data: seeded });
    patch.mockResolvedValue({ data: { id: 5, name: 'Travel', active: false } });

    const wrapper = await mountView();
    const travelRow = wrapper.findAll('li.admin-category-row').find((row) => row.text().includes('Travel'))!;
    await travelRow.find('button').trigger('click');
    await flushPromises();

    expect(patch).toHaveBeenCalledWith('/api/admin/categories/5', { active: false });
    const updated = wrapper.findAll('li.admin-category-row').find((row) => row.text().includes('Travel'))!;
    expect(updated.text()).toContain('Deactivated');
    expect(updated.find('button').text()).toBe('Activate');
  });

  it('activates a deactivated category', async () => {
    signIn(['Administrator']);
    get.mockResolvedValue({
      data: [{ id: 5, name: 'Travel', active: false }],
    });
    patch.mockResolvedValue({ data: { id: 5, name: 'Travel', active: true } });

    const wrapper = await mountView();
    await wrapper.find('li.admin-category-row button').trigger('click');
    await flushPromises();

    expect(patch).toHaveBeenCalledWith('/api/admin/categories/5', { active: true });
    expect(wrapper.find('li.admin-category-row').text()).toContain('Active');
  });

  it('shows the access message to a person without the Administrator role', async () => {
    signIn(['Employee']);

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('You do not have access to this page');
    expect(get).not.toHaveBeenCalled();
    expect(wrapper.find('button.btn-primary').exists()).toBe(false);
  });

  it('shows the access message when the API refuses with 403', async () => {
    signIn(['Administrator']);
    const { ApiError } = await import('../../api/client');
    get.mockRejectedValue(new ApiError(403, 'You do not have access to this page'));

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('You do not have access to this page');
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('shows an actionable message and retry when categories fail to load', async () => {
    signIn(['Administrator']);
    const { ApiError } = await import('../../api/client');
    get.mockRejectedValueOnce(new ApiError(500, 'Internal server error'));
    get.mockResolvedValueOnce({ data: seeded });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Categories could not be loaded. Try again.');
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(get).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain('Travel');
  });

  it('shows a loading state until the categories arrive', async () => {
    signIn(['Administrator']);
    let resolve: (value: { data: typeof seeded }) => void = () => {};
    get.mockReturnValue(new Promise((r) => (resolve = r)));

    const wrapper = mount(AdminCategoriesView, {
      global: { stubs: { AppShell: { template: '<div><slot /></div>' } } },
    });
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(true);

    resolve({ data: seeded });
    await flushPromises();
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('shows an empty state with the Add category action', async () => {
    signIn(['Administrator']);
    get.mockResolvedValue({ data: [] });

    const wrapper = await mountView();

    expect(wrapper.text()).toContain('No categories yet');
    expect(wrapper.find('button.btn-primary').text()).toBe('Add category');
  });
});
