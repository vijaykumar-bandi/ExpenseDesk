<script setup lang="ts">
import { ref, watch } from 'vue';

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

watch(
  () => props.open,
  (open) => {
    if (open) reason.value = '';
  },
);

function confirm(): void {
  emit('confirm', reason.value.trim());
}
</script>

<template>
  <div v-if="open" class="overlay" role="dialog" aria-modal="true" :aria-label="title">
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
