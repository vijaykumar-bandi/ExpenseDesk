<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, ApiError } from '../api/client';
import { formatDate, formatDateTime } from '../lib/dates';
import { formatInr } from '../lib/money';
import { toast } from '../lib/toast';
import { useAuthStore } from '../stores/auth';

interface Person {
  id: number;
  name: string;
}

interface Receipt {
  id: number;
  file_name: string;
  mime_type: string;
  size: number;
}

interface Line {
  id: number;
  expense_date: string | null;
  category: { id: number; name: string } | null;
  merchant: string | null;
  amount_paise: number;
  note: string | null;
  receipt: Receipt | null;
}

interface AuditEntry {
  id: number;
  action: string;
  actor: Person | null;
  created_at: string | null;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  previous_manager: Person | null;
  new_manager: Person | null;
  amount_paise: number | null;
  payment_date: string | null;
  payment_reference: string | null;
}

interface Reimbursement {
  amount_paise: number;
  payment_date: string | null;
  payment_reference: string | null;
}

interface Report {
  id: number;
  title: string | null;
  business_purpose: string | null;
  status: string;
  total_paise: number;
  employee: Person | null;
  manager: Person | null;
  lines: Line[];
  reimbursement: Reimbursement | null;
  audit: AuditEntry[];
}

interface AdminUser {
  id: number;
  name: string;
  roles: string[];
  active: boolean;
}

type Decision = 'approve' | 'request_changes' | 'reject';

const ACTION_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  approved: 'Approved',
  changes_requested: 'Changes requested',
  rejected: 'Rejected',
  reassigned: 'Reassigned',
  paid: 'Paid',
};

const DECISION_TITLES: Record<Decision, string> = {
  approve: 'Approve this report?',
  request_changes: 'Request changes',
  reject: 'Reject this report',
};

const route = useRoute();
const auth = useAuthStore();

const report = ref<Report | null>(null);
const loading = ref(true);
const error = ref('');
const accessDenied = ref(false);

const decision = ref<Decision | null>(null);
const decisionBusy = ref(false);
const decisionError = ref('');

const reassignOpen = ref(false);
const reassignBusy = ref(false);
const reassignError = ref('');
const managers = ref<AdminUser[]>([]);
const reassignManagerId = ref<number | ''>('');
const reassignReason = ref('');
const reassignDialog = ref<HTMLElement | null>(null);
let reassignReturnFocus: HTMLElement | null = null;

const isAdministrator = computed(() => auth.roles.includes('Administrator'));

/** The decision buttons show only for the report's Manager on a Submitted report. */
const canDecide = computed(() => {
  const current = report.value;
  const me = auth.user;
  if (!current || !me) return false;
  return (
    current.status === 'submitted' &&
    current.manager?.id === me.id &&
    current.employee?.id !== me.id
  );
});

/** An Administrator may reassign the Manager of a Submitted report. */
const canReassign = computed(
  () => isAdministrator.value && report.value?.status === 'submitted',
);

const decisionRequiresReason = computed(
  () => decision.value === 'request_changes' || decision.value === 'reject',
);

const decisionTitle = computed(() =>
  decision.value ? DECISION_TITLES[decision.value] : '',
);

const decisionConfirmLabel = computed(() => {
  if (decision.value === 'approve') return 'Approve';
  if (decision.value === 'request_changes') return 'Request changes';
  return 'Reject';
});

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

function receiptHref(receipt: Receipt): string {
  return `/api/receipts/${receipt.id}`;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  accessDenied.value = false;
  try {
    const response = await api.get<{ data: Report }>(`/api/reports/${route.params.id}`);
    report.value = response.data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      accessDenied.value = true;
      report.value = null;
    } else {
      error.value = e instanceof ApiError ? e.message : 'Something went wrong. Try again.';
    }
  } finally {
    loading.value = false;
  }
}

function openDecision(kind: Decision): void {
  decision.value = kind;
  decisionError.value = '';
}

function closeDecision(): void {
  if (decisionBusy.value) return;
  decision.value = null;
  decisionError.value = '';
}

