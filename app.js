/**
 * Zenith Tasks — Application Logic
 * Modern, responsive To-Do manager with LocalStorage persistence,
 * filtering, sorting, edit modal, audio chime, and celebratory confetti.
 */

// --- Default Initial Tasks ---
const DEFAULT_TASKS = [
  {
    id: "task_1",
    title: "Complete the quarterly project roadmap",
    category: "Work",
    priority: "high",
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    completed: false,
    createdAt: Date.now() - 3600000 * 4
  },
  {
    id: "task_2",
    title: "Morning 30-minute mindfulness & jogging",
    category: "Health",
    priority: "medium",
    dueDate: new Date().toISOString().split('T')[0], // Today
    completed: true,
    createdAt: Date.now() - 3600000 * 8
  },
  {
    id: "task_3",
    title: "Pick up fresh groceries & artisan bread",
    category: "Shopping",
    priority: "low",
    dueDate: "",
    completed: false,
    createdAt: Date.now() - 3600000 * 2
  },
  {
    id: "task_4",
    title: "Read 2 chapters of system architecture book",
    category: "Study",
    priority: "medium",
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    completed: false,
    createdAt: Date.now() - 3600000 * 1
  }
];

// --- State ---
let tasks = [];
let activeFilter = 'all'; // 'all' | 'active' | 'completed'
let activeCategory = 'all';
let searchQuery = '';
let sortBy = 'newest';
let lastDeletedTask = null;
let lastDeletedIndex = null;
let undoTimeout = null;

// --- DOM Elements ---
const taskListEl = document.getElementById('task-list');
const emptyStateEl = document.getElementById('empty-state');
const addTaskForm = document.getElementById('add-task-form');
const taskInput = document.getElementById('task-input');
const taskCategorySelect = document.getElementById('task-category');
const taskPrioritySelect = document.getElementById('task-priority');
const taskDueDateInput = document.getElementById('task-due-date');

const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const filterTabs = document.querySelectorAll('.filter-tab');
const categoryChips = document.querySelectorAll('.category-chip');
const sortSelect = document.getElementById('sort-select');

const progressBar = document.getElementById('progress-bar');
const progressPercentage = document.getElementById('progress-percentage');
const progressStatusText = document.getElementById('progress-status-text');
const greetingText = document.getElementById('greeting-text');
const statTotal = document.getElementById('stat-total');
const statPending = document.getElementById('stat-pending');
const statCompleted = document.getElementById('stat-completed');
const tasksCountHeading = document.getElementById('tasks-count-heading');

const clearCompletedBtn = document.getElementById('clear-completed-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
const currentDateDisplay = document.getElementById('current-date-display');

// Modal Elements
const editModal = document.getElementById('edit-modal');
const editTaskForm = document.getElementById('edit-task-form');
const editTaskId = document.getElementById('edit-task-id');
const editTaskTitle = document.getElementById('edit-task-title');
const editTaskCategory = document.getElementById('edit-task-category');
const editTaskPriority = document.getElementById('edit-task-priority');
const editTaskDueDate = document.getElementById('edit-task-due-date');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

const toastContainer = document.getElementById('toast-container');
const confettiCanvas = document.getElementById('confetti-canvas');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initDateDisplay();
  loadTasks();
  setupEventListeners();
  render();
});

// --- Theme Management ---
function initTheme() {
  const savedTheme = localStorage.getItem('zenith_theme') || 
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('zenith_theme', newTheme);
}

// --- Date Header ---
function initDateDisplay() {
  const now = new Date();
  const options = { weekday: 'long', month: 'short', day: 'numeric' };
  currentDateDisplay.textContent = now.toLocaleDateString(undefined, options);
}

// --- Data Persistence ---
function loadTasks() {
  const saved = localStorage.getItem('zenith_tasks');
  if (saved) {
    try {
      tasks = JSON.parse(saved);
    } catch (e) {
      tasks = [...DEFAULT_TASKS];
    }
  } else {
    tasks = [...DEFAULT_TASKS];
    saveTasks();
  }
}

function saveTasks() {
  localStorage.setItem('zenith_tasks', JSON.stringify(tasks));
}

