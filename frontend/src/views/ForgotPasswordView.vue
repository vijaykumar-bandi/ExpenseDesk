<script setup lang="ts">
import { ref } from 'vue';
import { api } from '../api/client';

const email = ref('');
const message = ref('');
const busy = ref(false);

async function submit(): Promise<void> {
  busy.value = true;
  try {
    const response = await api.post<{ message: string }>('/api/forgot-password', { email: email.value });
    message.value = response.message;
  } catch {
    message.value = 'If that email has an account, a reset link has been sent';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <h1 class="wordmark">ExpenseDesk</h1>
      <h2>Forgot password</h2>
      <form class="auth-form" @submit.prevent="submit">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="username" required />
        </div>
        <p v-if="message" role="status">{{ message }}</p>
        <button type="submit" class="btn btn-primary" :disabled="busy">Send reset link</button>
        <RouterLink to="/sign-in" class="back">Back to sign in</RouterLink>
      </form>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.auth-card {
  width: 100%;
  max-width: 400px;
}

.wordmark {
  text-align: center;
  color: var(--color-primary);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.back {
  text-align: center;
  font-size: 14px;
}
</style>
