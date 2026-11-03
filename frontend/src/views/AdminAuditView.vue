<script setup lang="ts">
import { onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';
import { formatDateTime } from '../lib/dates';

interface AuditEvent {
  id: number;
  action: string;
  actor: { id: number; name: string } | null;
  created_at: string | null;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
}

const events = ref<AuditEvent[]>([]);
const loading = ref(true);
const error = ref('');

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<{ data: AuditEvent[] }>('/api/admin/audit');
    events.value = response.data;
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
      <h1>Audit history</h1>
      <LoadingState v-if="loading" />
      <ErrorState v-else-if="error" :message="error" @retry="load" />
      <EmptyState v-else-if="events.length === 0" title="No audit events yet" />
      <ul v-else class="list">
        <li v-for="event in events" :key="event.id" class="card row">
          <span class="action">{{ event.action }}</span>
          <span>{{ event.actor?.name ?? '—' }}</span>
          <span class="muted">{{ formatDateTime(event.created_at) }}</span>
          <span v-if="event.reason" class="muted">{{ event.reason }}</span>
        </li>
      </ul>
    </div>
  </AppShell>
</template>

<style scoped>
.list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}

.action {
  font-weight: 600;
}

.muted {
  color: var(--color-muted);
}
</style>
