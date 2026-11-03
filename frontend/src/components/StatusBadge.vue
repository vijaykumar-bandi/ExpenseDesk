<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ status: string }>();

const LABELS: Record<string, string> = {
  draft: 'Draft',
  submitted: 'Awaiting approval',
  changes_requested: 'Changes requested',
  approved: 'Approved',
  paid: 'Paid',
  rejected: 'Rejected',
};

const label = computed(() => LABELS[props.status] ?? props.status);
</script>

<template>
  <span class="badge" :class="`badge-${status}`">{{ label }}</span>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: var(--radius-badge);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.badge-draft {
  background: var(--color-disabled-bg);
  color: var(--color-muted);
}

.badge-submitted,
.badge-changes_requested {
  background: var(--color-warning-surface);
  color: var(--color-warning);
}

.badge-approved,
.badge-paid {
  background: var(--color-success-surface);
  color: var(--color-success);
}

.badge-rejected {
  background: var(--color-error-surface);
  color: var(--color-error);
}
</style>
