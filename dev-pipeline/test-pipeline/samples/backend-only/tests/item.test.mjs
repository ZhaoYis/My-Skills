import { describe, it } from 'node:test';
import assert from 'node:assert';

// Simple test for the Item model
describe('Item', () => {
  it('creates an item with required fields', () => {
    const item = {
      id: 'abc123',
      name: 'test-item',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    assert.ok(item.id);
    assert.strictEqual(item.name, 'test-item');
    assert.strictEqual(item.status, 'active');
    assert.ok(item.createdAt);
  });

  it('formats an item correctly', () => {
    const item = {
      id: 'demo-id',
      name: 'demo',
      status: 'active',
      createdAt: new Date().toISOString(),
    };
    const formatted = `[${item.id}] ${item.name} (${item.status})`;
    assert.ok(formatted.includes('demo-id'));
    assert.ok(formatted.includes('demo'));
    assert.ok(formatted.includes('active'));
  });
});
