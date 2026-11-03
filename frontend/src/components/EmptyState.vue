<script setup lang="ts">
defineProps<{ title: string; message?: string }>();
</script>

<template>
  <div class="state">
    <h3>{{ title }}</h3>
    <p v-if="message">{{ message }}</p>
    <slot />
  </div>
</template>

<style scoped>
.state {
  text-align: center;
  padding: var(--space-8) var(--space-4);
  color: var(--color-muted);
  background: var(--color-surface);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-card);
}

h3 {
  color: var(--color-text);
}
</style>
