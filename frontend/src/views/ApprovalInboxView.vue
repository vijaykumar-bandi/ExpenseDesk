<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import DataTable, { type DataTableColumn } from '../components/DataTable.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, ApiError } from '../api/client';
import { formatInr } from '../lib/money';
import { formatDateTime } from '../lib/dates';

interface ReportSummary {
  id: number;
  title: string | null;
  status: string;
  total_paise: number;
  submitted_at: string | null;
  employee: { id: number; name: string } | null;
  waiting_days: number;
}

const columns: DataTableColumn[] = [
  { key: 'employee', label: 'Employee', sortable: true },
  { key: 'title', label: 'Report', sortable: true },
  { key: 'submitted_at', label: 'Submitted', sortable: true },
  { key: 'total_paise', label: 'Total', sortable: true, align: 'right' },
  { key: 'waiting_days', label: 'Waiting', sortable: true, align: 'right' },
];

const rows = ref<Record<string, unknown>[]>([]);
const loading = ref(true);
const error = ref('');
const router = useRouter();

function openReport(row: Record<string, unknown>): void {
  if (typeof row.id === 'number' || typeof row.id === 'string') {
    void router.push(`/reports/${row.id}`);
  }
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<{ data: ReportSummary[] }>('/api/reports?scope=inbox');
    rows.value = response.data.map((report) => ({
      id: report.id,
      employee: report.employee?.name ?? '—',
      title: report.title || 'Untitled report',
      submitted_at: formatDateTime(report.submitted_at),
      total_paise: formatInr(report.total_paise),
      waiting_days: report.waiting_days >= 3 ? `${report.waiting_days} days · Waiting 3+ days` : `${report.waiting_days} days`,
      status: report.status,
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
      <h1>Approval inbox</h1>
      <LoadingState v-if="loading" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <EmptyState v-else-if="rows.length === 0" title="Nothing waiting" message="No reports are waiting for your decision." />
      <DataTable
        v-else
        :columns="columns"
        :rows="rows"
        empty-text="No reports match."
        @row-click="openReport"
      >
        <template #cell-title="{ row }">
          <RouterLink :to="`/reports/${row.id}`" @click.stop>
            {{ row.title }}
          </RouterLink>
        </template>
        <template #cell-status="{ row }">
          <StatusBadge :status="String(row.status)" />
        </template>
      </DataTable>
    </div>
  </AppShell>
</template>
