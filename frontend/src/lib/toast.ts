/** Shows a toast through ToastHost, which listens for this event. */
export function toast(message: string, variant: 'success' | 'error' = 'success'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('expensedesk:toast', { detail: { message, variant } }));
}
