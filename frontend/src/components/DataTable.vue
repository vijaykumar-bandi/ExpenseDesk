<script setup lang="ts">
import { computed, ref } from 'vue';

export interface DataTableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right';
}

const props = defineProps<{
  columns: DataTableColumn[];
  rows: Record<string, unknown>[];
  rowKey?: string;
  emptyText?: string;
}>();

const emit = defineEmits<{ (e: 'row-click', row: Record<string, unknown>): void }>();

const sortKey = ref<string | null>(null);
const sortDir = ref<'asc' | 'desc'>('asc');

function toggleSort(column: DataTableColumn): void {
  if (!column.sortable) return;
  if (sortKey.value === column.key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = column.key;
    sortDir.value = 'asc';
  }
}

const sortedRows = computed(() => {
  if (!sortKey.value) return props.rows;
  const key = sortKey.value;
  const dir = sortDir.value === 'asc' ? 1 : -1;
  return [...props.rows].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (av === bv) return 0;
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    return av > bv ? dir : -dir;
  });
});

function keyFor(row: Record<string, unknown>, index: number): string | number {
  const key = props.rowKey ?? 'id';
  const value = row[key];
  return typeof value === 'string' || typeof value === 'number' ? value : index;
}
</script>

<template>
  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            :class="{ right: column.align === 'right' }"
            :aria-sort="sortKey === column.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'"
          >
            <button v-if="column.sortable" type="button" class="sort" @click="toggleSort(column)">
              {{ column.label }}
              <span aria-hidden="true">{{ sortKey === column.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕' }}</span>
            </button>
            <span v-else>{{ column.label }}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in sortedRows"
          :key="keyFor(row, index)"
          class="row"
          @click="emit('row-click', row)"
        >
          <td v-for="column in columns" :key="column.key" :class="{ right: column.align === 'right' }">
            <slot :name="`cell-${column.key}`" :row="row">{{ row[column.key] }}</slot>
          </td>
        </tr>
        <tr v-if="sortedRows.length === 0">
          <td :colspan="columns.length" class="empty">{{ emptyText ?? 'Nothing to show yet.' }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table-wrap {
  overflow-x: auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  font-size: 13px;
  text-transform: uppercase;
  color: var(--color-muted);
  border-bottom: 1px solid var(--color-border);
  padding: var(--space-2) var(--space-3);
}

td {
  padding: var(--space-3);
  border-bottom: 1px solid var(--color-border);
}

.row {
  cursor: pointer;
}

.row:hover {
  background: var(--color-row-hover);
}

.right {
  text-align: right;
}

.sort {
  background: none;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-transform: uppercase;
}

.empty {
  text-align: center;
  color: var(--color-muted);
  padding: var(--space-6);
}
</style>
