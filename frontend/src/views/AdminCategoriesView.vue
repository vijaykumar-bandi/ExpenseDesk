<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';

interface Category {
  id: number;
  name: string;
  active: boolean;
}

const categories = ref<Category[]>([]);
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<{ data: Category[] }>('/api/admin/categories');
    categories.value = response.data;
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
      <h1>Categories</h1>
      <p class="muted">A deactivated category stays on the reports that already use it.</p>
      <LoadingState v-if="loading" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <EmptyState v-else-if="categories.length === 0" title="No categories yet" />
      <ul v-else class="list">
        <li v-for="category in categories" :key="category.id" class="card row">
          <span>{{ category.name }}</span>
          <span class="state">{{ category.active ? 'Active' : 'Deactivated' }}</span>
        </li>
      </ul>
    </div>
  </AppShell>
</template>

<style scoped>
.muted {
  color: var(--color-muted);
}

.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.row {
  display: flex;
  justify-content: space-between;
}

.state {
  color: var(--color-muted);
}
</style>
