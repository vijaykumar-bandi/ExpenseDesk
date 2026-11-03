<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import StatusBadge from '../components/StatusBadge.vue';
import { api, ApiError } from '../api/client';
import { formatInr } from '../lib/money';

interface Report {
  id: number;
  title: string | null;
  business_purpose: string | null;
  status: string;
  total_paise: number;
  employee: { id: number; name: string } | null;
  manager: { id: number; name: string } | null;
}

const route = useRoute();
const report = ref<Report | null>(null);
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<{ data: Report }>(`/api/reports/${route.params.id}`);
    report.value = response.data;
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
      <LoadingState v-if="loading" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <div v-else-if="report" class="card">
        <header class="head">
          <h1>{{ report.title || 'Untitled report' }}</h1>
          <StatusBadge :status="report.status" />
        </header>
        <p class="amount total">{{ formatInr(report.total_paise) }}</p>
        <dl class="meta">
          <dt>Employee</dt>
          <dd>{{ report.employee?.name ?? '—' }}</dd>
          <dt>Manager</dt>
          <dd>{{ report.manager?.name ?? '—' }}</dd>
        </dl>
        <p v-if="report.business_purpose">{{ report.business_purpose }}</p>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.total {
  font-size: 24px;
}

.meta {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-3);
}

dt {
  color: var(--color-muted);
}
</style>
