<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ApiError } from '../api/client';
import './ResetPasswordView.css';

const route = useRoute();
const router = useRouter();

const password = ref('');
const confirmation = ref('');
const error = ref('');
const invalidLink = ref(false);
const busy = ref(false);

/** The message for a link older than 60 minutes or already used (1.8). */
const INVALID_LINK = 'This reset link is no longer valid';
const MIN_LENGTH = 12;

function validate(): string {
  if (password.value.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters`;
  }
  if (password.value !== confirmation.value) {
    return 'Passwords do not match';
  }
  return '';
}

async function submit(): Promise<void> {
  if (busy.value) return;

  error.value = '';
  invalidLink.value = false;

  const localError = validate();
  if (localError) {
    error.value = localError;
    return;
  }

  busy.value = true;
  try {
    await api.csrf();
    await api.post('/api/reset-password', {
      token: String(route.params.token ?? ''),
      password: password.value,
      password_confirmation: confirmation.value,
    });
    await router.push('/sign-in');
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 422 && (e.errors.token?.length || e.message === INVALID_LINK)) {
        invalidLink.value = true;
        error.value = e.errors.token?.[0] ?? INVALID_LINK;
      } else if (e.status === 422) {
        error.value = e.errors.password?.[0] ?? e.message;
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
      <h2 class="auth-title">Reset password</h2>
      <p class="auth-subtitle">Choose a new password of at least {{ MIN_LENGTH }} characters.</p>

      <form class="auth-form" novalidate @submit.prevent="submit">
        <div class="field">
          <label for="password">New password</label>
          <input
            id="password"
            v-model="password"
            type="password"
            name="password"
            autocomplete="new-password"
            :minlength="MIN_LENGTH"
            required
            :aria-invalid="error ? 'true' : undefined"
            :aria-describedby="error ? 'password-hint reset-password-error' : 'password-hint'"
          />
          <span id="password-hint" class="field-hint">At least {{ MIN_LENGTH }} characters.</span>
        </div>

        <div class="field">
          <label for="confirmation">Confirm new password</label>
          <input
            id="confirmation"
            v-model="confirmation"
            type="password"
            name="password_confirmation"
            autocomplete="new-password"
            :minlength="MIN_LENGTH"
            required
            :aria-invalid="error ? 'true' : undefined"
            :aria-describedby="error ? 'reset-password-error' : undefined"
          />
        </div>

        <p v-if="error" id="reset-password-error" class="field-error auth-error" role="alert">{{ error }}</p>

        <button type="submit" class="btn btn-primary auth-submit" :disabled="busy" :aria-busy="busy">
          {{ busy ? 'Saving…' : 'Set new password' }}
        </button>

        <RouterLink v-if="invalidLink" to="/forgot-password" class="auth-link auth-link-strong">
          Send a new link
        </RouterLink>
        <RouterLink v-else to="/sign-in" class="auth-link">Back to sign in</RouterLink>
      </form>
    </div>
  </main>
</template>
