(() => {
  'use strict';

  const STORAGE_KEY = 'todo-app.v1';

  const FILTERS = {
    all: () => true,
    active: (todo) => !todo.completed,
    completed: (todo) => todo.completed,
  };

  const EMPTY_MESSAGES = {
    all: '할 일이 없습니다. 위에서 새 할 일을 추가해 보세요.',
    active: '남은 할 일이 없습니다. 모두 끝냈어요!',
    completed: '아직 완료한 항목이 없습니다.',
  };

  const ICONS = {
    edit:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<path d="M4 20h4L19 9l-4-4L4 16v4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    remove:
      '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">' +
      '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  // ---------- 저장소 ----------

  const isValidTodo = (t) =>
    t !== null &&
    typeof t === 'object' &&
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.completed === 'boolean';

  function loadTodos() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter(isValidTodo) : [];
    } catch {
      return [];
    }
  }

  function saveTodos(todos) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
    } catch {
      // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 메모리에만 유지합니다.
    }
  }

  function createId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function filterFromHash() {
    const name = location.hash.replace(/^#\/?/, '');
    return Object.hasOwn(FILTERS, name) ? name : 'all';
  }

  // ---------- 상태 ----------

  const state = {
    todos: loadTodos(),
    filter: filterFromHash(),
    editingId: null,
  };

  function commit() {
    saveTodos(state.todos);
    render();
  }

  function addTodo(title) {
    state.todos.push({ id: createId(), title, completed: false, createdAt: Date.now() });
    commit();
  }

  function updateTodo(id, changes) {
    state.todos = state.todos.map((t) => (t.id === id ? { ...t, ...changes } : t));
    commit();
  }

  function removeTodo(id) {
    state.todos = state.todos.filter((t) => t.id !== id);
    commit();
  }

  function clearCompleted() {
    state.todos = state.todos.filter((t) => !t.completed);
    commit();
  }

  function startEditing(id) {
    state.editingId = id;
    render();
  }

  function finishEditing(id, value) {
    // Enter와 blur가 연달아 와도 한 번만 처리합니다.
    if (state.editingId !== id) return;
    state.editingId = null;
    const title = value.trim();
    if (title) updateTodo(id, { title });
    else removeTodo(id);
  }

  function cancelEditing() {
    state.editingId = null;
    render();
  }

  // ---------- 화면 ----------

  const $ = (selector) => document.querySelector(selector);
  const els = {
    form: $('#new-todo-form'),
    input: $('#new-todo-input'),
    list: $('#todo-list'),
    empty: $('#empty-state'),
    footer: $('#footer'),
    count: $('#count'),
    clear: $('#clear-completed'),
    today: $('#today'),
    filters: document.querySelectorAll('[data-filter]'),
  };

  const idOf = (el) => el.closest('.todo').dataset.id;

  function iconButton(role, label, icon) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button';
    button.dataset.role = role;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.innerHTML = icon; // 고정된 SVG 문자열만 사용 (사용자 입력 아님)
    return button;
  }

  function renderItem(todo) {
    const li = document.createElement('li');
    li.className = 'todo';
    li.dataset.id = todo.id;

    if (state.editingId === todo.id) {
      li.classList.add('is-editing');
      const input = document.createElement('input');
      input.className = 'todo__edit';
      input.dataset.role = 'edit-input';
      input.value = todo.title;
      input.maxLength = 200;
      input.setAttribute('aria-label', '할 일 수정');
      li.append(input);
      return li;
    }

    if (todo.completed) li.classList.add('is-completed');

    const titleId = `todo-title-${todo.id}`;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo__toggle';
    checkbox.dataset.role = 'toggle';
    checkbox.checked = todo.completed;
    checkbox.setAttribute('aria-labelledby', titleId);

    const title = document.createElement('span');
    title.className = 'todo__title';
    title.dataset.role = 'title';
    title.id = titleId;
    title.textContent = todo.title;

    const actions = document.createElement('div');
    actions.className = 'todo__actions';
    actions.append(
      iconButton('edit', '수정', ICONS.edit),
      iconButton('remove', '삭제', ICONS.remove),
    );

    li.append(checkbox, title, actions);
    return li;
  }

  // 목록을 다시 그려도 키보드 사용자의 포커스 위치를 잃지 않도록 기억해 둡니다.
  function captureFocus() {
    const active = document.activeElement;
    const li = active?.closest?.('.todo');
    if (!li || !els.list.contains(li)) return null;
    return {
      id: li.dataset.id,
      role: active.dataset.role === 'edit-input' ? 'edit' : active.dataset.role,
      index: [...els.list.children].indexOf(li),
    };
  }

  function restoreFocus(saved) {
    if (!saved) return;
    const items = [...els.list.children];
    const li =
      items.find((item) => item.dataset.id === saved.id) ??
      items[Math.min(saved.index, items.length - 1)];
    if (!li) {
      els.input.focus();
      return;
    }
    const target =
      li.querySelector(`[data-role="${saved.role}"]`) ?? li.querySelector('[data-role="toggle"]');
    target?.focus();
  }

  function render() {
    const focus = captureFocus();

    const visible = state.todos.filter(FILTERS[state.filter]);
    els.list.replaceChildren(...visible.map(renderItem));

    els.empty.hidden = visible.length > 0;
    els.empty.textContent = EMPTY_MESSAGES[state.filter];

    const remaining = state.todos.filter(FILTERS.active).length;
    const completed = state.todos.length - remaining;
    els.footer.hidden = state.todos.length === 0;
    els.count.textContent = `남은 할 일 ${remaining}개`;
    els.clear.hidden = completed === 0;
    els.clear.textContent = `완료 항목 삭제 (${completed})`;

    els.filters.forEach((link) => {
      if (link.dataset.filter === state.filter) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });

    const editInput = els.list.querySelector('.todo__edit');
    if (editInput) {
      editInput.focus();
      const end = editInput.value.length;
      editInput.setSelectionRange(end, end);
    } else {
      restoreFocus(focus);
    }
  }

  // ---------- 이벤트 ----------

  els.form.addEventListener('submit', (event) => {
    event.preventDefault();
    const title = els.input.value.trim();
    if (!title) return;
    els.input.value = '';
    addTodo(title);
    // '완료' 필터에서는 새 항목이 보이지 않으므로 전체 보기로 전환합니다.
    if (state.filter === 'completed') location.hash = '#/';
  });

  els.input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !event.isComposing) els.input.value = '';
  });

  els.list.addEventListener('change', (event) => {
    if (event.target.dataset.role !== 'toggle') return;
    updateTodo(idOf(event.target), { completed: event.target.checked });
  });

  els.list.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-role]');
    if (!button) return;
    const id = idOf(button);
    if (button.dataset.role === 'remove') removeTodo(id);
    else if (button.dataset.role === 'edit') startEditing(id);
  });

  els.list.addEventListener('dblclick', (event) => {
    if (event.target.dataset.role === 'title') startEditing(idOf(event.target));
  });

  els.list.addEventListener('keydown', (event) => {
    if (event.target.dataset.role !== 'edit-input') return;
    // 한글 입력(IME) 조합 중의 Enter는 글자 확정용이므로 무시합니다.
    if (event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') finishEditing(idOf(event.target), event.target.value);
    else if (event.key === 'Escape') cancelEditing();
  });

  els.list.addEventListener('focusout', (event) => {
    if (event.target.dataset.role !== 'edit-input') return;
    finishEditing(idOf(event.target), event.target.value);
  });

  els.clear.addEventListener('click', () => {
    clearCompleted();
    els.input.focus(); // 버튼이 사라지므로 입력창으로 포커스를 옮깁니다.
  });

  window.addEventListener('hashchange', () => {
    state.filter = filterFromHash();
    state.editingId = null;
    render();
  });

  // 다른 탭에서 바뀐 내용을 반영합니다.
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    const draft = els.list.querySelector('.todo__edit')?.value;
    state.todos = loadTodos();
    if (!state.todos.some((t) => t.id === state.editingId)) state.editingId = null;
    render();
    const editInput = els.list.querySelector('.todo__edit');
    if (editInput && draft !== undefined) editInput.value = draft;
  });

  // ---------- 시작 ----------

  els.today.textContent = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });

  render();
})();
