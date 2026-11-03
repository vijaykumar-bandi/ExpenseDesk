import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import StatusBadge from '../StatusBadge.vue';

describe('StatusBadge', () => {
  it('shows the label of each status', () => {
    expect(mount(StatusBadge, { props: { status: 'draft' } }).text()).toBe('Draft');
    expect(mount(StatusBadge, { props: { status: 'submitted' } }).text()).toBe('Awaiting approval');
    expect(mount(StatusBadge, { props: { status: 'changes_requested' } }).text()).toBe('Changes requested');
    expect(mount(StatusBadge, { props: { status: 'approved' } }).text()).toBe('Approved');
    expect(mount(StatusBadge, { props: { status: 'paid' } }).text()).toBe('Paid');
    expect(mount(StatusBadge, { props: { status: 'rejected' } }).text()).toBe('Rejected');
  });
});
