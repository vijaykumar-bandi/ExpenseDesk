<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import DataTable, { type DataTableColumn } from '../components/DataTable.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';
import { formatDateTime } from '../lib/dates';
import { formatInr } from '../lib/money';

interface ReportSummary {
  id: number;
  title: string | null;
  status: string;
  total_paise: number;
  submitted_at: string | null;
  employee: { id: number; name: string } | null;
  waiting_days: number;
}

interface InboxRow extends Record<string, unknown> {
  id: number;
  employeeName: string;
  reportTitle: string;
  submittedAt: string;
  totalPaise: number;
  waitingDays: number;
}

const router = useRouter();
const reports = ref<ReportSummary[]>([]);
const loading = ref(true);
const error = ref('');
const employeeId = ref('');
const submittedFrom = ref('');
const submittedTo = ref('');
const amountMin = ref('');
const amountMax = ref('');

const columns: DataTableColumn[] = [
  { key: 'employeeName', label: 'Employee', sortable: true },
  { key: 'reportTitle', label: 'Report', sortable: true },
  { key: 'submittedAt', label: 'Submitted', sortable: true },
  { key: 'totalPaise', label: 'Total', sortable: true, align: 'right' },
  { key: 'waitingDays', label: 'Waiting', sortable: true },
];

const employees = computed(() => {
  const unique = new Map<number, string>();
  for (const report of reports.value) {
    if (report.employee) unique.set(report.employee.id, report.employee.name);
  }
  return [...unique.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

function rupeesToPaise(value: string | number): number | null {
  if (String(value).trim() === '') return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
}

const kolkataDateFormatter = new Intl.DateTimeFormat('en', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function kolkataCalendarDate(utcIso: string | null): string {
  if (!utcIso) return '';

  const parts = kolkataDateFormatter.formatToParts(new Date(utcIso));
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return year && month && day ? `${year}-${month}-${day}` : '';
}

const filteredReports = computed(() => {
  const minimum = rupeesToPaise(amountMin.value);
  const maximum = rupeesToPaise(amountMax.value);

  return reports.value.filter((report) => {
    const submittedDate = kolkataCalendarDate(report.submitted_at);
    return (!employeeId.value || report.employee?.id === Number(employeeId.value))
      && (!submittedFrom.value || submittedDate >= submittedFrom.value)
      && (!submittedTo.value || submittedDate <= submittedTo.value)
      && (minimum === null || report.total_paise >= minimum)
      && (maximum === null || report.total_paise <= maximum);
  });
});

const rows = computed<InboxRow[]>(() => filteredReports.value.map((report) => ({
  id: report.id,
  employeeName: report.employee?.name ?? '—',
  reportTitle: report.title || 'Untitled report',
  submittedAt: report.submitted_at ?? '',
  totalPaise: report.total_paise,
  waitingDays: report.waiting_days,
})));

const hasFilters = computed(() => Boolean(
  employeeId.value || submittedFrom.value || submittedTo.value || amountMin.value || amountMax.value,
));

const activeChips = computed(() => {
  const chips: string[] = [];
  const employee = employees.value.find((item) => String(item.id) === employeeId.value);
  if (employee) chips.push(employee.name);
  if (submittedFrom.value || submittedTo.value) {
    chips.push(`Submitted: ${submittedFrom.value || 'Any'} – ${submittedTo.value || 'Any'}`);
  }
  if (amountMin.value || amountMax.value) {
    chips.push(`Amount: ${amountMin.value || '0'} – ${amountMax.value || 'Any'}`);
  }
  return chips;
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<{ data: ReportSummary[] }>('/api/reports?scope=inbox');
    reports.value = response.data;
  } catch (caught) {
    const detail = caught instanceof ApiError && caught.message !== 'Something went wrong. Try again.'
      ? ` ${caught.message}`
      : '';
    error.value = `Approval inbox could not be loaded.${detail} Try again.`;
  } finally {
    loading.value = false;
  }
}

function clearFilters(): void {
  employeeId.value = '';
  submittedFrom.value = '';
  submittedTo.value = '';
  amountMin.value = '';
  amountMax.value = '';
}

function openReport(row: Record<string, unknown>): void {
  void router.push(`/reports/${String(row.id)}`);
}

onMounted(load);
</script>

<template>
  <AppShell>
    <div class="page approval-inbox">
      <header class="inbox-head">
        <h1>Approval inbox</h1>
        <p class="inbox-sub">Review expense reports submitted by your team.</p>
      </header>

      <LoadingState v-if="loading" label="Loading the approval inbox…" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <template v-else>
        <form class="filters" aria-label="Filter approval inbox" @submit.prevent>
          <div class="field">
            <label for="filter-employee">Employee</label>
            <select id="filter-employee" v-model="employeeId">
              <option value="">All employees</option>
              <option v-for="employee in employees" :key="employee.id" :value="String(employee.id)">
                {{ employee.name }}
              </option>
            </select>
          </div>

          <fieldset>
            <legend>Submission date</legend>
            <div class="range-inputs">
              <label class="sr-only" for="filter-from">Submitted from</label>
              <input id="filter-from" v-model="submittedFrom" type="date" aria-label="Submitted from" />
              <span aria-hidden="true">to</span>
              <label class="sr-only" for="filter-to">Submitted to</label>
              <input id="filter-to" v-model="submittedTo" type="date" aria-label="Submitted to" />
            </div>
          </fieldset>

          <fieldset>
            <legend>Amount in INR</legend>
            <div class="range-inputs">
              <label class="sr-only" for="filter-amount-min">Minimum amount in INR</label>
              <input id="filter-amount-min" v-model="amountMin" type="number" min="0" step="0.01" placeholder="Minimum" />
              <span aria-hidden="true">to</span>
              <label class="sr-only" for="filter-amount-max">Maximum amount in INR</label>
              <input id="filter-amount-max" v-model="amountMax" type="number" min="0" step="0.01" placeholder="Maximum" />
            </div>
          </fieldset>

          <button v-if="hasFilters" type="button" class="btn btn-secondary clear" @click="clearFilters">
            Clear filters
          </button>
        </form>

        <div v-if="activeChips.length" class="chips" aria-label="Active filters">
          <span v-for="chip in activeChips" :key="chip" class="chip">{{ chip }}</span>
        </div>

        <EmptyState
          v-if="reports.length === 0"
          title="Nothing waiting"
          message="There are no submitted reports waiting for your review."
        />
        <template v-else>
          <div class="inbox-table">
            <DataTable
              :columns="columns"
              :rows="rows"
              row-key="id"
              empty-text="No reports match these filters"
              @row-click="openReport"
            >
              <template #cell-employeeName="{ row }">
                <span class="employee">{{ row.employeeName }}</span>
              </template>
              <template #cell-reportTitle="{ row }">
                <RouterLink class="report-link" :to="`/reports/${row.id}`" @click.stop>
                  {{ row.reportTitle }}
                </RouterLink>
              </template>
              <template #cell-submittedAt="{ row }">
                <span class="submitted">{{ formatDateTime(String(row.submittedAt)) }}</span>
              </template>
              <template #cell-totalPaise="{ row }">
                <span class="amount">{{ formatInr(Number(row.totalPaise)) }}</span>
              </template>
              <template #cell-waitingDays="{ row }">
                <span class="waiting">
                  {{ row.waitingDays }} {{ Number(row.waitingDays) === 1 ? 'day' : 'days' }}
                  <span v-if="Number(row.waitingDays) > 3" class="waiting-label">Waiting 3+ days</span>
                </span>
              </template>
            </DataTable>
          </div>

          <EmptyState v-if="rows.length === 0" class="phone-empty" title="No reports match these filters" />
          <ul v-else class="inbox-cards" aria-label="Reports waiting for approval">
            <li v-for="row in rows" :key="row.id" class="card inbox-card">
              <RouterLink :to="`/reports/${row.id}`" class="card-link">
                <span class="card-top">
                  <span class="card-title">{{ row.reportTitle }}</span>
                  <span class="amount">{{ formatInr(row.totalPaise) }}</span>
                </span>
                <span class="employee">{{ row.employeeName }}</span>
                <span class="card-meta">
                  <span>{{ formatDateTime(row.submittedAt) }}</span>
                  <span class="waiting">
                    {{ row.waitingDays }} {{ row.waitingDays === 1 ? 'day' : 'days' }}
                    <span v-if="row.waitingDays > 3" class="waiting-label">Waiting 3+ days</span>
                  </span>
                </span>
              </RouterLink>
            </li>
          </ul>
        </template>
      </template>
    </div>
  </AppShell>
</template>

<style src="./ApprovalInboxView.css"></style>
