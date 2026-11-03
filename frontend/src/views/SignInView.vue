<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, ApiError } from '../api/client';
import { useAuthStore, type CurrentUser } from '../stores/auth';
import './SignInView.css';

const router = useRouter();
const auth = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref('');
const busy = ref(false);

/** The one message for a wrong password and for a deactivated account (1.3, 1.9). */
const INVALID_CREDENTIALS = 'Email or password is incorrect';
/** The message the API sends once an email has failed 5 times in 15 minutes (1.4). */
const TOO_MANY_ATTEMPTS = 'Too many attempts. Try again in 15 minutes.';

async function submit(): Promise<void> {
  if (busy.value) return;

  error.value = '';
  busy.value = true;
  try {
    await api.csrf();
    const response = await api.post<{ user: CurrentUser }>('/api/login', {
      email: email.value,
      password: password.value,
    });
    auth.setUser(response.user);
    await router.push(auth.home);
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 429) {
        error.value = TOO_MANY_ATTEMPTS;
      } else if (e.status === 422) {
        // The API answers a wrong password and a deactivated account with the
        // same 422 message; the email field keeps what the person typed.
        error.value = INVALID_CREDENTIALS;
      } else {
        error.value = e.message;
      }
    } else {
      error.value = 'Something went wrong. Try again.';
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
            :aria-describedby="error ? 'sign-in-error' : undefined"
          />
        </div>

        <div class="field">
          <label for="password">Password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            name="password"
            autocomplete="current-password"
            required
            :aria-invalid="error ? 'true' : undefined"
            :aria-describedby="error ? 'sign-in-error' : undefined"
          />
        </div>

        <p v-if="error" id="sign-in-error" class="field-error auth-error" role="alert">{{ error }}</p>

        <button type="submit" class="btn btn-primary auth-submit" :disabled="busy" :aria-busy="busy">
          {{ busy ? 'Signing in…' : 'Sign in' }}
        </button>

        <RouterLink to="/forgot-password" class="forgot">Forgot password</RouterLink>
      </form>
    </div>
  </main>
</template>
