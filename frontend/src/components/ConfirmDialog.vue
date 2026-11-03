<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    requireReason?: boolean;
    reasonLabel?: string;
    busy?: boolean;
  }>(),
  {
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    requireReason: false,
    reasonLabel: 'Reason',
    busy: false,
  },
);

const emit = defineEmits<{
  (e: 'confirm', reason: string): void;
  (e: 'cancel'): void;
}>();

const reason = ref('');
const dialog = ref<HTMLElement | null>(null);
let returnFocus: HTMLElement | null = null;

function focusableElements(): HTMLElement[] {
  if (!dialog.value) return [];
  return Array.from(
    dialog.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    ),
  );
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      reason.value = '';
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      void nextTick(() => focusableElements()[0]?.focus());
    } else if (returnFocus) {
      returnFocus.focus();
      returnFocus = null;
    }
  },
);

function confirm(): void {
  emit('confirm', reason.value.trim());
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && !props.busy) {
    event.preventDefault();
    emit('cancel');
    return;
  }
  if (event.key !== 'Tab') return;

  const elements = focusableElements();
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
</script>

<template>
  <div
    v-if="open"
    ref="dialog"
    class="overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    @keydown="handleKeydown"
  >
    <div class="dialog card">
      <h2>{{ title }}</h2>
      <p v-if="message">{{ message }}</p>
      <div v-if="requireReason" class="field">
        <label for="confirm-reason">{{ reasonLabel }}</label>
        <textarea id="confirm-reason" v-model="reason" rows="3" />
      </div>
      <div class="actions">
        <button type="button" class="btn btn-secondary" :disabled="busy" @click="emit('cancel')">
          {{ cancelLabel }}
        </button>
        <button type="button" class="btn btn-primary" :disabled="busy" @click="confirm">
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(27, 31, 42, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: 50;
}

.dialog {
  width: 100%;
  max-width: 420px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
</style>
