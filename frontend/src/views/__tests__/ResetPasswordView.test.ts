import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import ResetPasswordView from '../ResetPasswordView.vue';
import { ApiError } from '../../api/client';

const post = vi.fn();
const csrf = vi.fn();

vi.mock('../../api/client', async () => {
  const actual = await vi.importActual<typeof import('../../api/client')>('../../api/client');
  return {
    ...actual,
    api: {
      csrf: (...args: unknown[]) => csrf(...args),
      post: (...args: unknown[]) => post(...args),
    },
  };
});

const INVALID_LINK = 'This reset link is no longer valid';

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/reset-password/:token', name: 'reset-password', component: ResetPasswordView },
      { path: '/sign-in', name: 'sign-in', component: { template: '<div />' } },
      { path: '/forgot-password', name: 'forgot-password', component: { template: '<div />' } },
    ],
  });
}

async function mountView(token = 'abc123') {
  const router = makeRouter();
  await router.push(`/reset-password/${token}`);
  await router.isReady();
  const wrapper = mount(ResetPasswordView, { global: { plugins: [router] } });
  return { wrapper, router };
}

async function fillAndSubmit(
  wrapper: Awaited<ReturnType<typeof mountView>>['wrapper'],
  password: string,
  confirmation: string,
) {
  await wrapper.get('#password').setValue(password);
  await wrapper.get('#confirmation').setValue(confirmation);
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

describe('ResetPasswordView', () => {
  beforeEach(() => {
    csrf.mockReset();
    csrf.mockResolvedValue(undefined);
    post.mockReset();
  });

  it('shows two password fields of at least 12 characters and the button', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.get('h1').text()).toBe('ExpenseDesk');
    expect(wrapper.get('label[for="password"]').text()).toBe('New password');
    expect(wrapper.get('label[for="confirmation"]').text()).toBe('Confirm new password');
    expect(wrapper.get('#password').attributes('minlength')).toBe('12');
    expect(wrapper.get('#confirmation').attributes('minlength')).toBe('12');
    expect(wrapper.get('button[type="submit"]').text()).toBe('Set new password');
  });

  it('sets the new password and shows the sign-in page', async () => {
    post.mockResolvedValue({ message: 'Your password has been reset' });

    const { wrapper, router } = await mountView('token-xyz');
    await fillAndSubmit(wrapper, 'BrandNewPassw0rd!', 'BrandNewPassw0rd!');

    expect(csrf).toHaveBeenCalledOnce();
    expect(csrf.mock.invocationCallOrder[0]).toBeLessThan(post.mock.invocationCallOrder[0]);
    expect(post).toHaveBeenCalledWith('/api/reset-password', {
      token: 'token-xyz',
      password: 'BrandNewPassw0rd!',
      password_confirmation: 'BrandNewPassw0rd!',
    });
    expect(router.currentRoute.value.path).toBe('/sign-in');
  });

  it('refuses a password shorter than 12 characters without calling the API', async () => {
    const { wrapper } = await mountView();
    await fillAndSubmit(wrapper, 'short', 'short');

    expect(post).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toBe('Password must be at least 12 characters');
  });

  it('refuses two different passwords without calling the API', async () => {
    const { wrapper } = await mountView();
    await fillAndSubmit(wrapper, 'BrandNewPassw0rd!', 'DifferentPassw0rd!');

    expect(post).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toBe('Passwords do not match');
  });

  it('shows the invalid-link message and a link to send a new one', async () => {
    post.mockRejectedValue(new ApiError(422, INVALID_LINK, { token: [INVALID_LINK] }));

    const { wrapper } = await mountView('expired');
    await fillAndSubmit(wrapper, 'BrandNewPassw0rd!', 'BrandNewPassw0rd!');

    expect(wrapper.get('[role="alert"]').text()).toBe(INVALID_LINK);
    const link = wrapper.get('a[href="/forgot-password"]');
    expect(link.text()).toBe('Send a new link');
  });

  it('recognizes an invalid link when the API returns the contract message without field errors', async () => {
    post.mockRejectedValue(new ApiError(422, INVALID_LINK));

    const { wrapper } = await mountView('used');
    await fillAndSubmit(wrapper, 'BrandNewPassw0rd!', 'BrandNewPassw0rd!');

    expect(wrapper.get('[role="alert"]').text()).toBe(INVALID_LINK);
    expect(wrapper.get('a[href="/forgot-password"]').text()).toBe('Send a new link');
  });

  it('shows a loading state while saving', async () => {
    let resolve: (value: unknown) => void = () => {};
    post.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { wrapper } = await mountView();
    await wrapper.get('#password').setValue('BrandNewPassw0rd!');
    await wrapper.get('#confirmation').setValue('BrandNewPassw0rd!');
    await wrapper.get('form').trigger('submit');

    const button = wrapper.get('button[type="submit"]');
    expect(button.text()).toBe('Saving…');
    expect(button.attributes('disabled')).toBeDefined();

    resolve({ message: 'Your password has been reset' });
    await flushPromises();
  });
});
