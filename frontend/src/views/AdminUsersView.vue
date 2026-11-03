<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref } from 'vue';
import AppShell from '../components/AppShell.vue';
import ConfirmDialog from '../components/ConfirmDialog.vue';
import DataTable, { type DataTableColumn } from '../components/DataTable.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';
import { toast } from '../lib/toast';
import { useAuthStore } from '../stores/auth';
import './AdminUsersView.css';

const ROLES = ['Employee', 'Manager', 'Finance', 'Administrator'] as const;
type RoleName = (typeof ROLES)[number];

interface AdminUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
  manager_id: number | null;
  manager_name: string | null;
  active: boolean;
}

interface ReportSummary {
  id: number;
  title: string | null;
  status: string;
  employee: { id: number; name: string } | null;
  manager: { id: number; name: string } | null;
}

const auth = useAuthStore();
const isAdministrator = computed(() => auth.roles.includes('Administrator'));

const columns: DataTableColumn[] = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'roles', label: 'Roles', sortable: true },
  { key: 'manager_name', label: 'Manager', sortable: true },
  { key: 'active', label: 'Active', sortable: true },
  { key: 'actions', label: 'Actions' },
];

const users = ref<AdminUser[]>([]);
const rows = ref<Record<string, unknown>[]>([]);
const loading = ref(true);
const error = ref('');

const addDialog = ref<HTMLElement | null>(null);
const editDialog = ref<HTMLElement | null>(null);
const reassignDialog = ref<HTMLElement | null>(null);
let dialogReturnFocus: HTMLElement | null = null;

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

async function focusDialog(dialog: typeof addDialog): Promise<void> {
  dialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  await nextTick();
  dialog.value?.querySelector<HTMLElement>(focusableSelector)?.focus();
}

async function restoreDialogFocus(): Promise<void> {
  await nextTick();
  dialogReturnFocus?.focus();
  dialogReturnFocus = null;
}

function trapDialogFocus(event: KeyboardEvent, dialog: HTMLElement | null, close: () => void): void {
  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }
  if (event.key !== 'Tab' || !dialog) return;

  const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector));
  if (focusable.length === 0) return;
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

const managers = computed(() => users.value.filter((user) => user.roles.includes('Manager') && user.active));

function toRows(): void {
  rows.value = users.value.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.roles.join(', '),
    manager_name: user.manager_name ?? '—',
    active: user.active ? 'Active' : 'Deactivated',
  }));
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get<{ data: AdminUser[] }>('/api/admin/users');
    users.value = response.data;
    toRows();
  } catch (e) {
    error.value = e instanceof ApiError ? e.message : 'Users could not be loaded. Try again.';
  } finally {
    loading.value = false;
  }
}

/* ---------- Add user ---------- */

const addOpen = ref(false);
const addBusy = ref(false);
const addErrors = ref<Record<string, string>>({});
const addForm = reactive({
  name: '',
  email: '',
  roles: [] as RoleName[],
  password: '',
});

async function openAdd(): Promise<void> {
  addForm.name = '';
  addForm.email = '';
  addForm.roles = [];
  addForm.password = '';
  addErrors.value = {};
  addOpen.value = true;
  await focusDialog(addDialog);
}

function closeAdd(): void {
  if (addBusy.value) return;
  addOpen.value = false;
  void restoreDialogFocus();
}

function toggleAddRole(role: RoleName): void {
  const index = addForm.roles.indexOf(role);
  if (index >= 0) addForm.roles.splice(index, 1);
  else addForm.roles.push(role);
}

function validateAdd(): boolean {
  const errors: Record<string, string> = {};
  if (!addForm.name.trim()) errors.name = 'Required';
  if (!addForm.email.trim()) errors.email = 'Required';
  if (addForm.roles.length === 0) errors.roles = 'Choose at least one role';
  if (addForm.password.length < 12) errors.password = 'Password must be at least 12 characters';
  addErrors.value = errors;
  return Object.keys(errors).length === 0;
}

async function submitAdd(): Promise<void> {
  if (!validateAdd()) return;
  addBusy.value = true;
  try {
    await api.post('/api/admin/users', {
      name: addForm.name.trim(),
      email: addForm.email.trim(),
      roles: addForm.roles,
      password: addForm.password,
    });
    addBusy.value = false;
    closeAdd();
    toast('User created');
    await load();
  } catch (e) {
    if (e instanceof ApiError) {
      const fieldErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(e.errors)) {
        fieldErrors[field.split('.')[0]] = messages[0];
      }
      addErrors.value = fieldErrors;
      toast(e.message, 'error');
    } else {
      toast('The user could not be created. Try again.', 'error');
    }
  } finally {
    addBusy.value = false;
  }
}