// --- Audio Feedback (Synthesized pleasant chime) ---
function playCompletionSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (e) {
    // Ignore audio errors if blocked by browser policy
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  // Theme Toggle
  themeToggleBtn.addEventListener('click', toggleTheme);

  // Add Task
  addTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = taskInput.value.trim();
    if (!title) return;

    const newTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      title: title,
      category: taskCategorySelect.value,
      priority: taskPrioritySelect.value,
      dueDate: taskDueDateInput.value,
      completed: false,
      createdAt: Date.now()
    };

    tasks.unshift(newTask);
    saveTasks();
    render();

    // Reset input
    taskInput.value = '';
    taskInput.focus();
    showToast('Task added successfully!');
  });

  // Search Input
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase().trim();
    clearSearchBtn.classList.toggle('hidden', searchQuery === '');
    render();
  });

  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    clearSearchBtn.classList.add('hidden');
    searchInput.focus();
    render();
  });

  // Filter Tabs
  filterTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      filterTabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeFilter = tab.dataset.filter;
      render();
    });
  });

  // Category Filter Chips
  categoryChips.forEach(chip => {
    chip.addEventListener('click', () => {
      categoryChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategory = chip.dataset.category;
      render();
    });
  });

  // Sort Dropdown
  sortSelect.addEventListener('change', (e) => {
    sortBy = e.target.value;
    render();
  });

  // Bulk Actions
  clearCompletedBtn.addEventListener('click', () => {
    const completedCount = tasks.filter(t => t.completed).length;
    if (completedCount === 0) {
      showToast('No completed tasks to clear.');
      return;
    }
    const previousTasks = [...tasks];
    tasks = tasks.filter(t => !t.completed);
    saveTasks();
    render();
    showToast(`Cleared ${completedCount} completed task(s).`, () => {
      tasks = previousTasks;
      saveTasks();
      render();
    });
  });

  clearAllBtn.addEventListener('click', () => {
    if (tasks.length === 0) {
      showToast('Task list is already empty.');
      return;
    }
    if (confirm('Are you sure you want to delete all tasks?')) {
      const previousTasks = [...tasks];
      tasks = [];
      saveTasks();
      render();
      showToast('All tasks cleared.', () => {
        tasks = previousTasks;
        saveTasks();
        render();
      });
    }
  });

  // Modal Close Events
  closeModalBtn.addEventListener('click', closeModal);
  cancelEditBtn.addEventListener('click', closeModal);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !editModal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Edit Task Submit
  editTaskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = editTaskId.value;
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.title = editTaskTitle.value.trim();
      task.category = editTaskCategory.value;
      task.priority = editTaskPriority.value;
      task.dueDate = editTaskDueDate.value;
      saveTasks();
      render();
      closeModal();
      showToast('Task updated successfully.');
    }
  });
}

// --- Task Item Actions ---
function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  task.completed = !task.completed;
  saveTasks();

  if (task.completed) {
    playCompletionSound();
    checkAllTasksCompleted();
  }

  render();
}

function openEditModal(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  editTaskId.value = task.id;
  editTaskTitle.value = task.title;
  editTaskCategory.value = task.category;
  editTaskPriority.value = task.priority;
  editTaskDueDate.value = task.dueDate || '';

  editModal.classList.remove('hidden');
  editTaskTitle.focus();
}

function closeModal() {
  editModal.classList.add('hidden');
}

function deleteTask(id, element) {
  const index = tasks.findIndex(t => t.id === id);
  if (index === -1) return;

  const deletedTask = tasks[index];

  // Smooth slide out animation
  if (element) {
    element.classList.add('removing');
    setTimeout(() => {
      tasks.splice(index, 1);
      saveTasks();
      render();
      showToast('Task deleted.', () => {
        tasks.splice(index, 0, deletedTask);
        saveTasks();
        render();
      });
    }, 280);
  } else {
    tasks.splice(index, 1);
    saveTasks();
    render();
  }
}

// --- Filtering & Sorting ---
function getFilteredAndSortedTasks() {
  let result = tasks.filter(task => {
    // Status Filter
    if (activeFilter === 'active' && task.completed) return false;
    if (activeFilter === 'completed' && !task.completed) return false;

    // Category Filter
    if (activeCategory !== 'all' && task.category !== activeCategory) return false;

    // Search Query
    if (searchQuery) {
      const matchTitle = task.title.toLowerCase().includes(searchQuery);
      const matchCat = task.category.toLowerCase().includes(searchQuery);
      if (!matchTitle && !matchCat) return false;
    }

    return true;
  });

  // Sorting
  result.sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return b.createdAt - a.createdAt;
      case 'oldest':
        return a.createdAt - b.createdAt;
      case 'alphabetical':
        return a.title.localeCompare(b.title);
      case 'priority': {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        return (priorityWeight[b.priority] || 0) - (priorityWeight[a.priority] || 0);
      }
      case 'dueDate': {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      }
      default:
        return 0;
    }
  });

  return result;
}

// --- Date Formatting Helper ---
function formatDueDate(dateString) {
  if (!dateString) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [year, month, day] = dateString.split('-').map(Number);
  const dueDate = new Date(year, month - 1, day);
  dueDate.setHours(0, 0, 0, 0);

  const diffTime = dueDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { text: `Overdue (${Math.abs(diffDays)}d ago)`, isOverdue: true };
  } else if (diffDays === 0) {
    return { text: 'Due Today', isOverdue: false, isToday: true };
  } else if (diffDays === 1) {
    return { text: 'Due Tomorrow', isOverdue: false };
  } else {
    const formatted = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return { text: `Due ${formatted}`, isOverdue: false };
  }
}

// Category Emoji Map
const categoryIcons = {
  Personal: '🧘',
  Work: '💼',
  Study: '📚',
  Shopping: '🛒',
  Health: '🏃',
  Finance: '💰',
  Idea: '💡'
};

