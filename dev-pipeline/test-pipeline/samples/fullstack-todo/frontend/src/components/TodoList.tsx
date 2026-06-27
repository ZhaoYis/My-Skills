import React from 'react';
import type { Todo } from '../api/client.js';

interface TodoListProps {
  todos: Todo[];
  onToggle: (id: string, completed: boolean) => void;
  onDelete: (id: string) => void;
}

function TodoList({ todos, onToggle, onDelete }: TodoListProps) {
  if (todos.length === 0) {
    return <p className="empty">No todos yet. Add one above!</p>;
  }

  return (
    <ul className="todo-list" data-testid="todo-list">
      {todos.map((todo) => (
        <li key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => onToggle(todo.id, !todo.completed)}
            data-testid={`todo-checkbox-${todo.id}`}
          />
          <span className="todo-title">{todo.title}</span>
          <button
            onClick={() => onDelete(todo.id)}
            data-testid={`todo-delete-${todo.id}`}
            className="delete-btn"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}

export default TodoList;
