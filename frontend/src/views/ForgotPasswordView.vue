<script setup lang="ts">
import { ref } from 'vue';
import { api, ApiError } from '../api/client';
import './ForgotPasswordView.css';

const email = ref('');
const message = ref('');
const error = ref('');
const busy = ref(false);

/** The same confirmation whether or not the email has an account (1.6). */
const CONFIRMATION = 'If that email has an account, a reset link has been sent';

async function submit(): Promise<void> {
  if (busy.value) return;

  error.value = '';
  message.value = '';
  busy.value = true;
  try {
    await api.csrf();
    await api.post<{ message: string }>('/api/forgot-password', {
      email: email.value,
    });
    // Use our fixed copy rather than reflecting server data, so known and
    // unknown accounts always produce exactly the same visible answer.
    message.value = CONFIRMATION;
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) {
      error.value = e.errors.email?.[0] ?? 'Enter a valid email address';
    } else if (e instanceof ApiError) {
      error.value = e.message;
    } else {
      error.value = 'Reset link could not be sent. Try again.';
    }
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <div class="auth-card card">
      <h1 class="wordmark">ExpenseDesk</h1>
      <h2 class="auth-title">Forgot password</h2>
      <p class="auth-subtitle">Enter your email and we will send you a reset link.</p>

      <form class="auth-form" novalidate @submit.prevent="submit">
        <div class="field">
          <label for="email">Email</label>
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="username"
            inputmode="email"
            required
            :aria-invalid="error ? 'true' : undefined"
            :aria-describedby="error ? 'forgot-password-error' : undefined"
          />
        </div>

        <p v-if="error" id="forgot-password-error" class="field-error auth-error" role="alert">{{ error }}</p>
        <p v-if="message" class="auth-confirmation" role="status">{{ message }}</p>

        <button type="submit" class="btn btn-primary auth-submit" :disabled="busy" :aria-busy="busy">
          {{ busy ? 'Sending…' : 'Send reset link' }}
        </button>

        <RouterLink to="/sign-in" class="auth-link">Back to sign in</RouterLink>
      </form>
    </div>
  </main>
</template>
