<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, ApiError } from '../api/client';
import { useAuthStore, type CurrentUser } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

async function submit(): Promise<void> {
  error.value = '';
  busy.value = true;
  try {
    const response = await api.post<{ user: CurrentUser }>('/api/login', {
      email: email.value,
      password: password.value,
    });
    auth.setUser(response.user);
    await router.push(auth.home);
  } catch (e) {
    if (e instanceof ApiError) {
      error.value = e.errors.email?.[0] ?? e.message;
    } else {
      error.value = 'Something went wrong. Try again.';
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-card card">
      <h1 class="wordmark">ExpenseDesk</h1>
      <form class="auth-form" @submit.prevent="submit">
        <div class="field">
          <label for="email">Email</label>
          <input id="email" v-model="email" type="email" autocomplete="username" required />
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input id="password" v-model="password" type="password" autocomplete="current-password" required />
        </div>
        <p v-if="error" class="field-error" role="alert">{{ error }}</p>
        <button type="submit" class="btn btn-primary" :disabled="busy">
          {{ busy ? 'Signing in…' : 'Sign in' }}
        </button>
        <RouterLink to="/forgot-password" class="forgot">Forgot password</RouterLink>
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

.forgot {
  text-align: center;
  font-size: 14px;
}
</style>
