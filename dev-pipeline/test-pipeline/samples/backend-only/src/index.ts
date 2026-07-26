import { Item, ItemStatus } from './models/item.js';

export function createItem(name: string): Item {
  return {
    id: Math.random().toString(36).substring(2, 10),
    name,
    status: 'active' as ItemStatus,
    createdAt: new Date().toISOString(),
  };
}

export function formatItem(item: Item): string {
  return `[${item.id}] ${item.name} (${item.status})`;
}
