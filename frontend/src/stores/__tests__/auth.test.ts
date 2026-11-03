import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { homeForRoles, useAuthStore } from '../auth';

describe('homeForRoles', () => {
  it('picks the first screen of the highest role', () => {
    expect(homeForRoles(['Employee'])).toBe('/dashboard');
    expect(homeForRoles(['Employee', 'Manager'])).toBe('/approvals');
    expect(homeForRoles(['Employee', 'Finance'])).toBe('/finance');
    expect(homeForRoles(['Manager', 'Administrator'])).toBe('/admin/users');
    expect(homeForRoles([])).toBe('/sign-in');
  });
});

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts signed out', () => {
    const auth = useAuthStore();
    expect(auth.isSignedIn).toBe(false);
    expect(auth.home).toBe('/sign-in');
  });

  it('reports the roles of the signed-in person', () => {
    const auth = useAuthStore();
    auth.setUser({
      id: 1,
      name: 'Priya',
      email: 'manager@expensedesk.test',
      roles: ['Manager'],
      manager_id: null,
      active: true,
    });

    expect(auth.isSignedIn).toBe(true);
    expect(auth.hasRole('Manager')).toBe(true);
    expect(auth.home).toBe('/approvals');
  });

  it('clears the person on sign out', () => {
    const auth = useAuthStore();
    auth.setUser({
      id: 1,
      name: 'Priya',
      email: 'manager@expensedesk.test',
      roles: ['Manager'],
      manager_id: null,
      active: true,
    });
    auth.clear();

    expect(auth.isSignedIn).toBe(false);
  });
});
