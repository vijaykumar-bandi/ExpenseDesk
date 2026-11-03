<script setup lang="ts">
defineProps<{ message: string }>();
const emit = defineEmits<{ (e: 'retry'): void }>();
</script>

<template>
  <div class="state" role="alert">
    <p>{{ message }}</p>
    <button type="button" class="btn btn-secondary" @click="emit('retry')">Try again</button>
  </div>
</template>

<style scoped>
.state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4);
  background: var(--color-error-surface);
  color: var(--color-error);
  border-radius: var(--radius-card);
}
</style>