async function submitDecision(reason: string): Promise<void> {
  if (!decision.value || !report.value) return;
  const kind = decision.value;

  if (decisionRequiresReason.value && reason.length < 10) {
    decisionError.value = 'Reason must be at least 10 characters';
    return;
  }

  decisionBusy.value = true;
  decisionError.value = '';
  try {
    const body: { decision: Decision; reason?: string } = { decision: kind };
    if (decisionRequiresReason.value) body.reason = reason;

    const response = await api.post<{ data: Report }>(
      `/api/reports/${report.value.id}/decision`,
      body,
    );
    report.value = response.data;
    decision.value = null;
    toast(
      kind === 'approve'
        ? 'Report approved'
        : kind === 'request_changes'
          ? 'Changes requested'
          : 'Report rejected',
    );
  } catch (e) {
    if (e instanceof ApiError) {
      decisionError.value = e.errors.reason?.[0] ?? e.message;
      // A 409 carries the report as it now stands; show it and hide the buttons.
      if (e.status === 409) {
        await load();
        decision.value = null;
      }
    } else {
      decisionError.value = 'Something went wrong. Try again.';
    }
  } finally {
    decisionBusy.value = false;
  }
}

async function openReassign(): Promise<void> {
  reassignReturnFocus =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  reassignOpen.value = true;
  reassignError.value = '';
  reassignManagerId.value = '';
  reassignReason.value = '';
  if (managers.value.length === 0) {
    try {
      const response = await api.get<{ data: AdminUser[] }>('/api/admin/users');
      managers.value = response.data.filter(
        (user) => user.active && user.roles.includes('Manager'),
      );
    } catch (e) {
      reassignError.value =
        e instanceof ApiError ? e.message : 'Managers could not be loaded. Try again.';
    }
  }
  await nextTick();
  reassignDialog.value?.querySelector<HTMLElement>('select:not([disabled])')?.focus();
}

function closeReassign(): void {
  if (reassignBusy.value) return;
  reassignOpen.value = false;
  reassignError.value = '';
}

function reassignFocusableElements(): HTMLElement[] {
  if (!reassignDialog.value) return [];
  return Array.from(
    reassignDialog.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  );
}

function handleReassignKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !reassignBusy.value) {
    event.preventDefault();
    closeReassign();
    return;
  }
  if (event.key !== 'Tab') return;

  const elements = reassignFocusableElements();
  if (elements.length === 0) {
    event.preventDefault();
    return;
  }
  const first = elements[0];
  const last = elements[elements.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function submitReassign(): Promise<void> {
  if (!report.value) return;
  const reason = reassignReason.value.trim();

  if (reassignManagerId.value === '') {
    reassignError.value = 'Choose a Manager';
    return;
  }
  if (reason.length < 10) {
    reassignError.value = 'Reason must be at least 10 characters';
    return;
  }

  reassignBusy.value = true;
  reassignError.value = '';
  try {
    await api.post(`/api/admin/reports/${report.value.id}/reassign`, {
      manager_id: reassignManagerId.value,
      reason,
    });
    reassignOpen.value = false;
    toast('Manager reassigned');
    await load();
  } catch (e) {
    if (e instanceof ApiError) {
      reassignError.value = e.errors.reason?.[0] ?? e.message;
    } else {
      reassignError.value = 'Something went wrong. Try again.';
    }
  } finally {
    reassignBusy.value = false;
  }
}

watch(reassignOpen, (open) => {
  if (!open && reassignReturnFocus) {
    reassignReturnFocus.focus();
    reassignReturnFocus = null;
  }
});

onMounted(load);
</script>

<template>
  <AppShell>
    <div class="page">
      <LoadingState v-if="loading" />

      <div v-else-if="accessDenied" class="card access" role="alert">
        <p>You do not have access to this report</p>
      </div>

      <ErrorState v-else-if="error" :message="error" @retry="load" />

      <div v-else-if="report" class="details">
        <section class="main" aria-label="Report">
          <header class="head card">
            <div class="head-top">
              <h1>{{ report.title || 'Untitled report' }}</h1>
              <StatusBadge :status="report.status" />
            </div>
            <p class="amount total">{{ formatInr(report.total_paise) }}</p>
            <dl class="meta">
              <dt>Employee</dt>
              <dd>{{ report.employee?.name ?? '—' }}</dd>
              <dt>Manager</dt>
              <dd>{{ report.manager?.name ?? '—' }}</dd>
            </dl>
            <div class="purpose">
              <h2>Business purpose</h2>
              <p>{{ report.business_purpose || '—' }}</p>
            </div>
          </header>

          <section class="lines" aria-labelledby="lines-heading">
            <h2 id="lines-heading">Expense lines</h2>
            <p v-if="report.lines.length === 0" class="muted">No expense lines yet.</p>
            <ul v-else class="line-list">
              <li v-for="line in report.lines" :key="line.id" class="line card">
                <div class="line-top">
                  <span class="line-category">{{ line.category?.name ?? '—' }}</span>
                  <span class="amount line-amount">{{ formatInr(line.amount_paise) }}</span>
                </div>
                <dl class="line-meta">
                  <dt>Date</dt>
                  <dd>{{ formatDate(line.expense_date) || '—' }}</dd>
                  <dt>Merchant</dt>
                  <dd>{{ line.merchant || '—' }}</dd>
                  <dt>Note</dt>
                  <dd>{{ line.note || '—' }}</dd>
                </dl>
                <p v-if="line.receipt" class="receipt">
                  <a
                    :href="receiptHref(line.receipt)"
                    target="_blank"
                    rel="noopener"
                    :aria-label="`Open receipt ${line.receipt.file_name}`"
                  >
                    {{ line.receipt.file_name }}
                  </a>
                </p>
                <p v-else class="muted receipt">No receipt</p>
              </li>
            </ul>
          </section>
        </section>

        <aside class="side" aria-label="Activity and actions">
          <section v-if="canDecide || canReassign" class="actions card">
            <h2>Actions</h2>
            <div v-if="canDecide" class="action-buttons">
              <button type="button" class="btn btn-primary" @click="openDecision('approve')">
                Approve
              </button>
              <button
                type="button"
                class="btn btn-secondary"
                @click="openDecision('request_changes')"
              >
                Request changes
              </button>
              <button type="button" class="btn btn-danger" @click="openDecision('reject')">
                Reject
              </button>
            </div>
            <button
              v-if="canReassign"
              type="button"
              class="btn btn-secondary reassign"
              @click="openReassign"
            >
              Reassign Manager
            </button>
          </section>

          <section class="history card" aria-labelledby="history-heading">
            <h2 id="history-heading">Activity history</h2>
            <p v-if="report.audit.length === 0" class="muted">No activity yet.</p>
            <ol v-else class="timeline">
              <li v-for="entry in report.audit" :key="entry.id" class="entry">
                <div class="entry-head">
                  <span class="entry-action">{{ actionLabel(entry.action) }}</span>
                  <time class="entry-time" :datetime="entry.created_at ?? undefined">
                    {{ formatDateTime(entry.created_at) }}
                  </time>
                </div>
                <p class="entry-actor">{{ entry.actor?.name ?? 'Unknown' }}</p>
                <p v-if="entry.reason" class="entry-reason">{{ entry.reason }}</p>
                <p v-if="entry.action === 'reassigned'" class="entry-detail">
                  From {{ entry.previous_manager?.name ?? '—' }} to
                  {{ entry.new_manager?.name ?? '—' }}
                </p>
                <p v-if="entry.action === 'paid'" class="entry-detail">
                  {{ formatInr(entry.amount_paise) }} paid on
                  {{ formatDate(entry.payment_date) || '—' }} · Ref
                  {{ entry.payment_reference || '—' }}
                </p>
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </div>

    <ConfirmDialog
      :open="decision !== null"
      :title="decisionTitle"
      :message="
        decisionRequiresReason
          ? 'Give a reason of at least 10 characters.'
          : 'This records your decision in the activity history.'
      "
      :confirm-label="decisionConfirmLabel"
      :require-reason="decisionRequiresReason"
      :reason-label="decisionRequiresReason ? 'Reason' : 'Reason (optional)'"
      :busy="decisionBusy"
      @confirm="submitDecision"
      @cancel="closeDecision"
    />
    <p v-if="decisionError" class="dialog-error" role="alert">{{ decisionError }}</p>

    <div
      v-if="reassignOpen"
      ref="reassignDialog"
      class="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Reassign Manager"
      @keydown="handleReassignKeydown"
    >
      <div class="dialog card">
        <h2>Reassign Manager</h2>
        <div class="field">
          <label for="reassign-manager">New Manager</label>
          <select id="reassign-manager" v-model="reassignManagerId">
            <option value="">Choose a Manager</option>
            <option v-for="manager in managers" :key="manager.id" :value="manager.id">
              {{ manager.name }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="reassign-reason">Reason</label>
          <textarea id="reassign-reason" v-model="reassignReason" rows="3" />
        </div>
        <p v-if="reassignError" class="field-error" role="alert">{{ reassignError }}</p>
        <div class="dialog-actions">
          <button
            type="button"
            class="btn btn-secondary"
            :disabled="reassignBusy"
            @click="closeReassign"
          >
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary"
            :disabled="reassignBusy"
            @click="submitReassign"
          >
            Reassign
          </button>
        </div>
      </div>
    </div>
  </AppShell>
</template>

<style scoped src="./ReportDetailsView.css"></style>
