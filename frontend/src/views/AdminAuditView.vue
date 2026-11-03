<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import DataTable, { type DataTableColumn } from '../components/DataTable.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';
import { formatDateTime } from '../lib/dates';
import { useAuthStore } from '../stores/auth';
import './AdminAuditView.css';

/** The message every Administration screen shows to a person without the role. */
const ACCESS_MESSAGE = 'You do not have access to this page';

/** The API pages the audit history 50 events at a time. */
const PAGE_SIZE = 50;

interface AuditActor {
  id: number;
  name: string;
}

interface AuditEvent {
  id: number;
  report_id: number;
  action: string;
  actor: AuditActor | null;
  created_at: string | null;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  previous_manager: AuditActor | null;
  new_manager: AuditActor | null;
  amount_paise: number | null;
  payment_date: string | null;
  payment_reference: string | null;
}

interface AuditMeta {
  current_page: number;
  last_page: number;
  total: number;
}

interface AuditResponse {
  data: AuditEvent[];
  meta: AuditMeta;
}

const auth = useAuthStore();

const events = ref<AuditEvent[]>([]);
const meta = ref<AuditMeta>({ current_page: 1, last_page: 1, total: 0 });
const page = ref(1);
const requestedPage = ref(1);
const loading = ref(false);
const error = ref('');
const accessDenied = ref(false);

const isAdministrator = computed(() => auth.roles.includes('Administrator'));

const columns: DataTableColumn[] = [
  { key: 'created_at', label: 'Time (Asia/Kolkata)', sortable: true },
  { key: 'actor', label: 'Actor', sortable: true },
  { key: 'report', label: 'Report', sortable: true },
  { key: 'change', label: 'State change', sortable: true },
  { key: 'reason', label: 'Reason', sortable: true },
];

/** "Draft → Submitted", or the reassignment / payment detail when there is no status change. */
function describeChange(event: AuditEvent): string {
  if (event.from_status && event.to_status) {
    return `${event.from_status} → ${event.to_status}`;
  }
  if (event.previous_manager || event.new_manager) {
    const from = event.previous_manager?.name ?? '—';
    const to = event.new_manager?.name ?? '—';
    return `Manager: ${from} → ${to}`;
  }
  if (event.payment_reference) {
    return `Payment ${event.payment_reference}`;
  }
  return event.action;
}

const rows = computed<Record<string, unknown>[]>(() =>
  events.value.map((event) => ({
    id: event.id,
    report_id: event.report_id,
    created_at: event.created_at ?? '',
    actor: event.actor?.name ?? '—',
    report: `#${event.report_id}`,
    change: describeChange(event),
    reason: event.reason ?? '',
  })),
);

const hasPrevious = computed(() => meta.value.current_page > 1);
const hasNext = computed(() => meta.value.current_page < meta.value.last_page);

async function load(target: number): Promise<void> {
  if (!isAdministrator.value) {
    accessDenied.value = true;
    loading.value = false;
    return;
  }

  requestedPage.value = target;
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<AuditResponse>(`/api/admin/audit?page=${target}`);
    events.value = response.data;
    meta.value = response.meta;
    page.value = response.meta.current_page;
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      accessDenied.value = true;
      events.value = [];
      return;
    }
    error.value = e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
  } finally {
    loading.value = false;
  }
}

function goTo(target: number): void {
  if (target < 1 || target > meta.value.last_page) return;
  void load(target);
}

onMounted(() => {
  if (!isAdministrator.value) {
    accessDenied.value = true;
    loading.value = false;
    return;
  }
  void load(1);
});
</script>

<template>
  <AppShell>
    <div class="page audit-page">
      <h1>Audit history</h1>

      <div v-if="accessDenied" class="access-denied" role="alert">
        <p>{{ ACCESS_MESSAGE }}</p>
      </div>

      <template v-else>
        <p class="muted">
          Every audit event, newest first, {{ PAGE_SIZE }} per page. Events are append-only and
          cannot be edited or deleted.
        </p>

        <LoadingState v-if="loading" />

        <ErrorState v-else-if="error" :message="error" @retry="load(requestedPage)" />

        <EmptyState
          v-else-if="events.length === 0"
          title="No audit events yet"
          message="Events appear here as reports are submitted, decided, reassigned and paid."
        />

        <template v-else>
          <DataTable :columns="columns" :rows="rows" row-key="id">
            <template #cell-created_at="{ row }">
              {{ formatDateTime(row.created_at as string) }}
            </template>
            <template #cell-report="{ row }">
              <RouterLink :to="`/reports/${row.report_id}`">#{{ row.report_id }}</RouterLink>
            </template>
          </DataTable>

          <nav class="pager" aria-label="Audit history pages">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!hasPrevious || loading"
              @click="goTo(page - 1)"
            >
              Previous
            </button>
            <span class="pager-status" aria-live="polite">
              Page {{ meta.current_page }} of {{ meta.last_page }} · {{ meta.total }} events
            </span>
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="!hasNext || loading"
              @click="goTo(page + 1)"
            >
              Next
            </button>
          </nav>
        </template>
      </template>
    </div>
  </AppShell>
</template>
