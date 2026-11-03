<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, ApiError } from '../api/client';
import { formatInr } from '../lib/money';
import { formatDateTime } from '../lib/dates';
import { useAuthStore } from '../stores/auth';
import './EmployeeDashboardView.css';

interface ReportSummary {
  id: number;
  title: string | null;
  status: string;
  total_paise: number;
  updated_at: string | null;
}

interface StatusGroup {
  status: string;
  label: string;
  count: number;
  totalPaise: number;
}

/** The five groups of requirement 2.1, in this order. */
const GROUPS: { status: string; label: string }[] = [
  { status: 'draft', label: 'Draft' },
  { status: 'submitted', label: 'Awaiting approval' },
  { status: 'changes_requested', label: 'Changes requested' },
  { status: 'approved', label: 'Approved' },
  { status: 'paid', label: 'Paid' },
];

const auth = useAuthStore();
const reports = ref<ReportSummary[]>([]);
const loading = ref(true);
const error = ref('');

const groups = computed<StatusGroup[]>(() =>
  GROUPS.map((group) => {
    const matching = reports.value.filter((report) => report.status === group.status);
    return {
      status: group.status,
      label: group.label,
      count: matching.length,
      totalPaise: matching.reduce((sum, report) => sum + (report.total_paise ?? 0), 0),
    };
  }),
);

/** Newest first, by last update; the API already sorts this way, the screen does not rely on it. */
const sortedReports = computed<ReportSummary[]>(() =>
  [...reports.value].sort((a, b) => {
    const at = a.updated_at ? Date.parse(a.updated_at) : 0;
    const bt = b.updated_at ? Date.parse(b.updated_at) : 0;
    if (bt !== at) return bt - at;
    return b.id - a.id;
  }),
);

/** A Changes requested report opens the editor; every other report opens its details. */
function reportLink(report: ReportSummary): string {
  return report.status === 'changes_requested' ? `/reports/${report.id}/edit` : `/reports/${report.id}`;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<{ data: ReportSummary[] }>('/api/reports');
    reports.value = response.data ?? [];
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
    <div class="page dashboard">
      <header class="head">
        <h1 class="greeting">{{ auth.user?.name ?? 'Dashboard' }}</h1>
        <RouterLink to="/reports/new" class="btn btn-primary dashboard-action">New report</RouterLink>
      </header>

      <section class="status-cards" aria-label="Reports by status">
        <div
          v-for="group in groups"
          :key="group.status"
          class="card status-card"
          :class="`status-card-${group.status}`"
          :data-status="group.status"
        >
          <span class="status-label">{{ group.label }}</span>
          <span class="status-count">{{ group.count }}</span>
          <span class="status-total amount">{{ formatInr(group.totalPaise) }}</span>
        </div>
      </section>

      <LoadingState v-if="loading" label="Loading reports…" />
      <ErrorState v-else-if="error" message="Reports could not be loaded" @retry="load" />
      <EmptyState v-else-if="reports.length === 0" title="You have no expense reports yet">
        <RouterLink to="/reports/new" class="btn btn-primary dashboard-action">New report</RouterLink>
      </EmptyState>
      <template v-else>
        <div class="report-list-header" aria-hidden="true">
          <span class="report-header-title">Title</span>
          <span class="report-header-total">Total</span>
          <span class="report-header-status">Status</span>
          <span class="report-header-updated">Last updated</span>
        </div>
        <ul class="report-list" aria-label="Your reports">
          <li v-for="report in sortedReports" :key="report.id" class="card report-row">
            <RouterLink :to="reportLink(report)" class="report-link">
              <span class="report-title">{{ report.title || 'Untitled report' }}</span>
              <span class="report-total amount">{{ formatInr(report.total_paise) }}</span>
              <StatusBadge :status="report.status" />
              <span class="report-updated">Updated {{ formatDateTime(report.updated_at) }}</span>
            </RouterLink>
          </li>
        </ul>
      </template>
    </div>
  </AppShell>
</template>
