import { defineStore } from 'pinia';
import { api } from '../api/client';

export type Role = 'Employee' | 'Manager' | 'Finance' | 'Administrator';

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  roles: Role[];
  manager_id: number | null;
  active: boolean;
}

interface AuthState {
  user: CurrentUser | null;
  loaded: boolean;
}

/** The first screen of the highest role, in the order of design.md. */
export const ROLE_HOME: Record<Role, string> = {
  Administrator: '/admin/users',
  Finance: '/finance',
  Manager: '/approvals',
  Employee: '/dashboard',
};

export function homeForRoles(roles: Role[]): string {
  for (const role of ['Administrator', 'Finance', 'Manager', 'Employee'] as Role[]) {
    if (roles.includes(role)) return ROLE_HOME[role];
  }
  return '/sign-in';
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    user: null,
    loaded: false,
  }),

  getters: {
    isSignedIn: (state): boolean => state.user !== null,
    roles: (state): Role[] => state.user?.roles ?? [],
    home: (state): string => homeForRoles(state.user?.roles ?? []),
  },

  actions: {
    async load(): Promise<CurrentUser | null> {
      try {
        const response = await api.get<{ user: CurrentUser }>('/api/me');
        this.user = response.user;
      } catch {
        this.user = null;
      } finally {
        this.loaded = true;
      }
      return this.user;
    },

    setUser(user: CurrentUser | null): void {
      this.user = user;
      this.loaded = true;
    },

    clear(): void {
      this.user = null;
      this.loaded = true;
    },

    hasRole(role: Role): boolean {
      return this.roles.includes(role);
    },
  },
});
