import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import SignInView from '../SignInView.vue';
import { ApiError } from '../../api/client';
import { useAuthStore } from '../../stores/auth';

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

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/sign-in', name: 'sign-in', component: SignInView },
      { path: '/forgot-password', name: 'forgot-password', component: { template: '<div />' } },
      { path: '/dashboard', name: 'dashboard', component: { template: '<div />' } },
      { path: '/approvals', name: 'approvals', component: { template: '<div />' } },
    ],
  });
}

async function mountView() {
  const router = makeRouter();
  await router.push('/sign-in');
  await router.isReady();
  const wrapper = mount(SignInView, { global: { plugins: [router] } });
  return { wrapper, router };
}

async function fillAndSubmit(wrapper: Awaited<ReturnType<typeof mountView>>['wrapper'], email: string, password: string) {
  await wrapper.get('#email').setValue(email);
  await wrapper.get('#password').setValue(password);
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

describe('SignInView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    csrf.mockReset();
    csrf.mockResolvedValue(undefined);
    post.mockReset();
  });

  it('shows the wordmark, the email and password fields and the Sign in button', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.get('h1').text()).toBe('ExpenseDesk');
    expect(wrapper.get('label[for="email"]').text()).toBe('Email');
    expect(wrapper.get('label[for="password"]').text()).toBe('Password');
    expect(wrapper.get('button[type="submit"]').text()).toBe('Sign in');
    expect(wrapper.get('a[href="/forgot-password"]').text()).toBe('Forgot password');
  });

  it('keeps the tab order email, password, Sign in, Forgot password', async () => {
    const { wrapper } = await mountView();

    const order = wrapper.findAll('input, button, a').map((node) => node.attributes('id') ?? node.text());
    expect(order).toEqual(['email', 'password', 'Sign in', 'Forgot password']);
  });

  it('signs in and opens the first screen of the highest role', async () => {
    post.mockResolvedValue({
      user: {
        id: 1,
        name: 'Priya',
        email: 'manager@expensedesk.test',
        roles: ['Manager'],
        manager_id: null,
        active: true,
      },
    });

    const { wrapper, router } = await mountView();
    await fillAndSubmit(wrapper, 'manager@expensedesk.test', 'ManagerPassw0rd!2026');

    expect(csrf).toHaveBeenCalledOnce();
    expect(csrf.mock.invocationCallOrder[0]).toBeLessThan(post.mock.invocationCallOrder[0]);
    expect(post).toHaveBeenCalledWith('/api/login', {
      email: 'manager@expensedesk.test',
      password: 'ManagerPassw0rd!2026',
    });
    expect(useAuthStore().isSignedIn).toBe(true);
    expect(router.currentRoute.value.path).toBe('/approvals');
  });

  it('shows "Email or password is incorrect" above the button and keeps the email', async () => {
    post.mockRejectedValue(
      new ApiError(422, 'Email or password is incorrect', { email: ['Email or password is incorrect'] }),
    );

    const { wrapper } = await mountView();
    await fillAndSubmit(wrapper, 'employee@expensedesk.test', 'wrong');

    const alert = wrapper.get('[role="alert"]');
    expect(alert.text()).toBe('Email or password is incorrect');
    expect((wrapper.get('#email').element as HTMLInputElement).value).toBe('employee@expensedesk.test');

    // The error sits above the Sign in button in the form.
    const html = wrapper.get('form').html();
    expect(html.indexOf('role="alert"')).toBeLessThan(html.indexOf('type="submit"'));
  });

  it('shows the same message for a deactivated account', async () => {
    post.mockRejectedValue(
      new ApiError(422, 'Email or password is incorrect', { email: ['Email or password is incorrect'] }),
    );

    const { wrapper } = await mountView();
    await fillAndSubmit(wrapper, 'deactivated@expensedesk.test', 'EmployeePassw0rd!2026');

    expect(wrapper.get('[role="alert"]').text()).toBe('Email or password is incorrect');
    expect(useAuthStore().isSignedIn).toBe(false);
  });

  it('does not reflect a different 422 response that could reveal account state', async () => {
    post.mockRejectedValue(
      new ApiError(422, 'The email field must be a valid email address.', {
        email: ['The email field must be a valid email address.'],
      }),
    );

    const { wrapper } = await mountView();
    await fillAndSubmit(wrapper, 'not-an-email', 'wrong');

    expect(wrapper.get('[role="alert"]').text()).toBe('Email or password is incorrect');
  });

  it('shows the rate-limit message on a 429', async () => {
    post.mockRejectedValue(new ApiError(429, 'Too many attempts. Try again in 15 minutes.'));

    const { wrapper } = await mountView();
    await fillAndSubmit(wrapper, 'employee@expensedesk.test', 'EmployeePassw0rd!2026');

    expect(wrapper.get('[role="alert"]').text()).toBe('Too many attempts. Try again in 15 minutes.');
  });

  it('shows a loading state while signing in', async () => {
    let resolve: (value: unknown) => void = () => {};
    post.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { wrapper } = await mountView();
    await wrapper.get('#email').setValue('employee@expensedesk.test');
    await wrapper.get('#password').setValue('EmployeePassw0rd!2026');
    await wrapper.get('form').trigger('submit');

    const button = wrapper.get('button[type="submit"]');
    expect(button.text()).toBe('Signing in…');
    expect(button.attributes('disabled')).toBeDefined();

    resolve({ user: { id: 1, name: 'E', email: 'e@x.test', roles: ['Employee'], manager_id: null, active: true } });
    await flushPromises();
  });
});
