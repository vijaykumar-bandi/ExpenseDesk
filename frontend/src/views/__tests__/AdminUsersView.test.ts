import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../stores/auth';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    api: {
      get: (...args: unknown[]) => get(...args),
      post: (...args: unknown[]) => post(...args),
      patch: (...args: unknown[]) => patch(...args),
    },
  };
});

const toast = vi.fn();
vi.mock('../../lib/toast', () => ({ toast: (...args: unknown[]) => toast(...args) }));

import AdminUsersView from '../AdminUsersView.vue';

const users = [
  {
    id: 1,
    name: 'Asha Admin',
    email: 'admin@expensedesk.test',
    roles: ['Administrator'],
    manager_id: null,
    manager_name: null,
    active: true,
  },
  {
    id: 2,
    name: 'Mohan Manager',
    email: 'manager@expensedesk.test',
    roles: ['Manager'],
    manager_id: null,
    manager_name: null,
    active: true,
  },
  {
    id: 3,
    name: 'Esha Employee',
    email: 'employee@expensedesk.test',
    roles: ['Employee'],
    manager_id: 2,
    manager_name: 'Mohan Manager',
    active: false,
  },
];

function signIn(roles: string[]): void {
  const auth = useAuthStore();
  auth.setUser({
    id: 1,
    name: 'Asha Admin',
    email: 'admin@expensedesk.test',
    roles: roles as never,
    manager_id: null,
    active: true,
  });
}

