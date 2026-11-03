<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError } from '../api/client';

const route = useRoute();
const router = useRouter();

const password = ref('');
const confirmation = ref('');
const error = ref('');
const busy = ref(false);

async function submit(): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    await api.post('/api/reset-password', {
      token: String(route.params.token ?? ''),
      password: password.value,
      password_confirmation: confirmation.value,
    });
    await router.push('/sign-in');
  } catch (e) {
    error.value = e instanceof ApiError ? e.errors.token?.[0] ?? e.message : 'Something went wrong. Try again.';
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <h1 class="wordmark">ExpenseDesk</h1>
      <h2>Reset password</h2>
      <form class="auth-form" @submit.prevent="submit">
        <div class="field">
          <label for="password">New password</label>
          <input id="password" v-model="password" type="password" autocomplete="new-password" minlength="12" required />
        </div>
        <div class="field">
          <label for="confirmation">Confirm new password</label>
          <input id="confirmation" v-model="confirmation" type="password" autocomplete="new-password" minlength="12" required />
        </div>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <button type="submit" class="btn btn-primary" :disabled="busy">Set new password</button>
        <RouterLink to="/forgot-password" class="back">Send a new link</RouterLink>
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
