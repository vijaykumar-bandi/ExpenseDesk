<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import DataTable, { type DataTableColumn } from '../components/DataTable.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';

interface AdminUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
  manager_name: string | null;
  active: boolean;
}

const columns: DataTableColumn[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'roles', label: 'Roles', sortable: true },
  { key: 'manager_name', label: 'Manager', sortable: true },
  { key: 'active', label: 'Active', sortable: true },
];

const rows = ref<Record<string, unknown>[]>([]);
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<{ data: AdminUser[] }>('/api/admin/users');
    rows.value = response.data.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      roles: user.roles.join(', '),
      manager_name: user.manager_name ?? '—',
      active: user.active ? 'Active' : 'Deactivated',
    }));
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AppShell>
    <div class="page">
      <h1>Users</h1>
      <LoadingState v-if="loading" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <DataTable v-else :columns="columns" :rows="rows" empty-text="No users yet." />
    </div>
  </AppShell>
</template>