async function mountView(attachTo?: Element) {
  const wrapper = mount(AdminUsersView, {
    attachTo,
    global: {
      stubs: {
        AppShell: { template: '<div><slot /></div>' },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe('AdminUsersView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    toast.mockReset();
    get.mockResolvedValue({ data: users });
  });

  it('lists every user with name, email, roles, Manager and active state', async () => {
    signIn(['Administrator']);
    const wrapper = await mountView();

    expect(get).toHaveBeenCalledWith('/api/admin/users');
    const text = wrapper.text();
    expect(text).toContain('Asha Admin');
    expect(text).toContain('admin@expensedesk.test');
    expect(text).toContain('Administrator');
    expect(text).toContain('Mohan Manager');
    expect(text).toContain('Esha Employee');
    expect(text).toContain('Deactivated');
    expect(text).toContain('Active');
  });

  it('shows the access message to a person without the Administrator role', async () => {
    signIn(['Employee']);
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('You do not have access to this page');
    expect(get).not.toHaveBeenCalled();
  });

  it('creates a user with a name, an email, a role and a 12-character password', async () => {
    signIn(['Administrator']);
    post.mockResolvedValue({ data: { id: 9 } });
    const wrapper = await mountView();

    await wrapper.find('button.btn-primary').trigger('click');
    await wrapper.find('#add-name').setValue('New Person');
    await wrapper.find('#add-email').setValue('new@expensedesk.test');
    await wrapper.find('input[type="checkbox"][value="Employee"]').setValue(true);
    await wrapper.find('#add-password').setValue('LongEnoughPass1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(post).toHaveBeenCalledWith('/api/admin/users', {
      name: 'New Person',
      email: 'new@expensedesk.test',
      roles: ['Employee'],
      password: 'LongEnoughPass1',
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('moves focus into the add dialog, traps Tab, and restores focus when closed', async () => {
    signIn(['Administrator']);
    const wrapper = await mountView(document.body);
    const opener = wrapper.findAll('button').find((button) => button.text() === 'Add user')!;
    (opener.element as HTMLButtonElement).focus();

    await opener.trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.find('#add-name').element);

    const dialog = wrapper.find('[role="dialog"]');
    const lastButton = dialog.findAll('button').at(-1)!;
    (lastButton.element as HTMLButtonElement).focus();
    await dialog.trigger('keydown', { key: 'Tab' });
    expect(document.activeElement).toBe(wrapper.find('#add-name').element);

    await dialog.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
    expect(document.activeElement).toBe(opener.element);
    wrapper.unmount();
  });

  it('refuses to create a user without a role or with a short password', async () => {
    signIn(['Administrator']);
    const wrapper = await mountView();

    await wrapper.find('button.btn-primary').trigger('click');
    await wrapper.find('#add-name').setValue('New Person');
    await wrapper.find('#add-email').setValue('new@expensedesk.test');
    await wrapper.find('#add-password').setValue('short');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(post).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Choose at least one role');
    expect(wrapper.text()).toContain('Password must be at least 12 characters');
  });

  it('edits roles, Manager and active state', async () => {
    signIn(['Administrator']);
    patch.mockResolvedValue({ data: users[2] });
    const wrapper = await mountView();

    const editButtons = wrapper.findAll('button[aria-label^="Edit"]');
    await editButtons[2].trigger('click');
    await wrapper.find('#edit-manager').setValue('2');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(patch).toHaveBeenCalledWith('/api/admin/users/3', {
      roles: ['Employee'],
      manager_id: 2,
      active: false,
    });
  });

  it('deactivates a user after confirmation', async () => {
    signIn(['Administrator']);
    patch.mockResolvedValue({ data: users[0] });
    const wrapper = await mountView();

    await wrapper.find('button[aria-label="Deactivate Asha Admin"]').trigger('click');
    expect(wrapper.text()).toContain('Deactivate Asha Admin?');

    const dialog = wrapper.find('[role="dialog"]');
    const confirm = dialog.findAll('button').find((b) => b.text() === 'Deactivate');
    await confirm!.trigger('click');
    await flushPromises();

    expect(patch).toHaveBeenCalledWith('/api/admin/users/1', { active: false });
  });

  it('reassigns a Submitted report only with a reason of at least 10 characters', async () => {
    signIn(['Administrator']);
    get.mockImplementation((path: string) => {
      if (path === '/api/admin/users') return Promise.resolve({ data: users });
      return Promise.resolve({
        data: [
          { id: 7, title: 'Trip', status: 'submitted', employee: { id: 3, name: 'Esha Employee' }, manager: null },
        ],
      });
    });
    post.mockResolvedValue({ data: { id: 7 } });
    const wrapper = await mountView();

    const openButton = wrapper.findAll('button').find((b) => b.text() === 'Reassign report');
    await openButton!.trigger('click');
    await flushPromises();

    expect(get).toHaveBeenCalledWith('/api/reports?scope=all&status=submitted');
    expect(wrapper.find('#reassign-report').text()).toContain('Trip — Esha Employee');

    await wrapper.find('#reassign-report').setValue('7');
    await wrapper.find('#reassign-manager').setValue('2');
    await wrapper.find('#reassign-reason').setValue('too short');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(post).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain('Reason must be at least 10 characters');

    await wrapper.find('#reassign-reason').setValue('Manager is on leave');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(post).toHaveBeenCalledWith('/api/admin/reports/7/reassign', {
      manager_id: 2,
      reason: 'Manager is on leave',
    });
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false);
  });

  it('shows the error message when loading fails', async () => {
    signIn(['Administrator']);
    get.mockRejectedValue(new ApiError(500, 'Users could not be loaded'));
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('Users could not be loaded');
  });

  it('keeps the access message returned by the API', async () => {
    signIn(['Administrator']);
    get.mockRejectedValue(new ApiError(403, 'You do not have access to this page'));
    const wrapper = await mountView();

    expect(wrapper.text()).toContain('You do not have access to this page');
  });

  it('shows field errors and an error toast when creating a user fails', async () => {
    signIn(['Administrator']);
    post.mockRejectedValue(new ApiError(422, 'The email has already been taken.', { email: ['The email has already been taken.'] }));
    const wrapper = await mountView();

    await wrapper.findAll('button').find((button) => button.text() === 'Add user')!.trigger('click');
    await wrapper.find('#add-name').setValue('Existing Person');
    await wrapper.find('#add-email').setValue('existing@expensedesk.test');
    await wrapper.find('input[type="checkbox"][value="Employee"]').setValue(true);
    await wrapper.find('#add-password').setValue('LongEnoughPass1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('The email has already been taken.');
    expect(wrapper.find('#add-email').attributes('aria-invalid')).toBe('true');
    expect(toast).toHaveBeenCalledWith('The email has already been taken.', 'error');
  });
});
