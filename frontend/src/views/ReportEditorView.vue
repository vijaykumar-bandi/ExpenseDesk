<script setup lang="ts">
/**
 * The report editor: title and business purpose, one card per expense line with
 * its receipt, a running total in INR, and Save draft / Submit.
 *
 * Every entered value stays on screen when a save, an upload or a submit fails;
 * the API's 422 `errors` are shown beside the field they belong to.
 */
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import ErrorState from '../components/ErrorState.vue';
import LoadingState from '../components/LoadingState.vue';
import { api, ApiError } from '../api/client';
import { formatInr, parseInr } from '../lib/money';
import { todayInKolkata } from '../lib/dates';
import { toast } from '../lib/toast';

interface Category {
  id: number;
  name: string;
}

interface Receipt {
  id: number;
  file_name: string;
  mime_type: string;
  size: number;
}

interface ApiLine {
  id: number;
  expense_date: string | null;
  category: Category | null;
  merchant: string | null;
  amount_paise: number | null;
  note: string | null;
  receipt: Receipt | null;
}

interface ApiReport {
  id: number;
  title: string | null;
  business_purpose: string | null;
  status: string;
  total_paise: number;
  lines: ApiLine[];
}

/** One expense line as the editor holds it while the Employee types. */
interface EditorLine {
  /** The API line id, or null for a line that is not saved yet. */
  id: number | null;
  expense_date: string;
  category_id: number | null;
  merchant: string;
  /** The amount as typed, in rupees. */
  amount: string;
  note: string;
  receipt: Receipt | null;
  /** The file chosen for this line, waiting for the line to be saved. */
  pendingFile: File | null;
  /** The messages shown beside this line. */
  errors: string[];
}

const RECEIPT_ERROR = 'Receipts must be a PDF, JPEG or PNG of up to 5 MB';
const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;
const RECEIPT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const RECEIPT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
const RECEIPT_THRESHOLD_PAISE = 100000;

const route = useRoute();
const router = useRouter();
/** The report being edited; null until a new report is first saved. */
const reportId = ref<number | null>(route.params.id ? Number(route.params.id) : null);

const categories = ref<Category[]>([]);
const title = ref('');
const businessPurpose = ref('');
const lines = ref<EditorLine[]>([]);
const titleError = ref('');
const purposeError = ref('');
const linesError = ref('');
const formError = ref('');
const loading = ref(true);
const loadError = ref('');
const saving = ref(false);
const submitting = ref(false);
/** Persisted lines removed in this editing session, deleted on the next save. */
const removedLineIds = ref<number[]>([]);

const busy = computed(() => saving.value || submitting.value);

function emptyLine(): EditorLine {
  return {
    id: null,
    expense_date: '',
    category_id: null,
    merchant: '',
    amount: '',
    note: '',
    receipt: null,
    pendingFile: null,
    errors: [],
  };
}

function amountPaise(line: EditorLine): number {
  const paise = parseInr(line.amount);
  return Number.isNaN(paise) ? 0 : paise;
}

/** The running total: the sum of the amounts entered so far, in paise. */
const totalPaise = computed(() => lines.value.reduce((sum, line) => sum + amountPaise(line), 0));

function addLine(): void {
  lines.value.push(emptyLine());
  linesError.value = '';
}

function removeLine(index: number): void {
  const [removed] = lines.value.splice(index, 1);
  if (removed?.id !== null && removed?.id !== undefined) {
    removedLineIds.value.push(removed.id);
  }
  if (lines.value.length > 0) {
    linesError.value = '';
  }
}

function clearErrors(): void {
  titleError.value = '';
  purposeError.value = '';
  linesError.value = '';
  formError.value = '';
  for (const line of lines.value) {
    line.errors = [];
  }
}

function lineLabel(index: number): string {
  return `Line ${index + 1}`;
}

function isReceiptFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const typeOk = file.type ? RECEIPT_TYPES.includes(file.type) : RECEIPT_EXTENSIONS.includes(extension);
  return typeOk && RECEIPT_EXTENSIONS.includes(extension) && file.size <= RECEIPT_MAX_BYTES;
}

/**
 * Checks the file before it leaves the browser, so a wrong file shows its
 * message beside the line at once and the line keeps every entered value.
 */
function chooseReceipt(index: number, event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  input.value = '';
  if (!file) return;

  const line = lines.value[index];
  if (!line) return;

  if (!isReceiptFile(file)) {
    line.errors = [RECEIPT_ERROR];
    return;
  }

  line.errors = [];
  line.pendingFile = file;
}

async function uploadReceipt(index: number, lineId: number, file: File): Promise<boolean> {
  const line = lines.value[index];
  if (!line) return false;

  const form = new FormData();
  form.append('file', file);

  try {
    const response = await api.upload<{ data: Receipt }>(
      `/api/reports/${reportId.value}/lines/${lineId}/receipt`,
      form,
    );
    line.receipt = response.data;
    line.pendingFile = null;
    line.errors = [];
    return true;
  } catch (e) {
    line.errors = [e instanceof ApiError ? e.errors.file?.[0] ?? e.message : RECEIPT_ERROR];
    return false;
  }
}

/** Shows the API's 422 messages beside the field each one belongs to. */
function applyApiErrors(error: ApiError): void {
  let shown = false;

  for (const [key, messages] of Object.entries(error.errors)) {
    const message = messages[0] ?? '';
    if (key === 'title') {
      titleError.value = message;
      shown = true;
    } else if (key === 'business_purpose') {
      purposeError.value = message;
      shown = true;
    } else if (key === 'lines') {
      linesError.value = message;
      shown = true;
    } else {
      const match = key.match(/^lines\.(\d+)\.(.+)$/);
      if (match) {
        const line = lines.value[Number(match[1])];
        if (line) {
          line.errors = [...line.errors, message];
          shown = true;
        }
      }
    }
  }

  if (!shown) {
    formError.value = error.message;
  }
}

function failureMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/** Saves the title and business purpose, creating the report when it is new. */
async function persistHeader(): Promise<void> {
  const body = { title: title.value, business_purpose: businessPurpose.value };
  if (reportId.value !== null) {
    await api.patch<{ data: ApiReport }>(`/api/reports/${reportId.value}`, body);
  } else {
    const response = await api.post<{ data: ApiReport }>('/api/reports', body);
    reportId.value = response.data.id;
  }
}

function lineBody(line: EditorLine, draft: boolean) {
  const parsedAmount = parseInr(line.amount);
  return {
    expense_date: line.expense_date || null,
    category_id: line.category_id,
    merchant: line.merchant || null,
    amount_paise: line.amount.trim() === '' || Number.isNaN(parsedAmount)
      ? null
      : (draft ? parsedAmount : amountPaise(line)),
    note: line.note || null,
    draft,
  };
}

/** Synchronizes created, edited, and removed lines and receipts. */
async function persistLines(draft = false): Promise<void> {
  if (reportId.value === null) return;

  for (const lineId of removedLineIds.value) {
    await api.del(`/api/reports/${reportId.value}/lines/${lineId}`);
  }
  removedLineIds.value = [];

  for (const [index, line] of lines.value.entries()) {
    if (line.id === null) {
      const response = await api.post<{ data: ApiLine }>(`/api/reports/${reportId.value}/lines`, {
        ...lineBody(line, draft),
      });

      line.id = response.data.id;
    } else {
      await api.patch<{ data: ApiLine }>(
        `/api/reports/${reportId.value}/lines/${line.id}`,
        lineBody(line, draft),
      );
    }

    if (line.pendingFile) {
      const uploaded = await uploadReceipt(index, line.id, line.pendingFile);
      if (!uploaded) {
        throw new Error('Receipt upload failed');
      }
    }
  }
}

