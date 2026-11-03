<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, ApiError } from '../api/client';
import { formatInr } from '../lib/money';
import { formatDateTime } from '../lib/dates';
import { useAuthStore } from '../stores/auth';

interface ReportSummary {
  id: number;
  title: string | null;
  status: string;
  total_paise: number;
  updated_at: string | null;
}

const auth = useAuthStore();
const reports = ref<ReportSummary[]>([]);
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<{ data: ReportSummary[] }>('/api/reports');
    reports.value = response.data;
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
      <header class="head">
        <h1>{{ auth.user?.name ?? 'Dashboard' }}</h1>
        <RouterLink to="/reports/new" class="btn btn-primary">New report</RouterLink>
      </header>

      <LoadingState v-if="loading" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <EmptyState v-else-if="reports.length === 0" title="No reports yet" message="Create your first expense report." />
      <ul v-else class="report-list">
        <li v-for="report in reports" :key="report.id" class="card report-row">
          <RouterLink :to="`/reports/${report.id}`" class="report-link">
            <span class="title">{{ report.title || 'Untitled report' }}</span>
            <span class="amount">{{ formatInr(report.total_paise) }}</span>
            <StatusBadge :status="report.status" />
            <span class="updated">{{ formatDateTime(report.updated_at) }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </AppShell>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.report-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.report-link {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: var(--space-3);
  align-items: center;
  color: inherit;
  text-decoration: none;
}

.title {
  font-weight: 600;
}

.updated {
  grid-column: 1 / -1;
  color: var(--color-muted);
  font-size: 13px;
}
</style>
