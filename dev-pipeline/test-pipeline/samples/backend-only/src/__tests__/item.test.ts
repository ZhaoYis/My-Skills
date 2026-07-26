import { describe, it } from 'node:test';
import assert from 'node:assert';
import { createItem, formatItem } from '../index.js';

describe('Item', () => {
  it('creates an item with required fields', () => {
    const item = createItem('test-item');
    assert.ok(item.id);
    assert.strictEqual(item.name, 'test-item');
    assert.strictEqual(item.status, 'active');
    assert.ok(item.createdAt);
  });

  it('formats an item correctly', () => {
    const item = createItem('demo');
    const formatted = formatItem(item);
    assert.ok(formatted.includes(item.id));
    assert.ok(formatted.includes('demo'));
    assert.ok(formatted.includes('active'));
  });
});
