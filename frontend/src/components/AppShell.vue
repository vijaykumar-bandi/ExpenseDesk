<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api/client';
import { useAuthStore, type Role } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();

const links = computed(() => {
  const items: { label: string; to: string; roles: Role[] }[] = [
    { label: 'Dashboard', to: '/dashboard', roles: ['Employee'] },
    { label: 'Approvals', to: '/approvals', roles: ['Manager'] },
    { label: 'Finance', to: '/finance', roles: ['Finance'] },
    { label: 'Users', to: '/admin/users', roles: ['Administrator'] },
    { label: 'Categories', to: '/admin/categories', roles: ['Administrator'] },
    { label: 'Audit history', to: '/admin/audit', roles: ['Administrator'] },
  ];
  return items.filter((item) => item.roles.some((role) => auth.roles.includes(role)));
});

async function signOut(): Promise<void> {
  try {
    await api.post('/api/logout');
  } finally {
    auth.clear();
    await router.push('/sign-in');
  }
}
</script>

<template>
  <div class="shell">
    <header class="shell-header">
      <RouterLink to="/" class="wordmark">ExpenseDesk</RouterLink>
      <nav class="shell-nav" aria-label="Main">
        <RouterLink v-for="link in links" :key="link.to" :to="link.to">{{ link.label }}</RouterLink>
      </nav>
      <div class="shell-user">
        <span v-if="auth.user">{{ auth.user.name }}</span>
        <button type="button" class="btn btn-ghost" @click="signOut">Sign out</button>
      </div>
    </header>
    <main class="shell-main">
      <slot />
    </main>
  </div>
</template>

<style scoped>
.shell-header {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  flex-wrap: wrap;
  padding: var(--space-3) var(--space-4);
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.wordmark {
  font-weight: 600;
  color: var(--color-text);
  text-decoration: none;
}

.shell-nav {
  display: flex;
  gap: var(--space-3);
  flex-wrap: wrap;
}

.shell-nav a {
  color: var(--color-muted);
  text-decoration: none;
}

.shell-nav a.router-link-active {
  color: var(--color-primary);
  font-weight: 600;
}

.shell-user {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.shell-main {
  padding: var(--space-4);
}
</style>
