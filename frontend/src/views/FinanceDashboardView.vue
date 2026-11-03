<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import DataTable, { type DataTableColumn } from '../components/DataTable.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';
import { formatInr } from '../lib/money';
import { formatDate, formatDateTime, todayInKolkata } from '../lib/dates';
import { toast } from '../lib/toast';
import './FinanceDashboardView.css';

interface Summary {
  outstanding_paise: number;
  outstanding_count: number;
  paid_paise: number;
  paid_count: number;
  from: string;
  to: string;
}

interface OutstandingReport {
  id: number;
  title: string | null;
  status: string;
  total_paise: number;
  submitted_at: string | null;
  decided_at: string | null;
  employee: { id: number; name: string } | null;
  manager: { id: number; name: string } | null;
  waiting_days: number;
}

interface Payment {
  id: number;
  report_id: number;
  amount_paise: number;
  payment_date: string;
  payment_reference: string;
  employee: { id: number; name: string } | null;
  report_title: string | null;
  recorded_by: { id: number; name: string } | null;
  created_at: string | null;
}

const route = useRoute();
const router = useRouter();

/** First and last day of the current month in Asia/Kolkata, as YYYY-MM-DD. */
function currentMonth(): { from: string; to: string } {
  const today = todayInKolkata();
  const [year, month] = today.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, '0');
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(lastDay).padStart(2, '0')}` };
}

function queryString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

const month = currentMonth();
const from = ref(queryString(route.query.from) || month.from);
const to = ref(queryString(route.query.to) || month.to);
const search = ref(queryString(route.query.q));

const summary = ref<Summary | null>(null);
const outstanding = ref<OutstandingReport[]>([]);
const payments = ref<Payment[]>([]);
const loading = ref(true);
const error = ref('');

const outstandingColumns: DataTableColumn[] = [
  { key: 'employee', label: 'Employee', sortable: true },
  { key: 'title', label: 'Report', sortable: true },
  { key: 'approved_at', label: 'Approved', sortable: true },
  { key: 'total_paise', label: 'Total', sortable: true, align: 'right' },
  { key: 'actions', label: '', align: 'right' },
];

const paymentColumns: DataTableColumn[] = [
  { key: 'payment_date', label: 'Payment date', sortable: true },
  { key: 'payment_reference', label: 'Reference', sortable: true },
  { key: 'employee', label: 'Employee', sortable: true },
  { key: 'report_title', label: 'Report', sortable: true },
  { key: 'amount_paise', label: 'Amount', sortable: true, align: 'right' },
];

const outstandingRows = computed<Record<string, unknown>[]>(() =>
  outstanding.value.map((report) => ({
    id: report.id,
    employee: report.employee?.name ?? '—',
    title: report.title || 'Untitled report',
    approved_at: report.decided_at ?? report.submitted_at,
    total_paise: report.total_paise,
  })),
);

const paymentRows = computed<Record<string, unknown>[]>(() =>
  payments.value.map((payment) => ({
    id: payment.id,
    payment_date: payment.payment_date,
    payment_reference: payment.payment_reference,
    employee: payment.employee?.name ?? '—',
    report_title: payment.report_title || 'Untitled report',
    amount_paise: payment.amount_paise,
  })),
);

function periodQuery(): string {
  const params = new URLSearchParams({ from: from.value, to: to.value });
  if (search.value.trim() !== '') params.set('q', search.value.trim());
  return params.toString();
}

let latestLoad = 0;

async function load(): Promise<void> {
  const loadId = ++latestLoad;
  loading.value = true;
  error.value = '';
  const query = periodQuery();
  try {
    const [summaryResponse, outstandingResponse, paymentsResponse] = await Promise.all([
      api.get<Summary>(`/api/finance/summary?${query}`),
      api.get<{ data: OutstandingReport[] }>('/api/finance/outstanding'),
      api.get<{ data: Payment[] }>(`/api/finance/payments?${query}`),
    ]);
    if (loadId === latestLoad) {
      summary.value = summaryResponse;
      outstanding.value = outstandingResponse.data;
      payments.value = paymentsResponse.data;
    }
  } catch (e) {
    if (loadId === latestLoad) {
      error.value = e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
    }
  } finally {
    if (loadId === latestLoad) loading.value = false;
  }
}

/** Keep the period and search in the URL, as the design requires. */
function syncUrl(): void {
  const query: Record<string, string> = { from: from.value, to: to.value };
  if (search.value.trim() !== '') query.q = search.value.trim();
  void router.replace({ query });
}

function applyFilters(): void {
  syncUrl();
  void load();
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, () => {
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(applyFilters, 250);
});

onBeforeUnmount(() => {
  if (searchTimer) clearTimeout(searchTimer);
});

// --- Record payment dialog -------------------------------------------------

const dialogOpen = ref(false);
const dialogReport = ref<OutstandingReport | null>(null);
const paymentDate = ref('');
const paymentReference = ref('');
const dialogError = ref('');
const fieldErrors = ref<Record<string, string>>({});
const saving = ref(false);
const dialogElement = ref<HTMLElement | null>(null);
let dialogTrigger: HTMLButtonElement | null = null;

function focusableDialogElements(): HTMLElement[] {
  if (!dialogElement.value) return [];

  return Array.from(
    dialogElement.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function restoreDialogTrigger(): void {
  const trigger = dialogTrigger;
  dialogTrigger = null;
  void nextTick(() => trigger?.focus());
}

function openDialog(report: OutstandingReport, event: MouseEvent): void {
  dialogTrigger = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null;
  dialogReport.value = report;
  paymentDate.value = todayInKolkata();
  paymentReference.value = '';
  dialogError.value = '';
  fieldErrors.value = {};
  dialogOpen.value = true;
  void nextTick(() => focusableDialogElements()[0]?.focus());
}

function closeDialog(): void {
  if (saving.value) return;
  dialogOpen.value = false;
  dialogReport.value = null;
  restoreDialogTrigger();
}

function handleDialogKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeDialog();
    return;
  }

  if (event.key !== 'Tab') return;
  const focusable = focusableDialogElements();
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function validate(): boolean {
  const errors: Record<string, string> = {};
  if (!paymentDate.value) {
    errors.payment_date = 'Payment date is required';
  } else if (paymentDate.value > todayInKolkata()) {
    errors.payment_date = 'Payment date cannot be in the future';
  }
  if (paymentReference.value.trim().length < 3) {
    errors.payment_reference = 'Payment reference must be at least 3 characters';
  }
  fieldErrors.value = errors;
  return Object.keys(errors).length === 0;
}

async function confirmPayment(): Promise<void> {
  if (!dialogReport.value || saving.value) return;
  dialogError.value = '';
  if (!validate()) return;

  saving.value = true;
  try {
    await api.post(`/api/reports/${dialogReport.value.id}/reimbursement`, {
      payment_date: paymentDate.value,
      payment_reference: paymentReference.value.trim(),
    });
    toast('Payment recorded');
    dialogOpen.value = false;
    dialogReport.value = null;
    restoreDialogTrigger();
    await load();
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      dialogError.value = 'This report was already paid';
      await load();
    } else if (e instanceof ApiError && e.status === 422) {
      const errors: Record<string, string> = {};
      for (const [key, messages] of Object.entries(e.errors)) {
        if (messages.length > 0) errors[key] = messages[0];
      }
      fieldErrors.value = errors;
      if (Object.keys(errors).length === 0) dialogError.value = e.message;
    } else {
      dialogError.value = e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
    }
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AppShell>
    <div class="page finance">
      <h1>Finance</h1>

      <LoadingState v-if="loading" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <template v-else-if="summary">
        <div class="cards">
          <div class="card summary-card">
            <h2>Approved, unpaid</h2>
            <p class="amount big" data-testid="outstanding-total">{{ formatInr(summary.outstanding_paise) }}</p>
            <p class="muted">{{ summary.outstanding_count }} reports</p>
          </div>
          <div class="card summary-card">
            <h2>Paid {{ formatDate(summary.from) }} – {{ formatDate(summary.to) }}</h2>
            <p class="amount big" data-testid="paid-total">{{ formatInr(summary.paid_paise) }}</p>
            <p class="muted">{{ summary.paid_count }} payments</p>
          </div>
        </div>

        <div class="filters">
          <div class="field">
            <label for="period-from">From</label>
            <input id="period-from" v-model="from" type="date" @change="applyFilters" />
          </div>
          <div class="field">
            <label for="period-to">To</label>
            <input id="period-to" v-model="to" type="date" @change="applyFilters" />
          </div>
        </div>

        <h2 class="section">Approved, unpaid</h2>
        <EmptyState
          v-if="outstanding.length === 0"
          title="Nothing to pay"
          message="No approved reports are waiting for reimbursement."
        />
        <DataTable v-else :columns="outstandingColumns" :rows="outstandingRows" empty-text="No approved reports.">
          <template #cell-approved_at="{ row }">{{ formatDateTime(String(row.approved_at ?? '')) }}</template>
          <template #cell-total_paise="{ row }">{{ formatInr(Number(row.total_paise)) }}</template>
          <template #cell-actions="{ row }">
            <button
              type="button"
              class="btn btn-primary record"
              @click.stop="openDialog(outstanding.find((r) => r.id === row.id)!, $event)"
            >
              Record payment
            </button>
          </template>
        </DataTable>

        <h2 class="section">Payment history</h2>
        <div class="field search">
          <label for="payment-search">Search</label>
          <input
            id="payment-search"
            v-model="search"
            type="search"
            placeholder="Employee, report or reference"
          />
        </div>
        <EmptyState v-if="payments.length === 0" title="No payments in this period" />
        <DataTable v-else :columns="paymentColumns" :rows="paymentRows" empty-text="No payments match.">
          <template #cell-payment_date="{ row }">{{ formatDate(String(row.payment_date)) }}</template>
          <template #cell-amount_paise="{ row }">{{ formatInr(Number(row.amount_paise)) }}</template>
        </DataTable>
      </template>
      <div
        v-if="dialogOpen && dialogReport"
        class="finance-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-dialog-title"
        @keydown="handleDialogKeydown"
      >
      <div ref="dialogElement" class="finance-dialog card">
        <h2 id="payment-dialog-title">Record payment</h2>
        <p class="muted">
          {{ dialogReport.employee?.name ?? '—' }} · {{ dialogReport.title || 'Untitled report' }}
        </p>

        <div class="field">
          <label for="payment-date">Payment date</label>
          <input
            id="payment-date"
            v-model="paymentDate"
            type="date"
            :max="todayInKolkata()"
            :aria-invalid="Boolean(fieldErrors.payment_date)"
            aria-describedby="payment-date-error"
          />
          <p v-if="fieldErrors.payment_date" id="payment-date-error" class="error">{{ fieldErrors.payment_date }}</p>
        </div>

        <div class="field">
          <label for="payment-reference">Payment reference</label>
          <input
            id="payment-reference"
            v-model="paymentReference"
            type="text"
            minlength="3"
            required
            :aria-invalid="Boolean(fieldErrors.payment_reference)"
            aria-describedby="payment-reference-error"
          />
          <p v-if="fieldErrors.payment_reference" id="payment-reference-error" class="error">
            {{ fieldErrors.payment_reference }}
          </p>
        </div>

        <div class="field">
          <label for="payment-amount">Amount</label>
          <input
            id="payment-amount"
            class="amount"
            type="text"
            :value="formatInr(dialogReport.total_paise)"
            readonly
            aria-readonly="true"
          />
        </div>

        <p v-if="dialogError" class="error" role="alert">{{ dialogError }}</p>

        <div class="actions">
          <button type="button" class="btn btn-secondary" :disabled="saving" @click="closeDialog">Cancel</button>
          <button type="button" class="btn btn-primary" :disabled="saving" @click="confirmPayment">
            Confirm payment
          </button>
        </div>
      </div>
    </div>
    </div>
  </AppShell>
</template>