async function saveDraft(): Promise<void> {
  if (busy.value) return;
  clearErrors();
  saving.value = true;

  try {
    await persistHeader();
    await persistLines(true);
    toast('Draft saved');
    await router.push('/dashboard');
  } catch (e) {
    if (e instanceof ApiError) {
      applyApiErrors(e);
    } else {
      formError.value = failureMessage(e, 'The draft could not be saved. Try again.');
    }
  } finally {
    saving.value = false;
  }
}

/** The checks the editor makes before it asks the API to submit. */
function validateForSubmit(): boolean {
  let valid = true;

  if (!title.value.trim()) {
    titleError.value = 'Required';
    valid = false;
  }

  if (!businessPurpose.value.trim()) {
    purposeError.value = 'Required';
    valid = false;
  }

  if (lines.value.length === 0) {
    linesError.value = 'Add at least one expense line';
    return false;
  }

  const today = todayInKolkata();

  for (const line of lines.value) {
    const messages: string[] = [];

    if (!line.expense_date) {
      messages.push('Required');
    } else if (line.expense_date > today) {
      messages.push('Expense date cannot be in the future');
    }

    if (line.category_id === null) {
      messages.push('Required');
    }

    if (!line.merchant.trim()) {
      messages.push('Required');
    }

    const paise = parseInr(line.amount);
    if (line.amount.trim() === '' || Number.isNaN(paise)) {
      messages.push('Required');
    } else if (paise <= 0) {
      messages.push('Amount must be more than zero');
    }

    if (paise >= RECEIPT_THRESHOLD_PAISE && !line.receipt && !line.pendingFile) {
      messages.push('Receipt required');
    }

    line.errors = messages;
    if (messages.length > 0) {
      valid = false;
    }
  }

  return valid;
}

async function submit(): Promise<void> {
  if (busy.value) return;
  clearErrors();

  if (!validateForSubmit()) return;

  submitting.value = true;

  try {
    await persistHeader();
    await persistLines();

    if (reportId.value === null) {
      formError.value = 'The report could not be submitted. Try again.';
      return;
    }

    const response = await api.post<{ data: ApiReport }>(`/api/reports/${reportId.value}/submit`);
    toast('Report submitted');
    await router.push(`/reports/${response.data.id}`);
  } catch (e) {
    if (e instanceof ApiError) {
      applyApiErrors(e);
    } else {
      formError.value = failureMessage(e, 'The report could not be submitted. Try again.');
    }
  } finally {
    submitting.value = false;
  }
}