/* ---------- Edit user ---------- */

const editOpen = ref(false);
const editBusy = ref(false);
const editErrors = ref<Record<string, string>>({});
const editTarget = ref<AdminUser | null>(null);
const editForm = reactive({
  roles: [] as RoleName[],
  manager_id: '' as string,
  active: true,
});

async function openEdit(user: AdminUser): Promise<void> {
  editTarget.value = user;
  editForm.roles = user.roles.filter((role): role is RoleName => (ROLES as readonly string[]).includes(role));
  editForm.manager_id = user.manager_id === null ? '' : String(user.manager_id);
  editForm.active = user.active;
  editErrors.value = {};
  editOpen.value = true;
  await focusDialog(editDialog);
}

function closeEdit(): void {
  editOpen.value = false;
  editTarget.value = null;
  void restoreDialogFocus();
}

function toggleEditRole(role: RoleName): void {
  const index = editForm.roles.indexOf(role);
  if (index >= 0) editForm.roles.splice(index, 1);
  else editForm.roles.push(role);
}

async function submitEdit(): Promise<void> {
  const user = editTarget.value;
  if (!user) return;
  if (editForm.roles.length === 0) {
    editErrors.value = { roles: 'Choose at least one role' };
    return;
  }
  editBusy.value = true;
  try {
    await api.patch(`/api/admin/users/${user.id}`, {
      roles: editForm.roles,
      manager_id: editForm.manager_id === '' ? null : Number(editForm.manager_id),
      active: editForm.active,
    });
    closeEdit();
    toast('User updated');
    await load();
  } catch (e) {
    if (e instanceof ApiError) {
      const fieldErrors: Record<string, string> = {};
      for (const [field, messages] of Object.entries(e.errors)) {
        fieldErrors[field.split('.')[0]] = messages[0];
      }
      editErrors.value = fieldErrors;
      toast(e.message, 'error');
    } else {
      toast('The user could not be updated. Try again.', 'error');
    }
  } finally {
    editBusy.value = false;
  }
}

/* ---------- Deactivate ---------- */

const deactivateTarget = ref<AdminUser | null>(null);
const deactivateBusy = ref(false);

function askDeactivate(user: AdminUser): void {
  deactivateTarget.value = user;
}

async function confirmDeactivate(): Promise<void> {
  const user = deactivateTarget.value;
  if (!user) return;
  deactivateBusy.value = true;
  try {
    await api.patch(`/api/admin/users/${user.id}`, { active: false });
    deactivateTarget.value = null;
    toast('User deactivated');
    await load();
  } catch (e) {
    toast(e instanceof ApiError ? e.message : 'The user could not be deactivated. Try again.', 'error');
  } finally {
    deactivateBusy.value = false;
  }
}

/* ---------- Reassign a Submitted report ---------- */

const reassignOpen = ref(false);
const reassignBusy = ref(false);
const reassignError = ref('');
const reassignReports = ref<ReportSummary[]>([]);
const reassignReportsLoading = ref(false);
const reassignForm = reactive({
  report_id: '' as string,
  manager_id: '' as string,
  reason: '',
});

async function openReassign(): Promise<void> {
  reassignForm.report_id = '';
  reassignForm.manager_id = '';
  reassignForm.reason = '';
  reassignError.value = '';
  reassignOpen.value = true;
  await focusDialog(reassignDialog);
  reassignReportsLoading.value = true;
  try {
    const response = await api.get<{ data: ReportSummary[] }>('/api/reports?scope=all&status=submitted');
    reassignReports.value = response.data.filter((report) => report.status === 'submitted');
  } catch {
    reassignReports.value = [];
    reassignError.value = 'Submitted reports could not be loaded. Try again.';
  } finally {
    reassignReportsLoading.value = false;
  }
}

function closeReassign(): void {
  if (reassignBusy.value) return;
  reassignOpen.value = false;
  void restoreDialogFocus();
}

async function submitReassign(): Promise<void> {
  reassignError.value = '';
  if (!reassignForm.report_id) {
    reassignError.value = 'Choose a report';
    return;
  }
  if (!reassignForm.manager_id) {
    reassignError.value = 'Choose a Manager';
    return;
  }
  if (reassignForm.reason.trim().length < 10) {
    reassignError.value = 'Reason must be at least 10 characters';
    return;
  }
  reassignBusy.value = true;
  try {
    await api.post(`/api/admin/reports/${reassignForm.report_id}/reassign`, {
      manager_id: Number(reassignForm.manager_id),
      reason: reassignForm.reason.trim(),
    });
    reassignBusy.value = false;
    closeReassign();
    toast('Manager reassigned');
  } catch (e) {
    if (e instanceof ApiError) {
      reassignError.value = e.errors.reason?.[0] ?? e.message;
    } else {
      reassignError.value = 'The Manager could not be reassigned. Try again.';
    }
  } finally {
    reassignBusy.value = false;
  }
}

