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
        <p class="muted">{{ categories.length }} categories available.</p>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.muted {
  color: var(--color-muted);
}
</style>
