<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';

export interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error';
}

const toasts = ref<Toast[]>([]);
let nextId = 1;

function show(message: string, variant: Toast['variant'] = 'success'): void {
  const id = nextId++;
  toasts.value.push({ id, message, variant });
  window.setTimeout(() => dismiss(id), 5000);
}

function dismiss(id: number): void {
  toasts.value = toasts.value.filter((toast) => toast.id !== id);
}

function onToast(event: Event): void {
  const detail = (event as CustomEvent<{ message: string; variant?: Toast['variant'] }>).detail;
  if (detail?.message) show(detail.message, detail.variant ?? 'success');
}

onMounted(() => window.addEventListener('expensedesk:toast', onToast));
onBeforeUnmount(() => window.removeEventListener('expensedesk:toast', onToast));

defineExpose({ show });
</script>

<template>
  <div class="toast-host" aria-live="polite">
    <div v-for="toast in toasts" :key="toast.id" class="toast" :class="`toast-${toast.variant}`">
      {{ toast.message }}
    </div>
  </div>
</template>

<style scoped>
.toast-host {
  position: fixed;
  bottom: var(--space-4);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: 60;
}

.toast {
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-field);
  box-shadow: 0 4px 16px rgba(27, 31, 42, 0.15);
  font-weight: 600;
}

.toast-success {
  background: var(--color-success-surface);
  color: var(--color-success);
}

.toast-error {
  background: var(--color-error-surface);
  color: var(--color-error);
}

@media (min-width: 768px) {
  .toast-host {
    left: auto;
    right: var(--space-6);
    transform: none;
  }
}
</style>