onMounted(() => {
  if (isAdministrator.value) void load();
  else loading.value = false;
});
</script>

<template>
  <AppShell>
    <div class="page">
      <div v-if="!isAdministrator" class="access-denied" role="alert">
        <h1>Administration</h1>
        <p>You do not have access to this page</p>
      </div>

      <template v-else>
        <div class="page-header">
          <h1>Users</h1>
          <div class="page-actions">
            <button type="button" class="btn btn-secondary" @click="openReassign">Reassign report</button>
            <button type="button" class="btn btn-primary" @click="openAdd">Add user</button>
          </div>
        </div>

        <LoadingState v-if="loading" />
        <ErrorState v-else-if="error" :message="error" @retry="load" />
        <DataTable v-else class="users-table" :columns="columns" :rows="rows" empty-text="No users yet.">
          <template #cell-active="{ row }">
            <span :class="['state-pill', row.active === 'Active' ? 'is-active' : 'is-inactive']">{{ row.active }}</span>
          </template>
          <template #cell-actions="{ row }">
            <div class="row-actions">
              <button
                type="button"
                class="btn btn-ghost btn-small"
                :aria-label="`Edit ${row.name}`"
                @click.stop="openEdit(users.find((u) => u.id === row.id)!)"
              >
                Edit
              </button>
              <button
                v-if="row.active === 'Active'"
                type="button"
                class="btn btn-ghost btn-small danger"
                :aria-label="`Deactivate ${row.name}`"
                @click.stop="askDeactivate(users.find((u) => u.id === row.id)!)"
              >
                Deactivate
              </button>
            </div>
          </template>
        </DataTable>

        <div v-if="!loading && !error" class="users-cards" aria-label="Users">
          <article v-for="user in users" :key="user.id" class="user-card card">
            <div class="user-card-heading">
              <div>
                <h2>{{ user.name }}</h2>
                <a :href="`mailto:${user.email}`">{{ user.email }}</a>
              </div>
              <span :class="['state-pill', user.active ? 'is-active' : 'is-inactive']">
                {{ user.active ? 'Active' : 'Deactivated' }}
              </span>
            </div>
            <dl>
              <div><dt>Roles</dt><dd>{{ user.roles.join(', ') }}</dd></div>
              <div><dt>Manager</dt><dd>{{ user.manager_name ?? '—' }}</dd></div>
            </dl>
            <div class="row-actions">
              <button type="button" class="btn btn-secondary" :aria-label="`Edit ${user.name}`" @click="openEdit(user)">Edit</button>
              <button
                v-if="user.active"
                type="button"
                class="btn btn-ghost danger"
                :aria-label="`Deactivate ${user.name}`"
                @click="askDeactivate(user)"
              >
                Deactivate
              </button>
            </div>
          </article>
          <p v-if="users.length === 0" class="empty-users">No users yet.</p>
        </div>
      </template>
    </div>

    <!-- Add user -->
    <div v-if="addOpen" ref="addDialog" class="overlay" role="dialog" aria-modal="true" aria-labelledby="add-user-title" @keydown="trapDialogFocus($event, addDialog, closeAdd)">
      <form class="dialog card" novalidate @submit.prevent="submitAdd">
        <h2 id="add-user-title">Add user</h2>
        <div class="field">
          <label for="add-name">Name</label>
          <input id="add-name" v-model="addForm.name" type="text" autocomplete="name" :aria-invalid="Boolean(addErrors.name)" aria-describedby="add-name-error" />
          <span v-if="addErrors.name" id="add-name-error" class="field-error" role="alert">{{ addErrors.name }}</span>
        </div>
        <div class="field">
          <label for="add-email">Email</label>
          <input id="add-email" v-model="addForm.email" type="email" autocomplete="email" :aria-invalid="Boolean(addErrors.email)" aria-describedby="add-email-error" />
          <span v-if="addErrors.email" id="add-email-error" class="field-error" role="alert">{{ addErrors.email }}</span>
        </div>
        <fieldset class="field roles-field">
          <legend>Roles</legend>
          <label v-for="role in ROLES" :key="role" class="checkbox">
            <input
              type="checkbox"
              :value="role"
              :checked="addForm.roles.includes(role)"
              @change="toggleAddRole(role)"
            />
            {{ role }}
          </label>
          <span v-if="addErrors.roles" class="field-error" role="alert">{{ addErrors.roles }}</span>
        </fieldset>
        <div class="field">
          <label for="add-password">Initial password</label>
          <input id="add-password" v-model="addForm.password" type="password" autocomplete="new-password" :aria-invalid="Boolean(addErrors.password)" aria-describedby="add-password-hint add-password-error" />
          <span id="add-password-hint" class="hint">At least 12 characters</span>
          <span v-if="addErrors.password" id="add-password-error" class="field-error" role="alert">{{ addErrors.password }}</span>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" :disabled="addBusy" @click="closeAdd">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="addBusy">Create user</button>
        </div>
      </form>
    </div>

    <!-- Edit user -->
    <div v-if="editOpen && editTarget" ref="editDialog" class="overlay" role="dialog" aria-modal="true" aria-labelledby="edit-user-title" @keydown="trapDialogFocus($event, editDialog, closeEdit)">
      <form class="dialog card" novalidate @submit.prevent="submitEdit">
        <h2 id="edit-user-title">Edit {{ editTarget.name }}</h2>
        <fieldset class="field roles-field">
          <legend>Roles</legend>
          <label v-for="role in ROLES" :key="role" class="checkbox">
            <input
              type="checkbox"
              :value="role"
              :checked="editForm.roles.includes(role)"
              @change="toggleEditRole(role)"
            />
            {{ role }}
          </label>
          <span v-if="editErrors.roles" class="field-error">{{ editErrors.roles }}</span>
        </fieldset>
        <div class="field">
          <label for="edit-manager">Manager</label>
          <select id="edit-manager" v-model="editForm.manager_id">
            <option value="">No Manager</option>
            <option v-for="manager in managers" :key="manager.id" :value="String(manager.id)">
              {{ manager.name }}
            </option>
          </select>
        </div>
        <div class="field">
          <label class="checkbox">
            <input v-model="editForm.active" type="checkbox" />
            Active
          </label>
        </div>
        <div class="actions">
          <button type="button" class="btn btn-secondary" :disabled="editBusy" @click="closeEdit">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="editBusy">Save changes</button>
        </div>
      </form>
    </div>

    <!-- Deactivate confirmation -->
    <ConfirmDialog
      :open="deactivateTarget !== null"
      title="Deactivate user"
      :message="deactivateTarget ? `Deactivate ${deactivateTarget.name}? Their reports and history are kept, and their sessions end.` : ''"
      confirm-label="Deactivate"
      :busy="deactivateBusy"
      @confirm="confirmDeactivate"
      @cancel="deactivateTarget = null"
    />

    <!-- Reassign a Submitted report -->
    <div v-if="reassignOpen" ref="reassignDialog" class="overlay" role="dialog" aria-modal="true" aria-labelledby="reassign-title" @keydown="trapDialogFocus($event, reassignDialog, closeReassign)">
      <form class="dialog card" novalidate @submit.prevent="submitReassign">
        <h2 id="reassign-title">Reassign report</h2>
        <p v-if="reassignReportsLoading">Loading submitted reports…</p>
        <div v-else class="field">
          <label for="reassign-report">Submitted report</label>
          <select id="reassign-report" v-model="reassignForm.report_id">
            <option value="">Choose a report</option>
            <option v-for="report in reassignReports" :key="report.id" :value="String(report.id)">
              {{ report.title || 'Untitled report' }} — {{ report.employee?.name ?? 'Unknown' }}
            </option>
          </select>
          <span v-if="reassignReports.length === 0" class="hint">No Submitted reports.</span>
        </div>
        <div class="field">
          <label for="reassign-manager">New Manager</label>
          <select id="reassign-manager" v-model="reassignForm.manager_id">
            <option value="">Choose a Manager</option>
            <option v-for="manager in managers" :key="manager.id" :value="String(manager.id)">
              {{ manager.name }}
            </option>
          </select>
        </div>
        <div class="field">
          <label for="reassign-reason">Reason</label>
          <textarea id="reassign-reason" v-model="reassignForm.reason" rows="3" />
          <span class="hint">At least 10 characters</span>
        </div>
        <p v-if="reassignError" class="field-error" role="alert">{{ reassignError }}</p>
        <div class="actions">
          <button type="button" class="btn btn-secondary" :disabled="reassignBusy" @click="closeReassign">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="reassignBusy">Reassign</button>
        </div>
      </form>
    </div>
  </AppShell>
</template>
