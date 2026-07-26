export type ItemStatus = 'active' | 'archived';

export interface Item {
  id: string;
  name: string;
  status: ItemStatus;
  createdAt: string;
}
