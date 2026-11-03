import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { setUnauthorizedHandler } from '../api/client';
import { homeForRoles, useAuthStore, type Role } from '../stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean;
    roles?: Role[];
    showAccessDenied?: boolean;
    title?: string;
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    redirect: () => {
      const auth = useAuthStore();
      return auth.isSignedIn ? auth.home : '/sign-in';
    },
  },
  {
    path: '/sign-in',
    name: 'sign-in',
    component: () => import('../views/SignInView.vue'),
    meta: { public: true, title: 'Sign in' },
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('../views/ForgotPasswordView.vue'),
    meta: { public: true, title: 'Forgot password' },
  },
  {
    path: '/reset-password/:token',
    name: 'reset-password',
    component: () => import('../views/ResetPasswordView.vue'),
    meta: { public: true, title: 'Reset password' },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/EmployeeDashboardView.vue'),
    meta: { roles: ['Employee'], title: 'Dashboard' },
  },
  {
    path: '/reports/new',
    name: 'report-new',
    component: () => import('../views/ReportEditorView.vue'),
    meta: { roles: ['Employee'], title: 'New report' },
  },
  {
    path: '/reports/:id/edit',
    name: 'report-edit',
    component: () => import('../views/ReportEditorView.vue'),
    meta: { roles: ['Employee'], title: 'Edit report' },
  },
  {
    path: '/reports/:id',
    name: 'report-details',
    component: () => import('../views/ReportDetailsView.vue'),
    meta: { roles: ['Employee', 'Manager', 'Finance', 'Administrator'], title: 'Report' },
  },
  {
    path: '/approvals',
    name: 'approvals',
    component: () => import('../views/ApprovalInboxView.vue'),
    meta: { roles: ['Manager'], title: 'Approvals' },
  },
  {
    path: '/finance',
    name: 'finance',
    component: () => import('../views/FinanceDashboardView.vue'),
    meta: { roles: ['Finance'], title: 'Finance' },
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('../views/AdminUsersView.vue'),
    // The view renders the required access-denied message without making an
    // API request when a signed-in non-Administrator opens this URL directly.
    meta: { title: 'Users' },
  },
  {
    path: '/admin/categories',
    name: 'admin-categories',
    component: () => import('../views/AdminCategoriesView.vue'),
    meta: { roles: ['Administrator'], showAccessDenied: true, title: 'Categories' },
  },
  {
    path: '/admin/audit',
    name: 'admin-audit',
    component: () => import('../views/AdminAuditView.vue'),
    meta: { roles: ['Administrator'], showAccessDenied: true, title: 'Audit history' },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    redirect: '/',
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // Public authentication screens must be reachable without probing /api/me.
  // A 401 is the normal answer for a signed-out person, but issuing that
  // request here both creates a failed page-health request and lets the global
  // unauthorized handler interrupt password-reset navigation.
  if (to.meta.public) {
    if (auth.isSignedIn && (to.name === 'sign-in' || to.name === 'forgot-password')) {
      return auth.home;
    }
    return true;
  }

  if (!auth.loaded) {
    await auth.load();
  }

  if (!auth.isSignedIn) {
    return { name: 'sign-in', query: { redirect: to.fullPath } };
  }

  const allowed = to.meta.roles;
  if (allowed && allowed.length > 0 && !allowed.some((role) => auth.roles.includes(role))) {
    if (to.meta.showAccessDenied) return true;
    return homeForRoles(auth.roles);
  }

  return true;
});

router.afterEach((to) => {
  if (typeof document !== 'undefined') {
    document.title = to.meta.title ? `${to.meta.title} · ExpenseDesk` : 'ExpenseDesk';
  }
});

// A 401 from any request clears the store and shows the sign-in page.
setUnauthorizedHandler(() => {
  const auth = useAuthStore();
  auth.clear();
  if (router.currentRoute.value.name !== 'sign-in') {
    void router.push({ name: 'sign-in' });
  }
});

export default router;
