import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App.js';

// Mock the API client
const mockTodos = [
  { id: '1', title: 'Test Todo 1', completed: false, createdAt: '2024-01-01T00:00:00Z' },
  { id: '2', title: 'Test Todo 2', completed: true, createdAt: '2024-01-02T00:00:00Z' },
];

// We test the components at the unit level since App uses fetch
describe('TodoList Component', () => {
  it('renders todo items', async () => {
    const { default: TodoList } = await import('../components/TodoList.js');
    const onToggle = vi.fn();
    const onDelete = vi.fn();

    render(<TodoList todos={mockTodos} onToggle={onToggle} onDelete={onDelete} />);

    expect(screen.getByText('Test Todo 1')).toBeDefined();
    expect(screen.getByText('Test Todo 2')).toBeDefined();
  });

  it('shows empty message when no todos', async () => {
    const { default: TodoList } = await import('../components/TodoList.js');
    const onToggle = vi.fn();
    const onDelete = vi.fn();

    render(<TodoList todos={[]} onToggle={onToggle} onDelete={onDelete} />);

    expect(screen.getByText(/No todos yet/)).toBeDefined();
  });
});

describe('AddTodo Component', () => {
  it('should call onAdd with trimmed input', async () => {
    const { default: AddTodo } = await import('../components/AddTodo.js');
    const onAdd = vi.fn();

    render(<AddTodo onAdd={onAdd} />);

    const input = screen.getByTestId('add-todo-input');
    fireEvent.change(input, { target: { value: '  New Task  ' } });
    fireEvent.click(screen.getByTestId('add-todo-btn'));

    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledWith('New Task');
    });
  });

  it('should not call onAdd with empty input', async () => {
    const { default: AddTodo } = await import('../components/AddTodo.js');
    const onAdd = vi.fn();

    render(<AddTodo onAdd={onAdd} />);

    fireEvent.click(screen.getByTestId('add-todo-btn'));

    await waitFor(() => {
      expect(onAdd).not.toHaveBeenCalled();
    });
  });
});