async function load(): Promise<void> {
  loading.value = true;
  loadError.value = '';

  try {
    const categoryResponse = await api.get<{ data: Category[] }>('/api/categories');
    categories.value = categoryResponse.data;

    if (reportId.value !== null) {
      const response = await api.get<{ data: ApiReport }>(`/api/reports/${reportId.value}`);
      const report = response.data;
      title.value = report.title ?? '';
      businessPurpose.value = report.business_purpose ?? '';
      lines.value = report.lines.map((line) => ({
        id: line.id,
        expense_date: line.expense_date ?? '',
        category_id: line.category?.id ?? null,
        merchant: line.merchant ?? '',
        amount: line.amount_paise !== null ? String(line.amount_paise / 100) : '',
        note: line.note ?? '',
        receipt: line.receipt,
        pendingFile: null,
        errors: [],
      }));

    }
  } catch (e) {
    loadError.value = failureMessage(e, 'The report could not be loaded. Try again.');
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<template>
  <AppShell>
    <div class="page editor">
      <h1>{{ reportId !== null ? 'Edit report' : 'New report' }}</h1>

      <LoadingState v-if="loading" />
      <ErrorState v-else-if="loadError" :message="loadError" @retry="load" />

      <form v-else class="editor-form" novalidate @submit.prevent="submit">
        <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

        <section class="card header-fields">
          <div class="field">
            <label for="report-title">Title</label>
            <input
              id="report-title"
              v-model="title"
              type="text"
              :aria-invalid="titleError ? 'true' : undefined"
              aria-describedby="report-title-error"
            />
            <p v-if="titleError" id="report-title-error" class="field-error">{{ titleError }}</p>
          </div>

          <div class="field">
            <label for="report-purpose">Business purpose</label>
            <textarea
              id="report-purpose"
              v-model="businessPurpose"
              rows="3"
              :aria-invalid="purposeError ? 'true' : undefined"
              aria-describedby="report-purpose-error"
            ></textarea>
            <p v-if="purposeError" id="report-purpose-error" class="field-error">{{ purposeError }}</p>
          </div>
        </section>

        <section class="lines" aria-label="Expense lines">
          <p v-if="linesError" class="field-error lines-error" role="alert">{{ linesError }}</p>

          <p v-if="lines.length === 0" class="empty-lines">No expense lines yet. Add a line to start.</p>

          <article
            v-for="(line, index) in lines"
            :key="line.id ?? `new-${index}`"
            class="card line-card"
            :aria-label="lineLabel(index)"
          >
            <header class="line-head">
              <h2>{{ lineLabel(index) }}</h2>
              <button type="button" class="btn btn-ghost" @click="removeLine(index)">
                Remove line
              </button>
            </header>

            <div class="line-fields">
              <div class="field">
                <label :for="`line-date-${index}`">Expense date</label>
                <input :id="`line-date-${index}`" v-model="line.expense_date" type="date" />
              </div>

              <div class="field">
                <label :for="`line-category-${index}`">Category</label>
                <select :id="`line-category-${index}`" v-model="line.category_id">
                  <option :value="null" disabled>Select a category</option>
                  <option v-for="category in categories" :key="category.id" :value="category.id">
                    {{ category.name }}
                  </option>
                </select>
              </div>

              <div class="field">
                <label :for="`line-merchant-${index}`">Merchant</label>
                <input :id="`line-merchant-${index}`" v-model="line.merchant" type="text" />
              </div>

              <div class="field">
                <label :for="`line-amount-${index}`">Amount (INR)</label>
                <input
                  :id="`line-amount-${index}`"
                  v-model="line.amount"
                  type="text"
                  inputmode="decimal"
                  placeholder="0.00"
                />
              </div>

              <div class="field note-field">
                <label :for="`line-note-${index}`">Note (optional)</label>
                <textarea :id="`line-note-${index}`" v-model="line.note" rows="2"></textarea>
              </div>
            </div>

            <div class="receipt-row">
              <span class="receipt-name">
                {{ line.receipt?.file_name ?? line.pendingFile?.name ?? 'No receipt' }}
              </span>
              <label class="btn btn-secondary receipt-button">
                Add receipt
                <input
                  class="receipt-input"
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  capture="environment"
                  :aria-label="`Add receipt to ${lineLabel(index)}`"
                  @change="chooseReceipt(index, $event)"
                />
              </label>
            </div>

            <div v-if="line.errors.length > 0" role="alert">
              <ul class="line-errors">
                <li v-for="message in line.errors" :key="message" class="field-error">{{ message }}</li>
              </ul>
            </div>
          </article>

          <button type="button" class="btn btn-secondary add-line" @click="addLine">Add line</button>
        </section>

        <div class="total-bar">
          <p class="total">
            <span class="total-label">Running total</span>
            <span class="amount total-value">{{ formatInr(totalPaise) }}</span>
          </p>
          <div class="total-actions">
            <button type="button" class="btn btn-secondary" :disabled="busy" @click="saveDraft">
              Save draft
            </button>
            <button type="submit" class="btn btn-primary" :disabled="busy">Submit</button>
          </div>
        </div>
      </form>
    </div>
  </AppShell>
</template>

<style scoped src="./ReportEditorView.css"></style>