// --- Render Engine ---
function render() {
  updateProgressDashboard();

  const filteredTasks = getFilteredAndSortedTasks();
  tasksCountHeading.textContent = `Tasks (${filteredTasks.length})`;

  taskListEl.innerHTML = '';

  if (filteredTasks.length === 0) {
    emptyStateEl.classList.remove('hidden');
  } else {
    emptyStateEl.classList.add('hidden');

    filteredTasks.forEach(task => {
      const li = document.createElement('li');
      li.className = `task-item ${task.completed ? 'completed' : ''}`;
      li.dataset.id = task.id;

      // Due date details
      const dateInfo = formatDueDate(task.dueDate);
      let dateBadgeHtml = '';
      if (dateInfo) {
        dateBadgeHtml = `
          <span class="badge badge-date ${dateInfo.isOverdue && !task.completed ? 'overdue' : ''}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            ${escapeHtml(dateInfo.text)}
          </span>
        `;
      }

      const catEmoji = categoryIcons[task.category] || '🎯';

      li.innerHTML = `
        <button class="task-checkbox-btn" aria-label="${task.completed ? 'Mark uncompleted' : 'Mark completed'}" title="${task.completed ? 'Mark uncompleted' : 'Mark completed'}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>

        <div class="task-content">
          <span class="task-title">${escapeHtml(task.title)}</span>
          <div class="task-meta">
            <span class="badge badge-category">${catEmoji} ${escapeHtml(task.category)}</span>
            <span class="badge badge-priority-${task.priority}">
              ${task.priority === 'high' ? '🔴 High' : task.priority === 'medium' ? '🟡 Med' : '🟢 Low'}
            </span>
            ${dateBadgeHtml}
          </div>
        </div>

        <div class="task-actions">
          <button class="task-action-btn edit-btn" aria-label="Edit task" title="Edit task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="task-action-btn delete-btn" aria-label="Delete task" title="Delete task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;

      // Event Handlers for Item
      const checkboxBtn = li.querySelector('.task-checkbox-btn');
      checkboxBtn.addEventListener('click', () => toggleTask(task.id));

      const editBtn = li.querySelector('.edit-btn');
      editBtn.addEventListener('click', () => openEditModal(task.id));

      const deleteBtn = li.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', () => deleteTask(task.id, li));

      taskListEl.appendChild(li);
    });
  }
}

// --- Dashboard & Progress Calculation ---
function updateProgressDashboard() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  const pending = total - completed;
  const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

  statTotal.textContent = total;
  statPending.textContent = pending;
  statCompleted.textContent = completed;

  progressBar.style.width = `${percentage}%`;
  progressPercentage.textContent = `${percentage}%`;

  if (total === 0) {
    greetingText.textContent = 'Welcome to Zenith';
    progressStatusText.textContent = 'Add your first task above to get started!';
  } else if (percentage === 100) {
    greetingText.textContent = 'All Done! 🎉';
    progressStatusText.textContent = 'Outstanding work! You finished everything on your list.';
  } else if (percentage >= 50) {
    greetingText.textContent = 'Great Momentum! ⚡';
    progressStatusText.textContent = `You're over halfway there! ${pending} tasks remaining.`;
  } else {
    greetingText.textContent = 'Daily Progress';
    progressStatusText.textContent = `${pending} tasks pending. Keep pushing forward!`;
  }
}

// --- Toast System with Undo Action ---
function showToast(message, onUndo = null) {
  // Clear any existing timer
  if (undoTimeout) clearTimeout(undoTimeout);

  toastContainer.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = 'toast';

  let contentHtml = `<span>${escapeHtml(message)}</span>`;
  if (onUndo) {
    contentHtml += `<button class="toast-undo-btn">Undo</button>`;
  }
  toast.innerHTML = contentHtml;

  if (onUndo) {
    const undoBtn = toast.querySelector('.toast-undo-btn');
    undoBtn.addEventListener('click', () => {
      onUndo();
      hideToast(toast);
    });
  }

  toastContainer.appendChild(toast);

  undoTimeout = setTimeout(() => {
    hideToast(toast);
  }, 4000);
}

function hideToast(toast) {
  if (!toast) return;
  toast.classList.add('toast-hiding');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 250);
}

// --- Confetti Celebration Effect ---
function checkAllTasksCompleted() {
  const total = tasks.length;
  const completed = tasks.filter(t => t.completed).length;
  if (total > 0 && total === completed) {
    triggerConfetti();
  }
}

function triggerConfetti() {
  if (!confettiCanvas) return;
  const ctx = confettiCanvas.getContext('2d');
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;

  const particles = [];
  const particleCount = 75;
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: confettiCanvas.width / 2 + (Math.random() - 0.5) * 200,
      y: confettiCanvas.height / 2,
      vx: (Math.random() - 0.5) * 14,
      vy: Math.random() * -12 - 4,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
      opacity: 1
    });
  }

  let animationFrame;
  let startTime = Date.now();

  function renderParticles() {
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
    const elapsed = Date.now() - startTime;

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.35; // gravity
      p.rotation += p.rotationSpeed;
      p.opacity -= 0.009;

      if (p.opacity > 0) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (elapsed < 2800) {
      animationFrame = requestAnimationFrame(renderParticles);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      cancelAnimationFrame(animationFrame);
    }
  }

  renderParticles();
}

// Helper: Escape HTML to avoid XSS
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
