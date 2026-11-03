<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';
import { formatInr } from '../lib/money';

interface Category {
  id: number;
  name: string;
}

interface Line {
  id: number;
  merchant: string;
  amount_paise: number;
}

interface Report {
  id: number;
  title: string | null;
  business_purpose: string | null;
  status: string;
  total_paise: number;
  lines: Line[];
}

const route = useRoute();
const reportId = route.params.id ? Number(route.params.id) : null;

const report = ref<Report | null>(null);
const categories = ref<Category[]>([]);
const selectedCategoryId = ref('');
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const categoryResponse = await api.get<{ data: Category[] }>('/api/categories');
    categories.value = categoryResponse.data;

    if (reportId) {
      const response = await api.get<{ data: Report }>(`/api/reports/${reportId}`);
      report.value = response.data;
    }
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
      <h1>{{ reportId ? 'Edit report' : 'New report' }}</h1>
      <LoadingState v-if="loading" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <div v-else class="card">
        <p v-if="report" class="summary">
          {{ report.title || 'Untitled report' }} · {{ formatInr(report.total_paise) }}
        </p>
        <div class="field">
          <label for="report-category">Category</label>
          <select id="report-category" v-model="selectedCategoryId" name="category_id">
            <option value="" disabled>Select a category</option>
            <option v-for="category in categories" :key="category.id" :value="String(category.id)">
              {{ category.name }}
            </option>
          </select>
          <p v-if="categories.length === 0" class="muted">No active categories are available.</p>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.field {
  display: grid;
  gap: 8px;
}

.field label {
  font-size: 13px;
  font-weight: 600;
}

.field select {
  min-height: 44px;
  padding: 10px 12px;
  color: var(--color-text);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.field select:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.muted {
  margin: 0;
  color: var(--color-muted);
}
</style>
