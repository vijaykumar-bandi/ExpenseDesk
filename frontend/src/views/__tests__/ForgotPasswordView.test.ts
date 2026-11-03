import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import ForgotPasswordView from '../ForgotPasswordView.vue';
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

const CONFIRMATION = 'If that email has an account, a reset link has been sent';

function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/forgot-password', name: 'forgot-password', component: ForgotPasswordView },
      { path: '/sign-in', name: 'sign-in', component: { template: '<div />' } },
    ],
  });
}

async function mountView() {
  const router = makeRouter();
  await router.push('/forgot-password');
  await router.isReady();
  const wrapper = mount(ForgotPasswordView, { global: { plugins: [router] } });
  return { wrapper, router };
}

async function submitEmail(wrapper: Awaited<ReturnType<typeof mountView>>['wrapper'], email: string) {
  await wrapper.get('#email').setValue(email);
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}

describe('ForgotPasswordView', () => {
  beforeEach(() => {
    csrf.mockReset();
    csrf.mockResolvedValue(undefined);
    post.mockReset();
  });

  it('shows the wordmark, the email field, the button and a link back to sign-in', async () => {
    const { wrapper } = await mountView();

    expect(wrapper.get('h1').text()).toBe('ExpenseDesk');
    expect(wrapper.get('label[for="email"]').text()).toBe('Email');
    expect(wrapper.get('button[type="submit"]').text()).toBe('Send reset link');
    expect(wrapper.get('a[href="/sign-in"]').text()).toBe('Back to sign in');
  });

  it('posts the email and shows the confirmation', async () => {
    post.mockResolvedValue({ message: CONFIRMATION });

    const { wrapper } = await mountView();
    await submitEmail(wrapper, 'employee@expensedesk.test');

    expect(csrf).toHaveBeenCalledOnce();
    expect(csrf.mock.invocationCallOrder[0]).toBeLessThan(post.mock.invocationCallOrder[0]);
    expect(post).toHaveBeenCalledWith('/api/forgot-password', { email: 'employee@expensedesk.test' });
    expect(wrapper.get('[role="status"]').text()).toBe(CONFIRMATION);
  });

  it('shows the same confirmation whether or not the email has an account', async () => {
    post.mockResolvedValue({ message: CONFIRMATION });
    const first = await mountView();
    await submitEmail(first.wrapper, 'employee@expensedesk.test');
    const known = first.wrapper.get('[role="status"]').text();

    post.mockResolvedValue({ message: CONFIRMATION });
    const second = await mountView();
    await submitEmail(second.wrapper, 'nobody@expensedesk.test');
    const unknown = second.wrapper.get('[role="status"]').text();

    expect(known).toBe(CONFIRMATION);
    expect(unknown).toBe(CONFIRMATION);
  });

  it('shows an actionable error when sending the request fails', async () => {
    post.mockRejectedValue(new ApiError(500, 'Something went wrong. Try again.'));

    const { wrapper } = await mountView();
    await submitEmail(wrapper, 'employee@expensedesk.test');

    expect(wrapper.get('[role="alert"]').text()).toBe('Something went wrong. Try again.');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('shows a field error for an invalid email address', async () => {
    post.mockRejectedValue(
      new ApiError(422, 'The email field must be a valid email address.', {
        email: ['The email field must be a valid email address.'],
      }),
    );

    const { wrapper } = await mountView();
    await submitEmail(wrapper, 'not-an-email');

    expect(wrapper.get('[role="alert"]').text()).toBe('The email field must be a valid email address.');
    expect(wrapper.find('[role="status"]').exists()).toBe(false);
  });

  it('shows a loading state while sending', async () => {
    let resolve: (value: unknown) => void = () => {};
    post.mockReturnValue(new Promise((r) => { resolve = r; }));

    const { wrapper } = await mountView();
    await wrapper.get('#email').setValue('employee@expensedesk.test');
    await wrapper.get('form').trigger('submit');

    const button = wrapper.get('button[type="submit"]');
    expect(button.text()).toBe('Sending…');
    expect(button.attributes('disabled')).toBeDefined();

    resolve({ message: CONFIRMATION });
    await flushPromises();
  });
});
