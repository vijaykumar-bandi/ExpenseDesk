<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import EmptyState from '../components/EmptyState.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';
import { toast } from '../lib/toast';
import { useAuthStore } from '../stores/auth';
import './AdminCategoriesView.css';

interface Category {
  id: number;
  name: string;
  active: boolean;
}

const auth = useAuthStore();

const categories = ref<Category[]>([]);
const loading = ref(true);
const error = ref('');
const saving = ref(false);

const dialogOpen = ref(false);
const newName = ref('');
const nameError = ref('');
const nameInput = ref<HTMLInputElement | null>(null);
const dialog = ref<HTMLElement | null>(null);
let dialogOpener: HTMLElement | null = null;

const isAdministrator = computed(() => auth.roles.includes('Administrator'));
const activeCount = computed(() => categories.value.filter((c) => c.active).length);

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<{ data: Category[] }>('/api/admin/categories');
    categories.value = response.data;
  } catch (e) {
    if (e instanceof ApiError && e.status === 403) {
      error.value = 'You do not have access to this page';
    } else {
      error.value = 'Categories could not be loaded. Try again.';
    }
  } finally {
    loading.value = false;
  }
}

function openDialog(event?: Event): void {
  dialogOpener = event?.currentTarget instanceof HTMLElement
    ? event.currentTarget
    : document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
  newName.value = '';
  nameError.value = '';
  dialogOpen.value = true;
  void nextTick(() => nameInput.value?.focus());
}

function restoreDialogOpener(): void {
  const opener = dialogOpener;
  dialogOpener = null;
  void nextTick(() => opener?.focus());
}

function closeDialog(): void {
  if (saving.value) return;
  dialogOpen.value = false;
  restoreDialogOpener();
}

function trapDialogFocus(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeDialog();
    return;
  }

  if (event.key !== 'Tab') return;

  const focusable = Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      'input:not(:disabled), button:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  );
  if (focusable.length === 0) {
    event.preventDefault();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

async function addCategory(): Promise<void> {
  const name = newName.value.trim();
  if (!name) {
    nameError.value = 'Enter a category name.';
    return;
  }

  saving.value = true;
  nameError.value = '';
  try {
    const response = await api.post<{ data: Category }>('/api/admin/categories', { name });
    categories.value = [...categories.value, response.data].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    dialogOpen.value = false;
    restoreDialogOpener();
    toast(`Category "${response.data.name}" added.`);
  } catch (e) {
    if (e instanceof ApiError && e.errors.name?.length) {
      nameError.value = `${e.errors.name[0]} Choose another name and try again.`;
    } else if (e instanceof ApiError) {
      nameError.value = `${e.message} Check the name and try again.`;
    } else {
      nameError.value = 'Could not add the category. Try again.';
    }
  } finally {
    saving.value = false;
  }
}

async function setActive(category: Category, active: boolean): Promise<void> {
  saving.value = true;
  try {
    const response = await api.patch<{ data: Category }>(`/api/admin/categories/${category.id}`, {
      active,
    });
    categories.value = categories.value.map((c) => (c.id === category.id ? response.data : c));
    toast(
      active
        ? `Category "${category.name}" activated.`
        : `Category "${category.name}" deactivated. It stays on the reports that already use it.`,
    );
  } catch (e) {
    const message = e instanceof ApiError ? e.message : 'Something went wrong.';
    toast(`Could not update "${category.name}". ${message} Try again.`, 'error');
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  if (isAdministrator.value) {
    void load();
  } else {
    loading.value = false;
  }
});
</script>

<template>
  <AppShell>
    <div class="page admin-categories-page">
      <div class="admin-categories-header">
        <div>
          <h1>Categories</h1>
          <p class="admin-categories-muted">
            A deactivated category stays on the reports that already use it.
          </p>
        </div>
        <button
          v-if="isAdministrator && !error"
          type="button"
          class="btn btn-primary"
          @click="openDialog"
        >
          Add category
        </button>
      </div>

      <div v-if="!isAdministrator" class="card admin-categories-access" role="alert">
        <p>You do not have access to this page</p>
      </div>

      <template v-else>
        <LoadingState v-if="loading" />
        <div
          v-else-if="error === 'You do not have access to this page'"
          class="card admin-categories-access"
          role="alert"
        >
          <p>{{ error }}</p>
        </div>
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <EmptyState
          v-else-if="categories.length === 0"
          title="No categories yet"
          message="Add a category to offer it in the report editor."
        >
          <button type="button" class="btn btn-primary" @click="openDialog">Add category</button>
        </EmptyState>
        <template v-else>
          <p class="admin-categories-muted admin-categories-summary">
            {{ activeCount }} active of {{ categories.length }} categories
          </p>
          <ul class="admin-categories-list">
            <li v-for="category in categories" :key="category.id" class="card admin-category-row">
              <span class="admin-category-name">{{ category.name }}</span>
              <span
                class="admin-category-state"
                :class="category.active ? 'admin-category-active' : 'admin-category-inactive'"
              >
                {{ category.active ? 'Active' : 'Deactivated' }}
              </span>
              <button
                type="button"
                class="btn btn-secondary"
                :disabled="saving"
                :aria-label="`${category.active ? 'Deactivate' : 'Activate'} ${category.name}`"
                @click="setActive(category, !category.active)"
              >
                {{ category.active ? 'Deactivate' : 'Activate' }}
              </button>
            </li>
          </ul>
        </template>
      </template>
    </div>

    <div
      v-if="dialogOpen"
      ref="dialog"
      class="admin-category-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-category-title"
      @keydown="trapDialogFocus"
    >
      <form class="admin-category-dialog card" @submit.prevent="addCategory">
        <h2 id="add-category-title">Add category</h2>
        <div class="field">
          <label for="category-name">Name</label>
          <input
            id="category-name"
            ref="nameInput"
            v-model="newName"
            type="text"
            maxlength="100"
            :aria-invalid="nameError ? 'true' : 'false'"
            aria-describedby="category-name-error"
          />
          <p v-if="nameError" id="category-name-error" class="field-error" role="alert">
            {{ nameError }}
          </p>
        </div>
        <div class="admin-category-actions">
          <button type="button" class="btn btn-secondary" :disabled="saving" @click="closeDialog">
            Cancel
          </button>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Adding…' : 'Add category' }}
          </button>
        </div>
      </form>
    </div>
  </AppShell>
</template>
