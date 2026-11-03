<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';
import { formatInr } from '../lib/money';
import { formatDate } from '../lib/dates';

interface Summary {
  outstanding_paise: number;
  outstanding_count: number;
  paid_paise: number;
  paid_count: number;
  from: string;
  to: string;
}

interface Payment {
  id: number;
  amount_paise: number;
  payment_date: string;
  payment_reference: string;
  employee: { id: number; name: string } | null;
  report_title: string | null;
}

const summary = ref<Summary | null>(null);
const payments = ref<Payment[]>([]);
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const [summaryResponse, paymentsResponse] = await Promise.all([
      api.get<Summary>('/api/finance/summary'),
      api.get<{ data: Payment[] }>('/api/finance/payments'),
    ]);
    summary.value = summaryResponse;
    payments.value = paymentsResponse.data;
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
      <h1>Finance</h1>
      <LoadingState v-if="loading" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <template v-else-if="summary">
        <div class="cards">
          <div class="card">
            <h2>Approved, unpaid</h2>
            <p class="amount big">{{ formatInr(summary.outstanding_paise) }}</p>
            <p class="muted">{{ summary.outstanding_count }} reports</p>
          </div>
          <div class="card">
            <h2>Paid {{ formatDate(summary.from) }} – {{ formatDate(summary.to) }}</h2>
            <p class="amount big">{{ formatInr(summary.paid_paise) }}</p>
            <p class="muted">{{ summary.paid_count }} payments</p>
          </div>
        </div>

        <h2 class="section">Payment history</h2>
        <EmptyState v-if="payments.length === 0" title="No payments in this period" />
        <ul v-else class="payments">
          <li v-for="payment in payments" :key="payment.id" class="card payment">
            <span>{{ payment.employee?.name ?? '—' }} · {{ payment.report_title || 'Untitled report' }}</span>
            <span class="amount">{{ formatInr(payment.amount_paise) }}</span>
            <span class="muted">{{ formatDate(payment.payment_date) }} · {{ payment.payment_reference }}</span>
          </li>
        </ul>
      </template>
    </div>
  </AppShell>
</template>

<style scoped>
.cards {
  display: grid;
  gap: var(--space-3);
}

@media (min-width: 768px) {
  .cards {
    grid-template-columns: 1fr 1fr;
  }
}

.big {
  font-size: 24px;
  margin: var(--space-2) 0;
}

.muted {
  color: var(--color-muted);
}

.section {
  margin-top: var(--space-6);
}

.payments {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.payment {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: space-between;
}
</style>
