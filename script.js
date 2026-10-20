/**
 * Student Task Manager - Frontend Controller
 * Connects seamlessly with the Flask / SQLite API
 */

// Keep exact backend API endpoint intact
const API_URL = "https://student-task-mangement-vimy.onrender.com/api/tasks";

// Core DOM Elements (Preserving all original IDs)
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const taskCount = document.getElementById("task-count");
const completedCount = document.getElementById("completed-count");
const addBtn = document.getElementById("add-btn");

// Extended UI Elements for Modern Dashboard Experience
const progressRate = document.getElementById("progress-rate");
const progressFill = document.getElementById("progress-fill");
const filterAllBadge = document.getElementById("filter-all-badge");
const filterActiveBadge = document.getElementById("filter-active-badge");
const filterCompletedBadge = document.getElementById("filter-completed-badge");
const searchInput = document.getElementById("search-input");
const currentDateEl = document.getElementById("current-date");
const statusLabel = document.getElementById("status-label");
const syncStatus = document.getElementById("sync-status");
const emptyTitle = document.getElementById("empty-title");
const emptySubtitle = document.getElementById("empty-subtitle");
const toastContainer = document.getElementById("toast-container");

// State
let tasks = [];
let currentFilter = "all"; // 'all' | 'active' | 'completed'
let searchQuery = "";

// 1. Format and display today's date
function initDateDisplay() {
  if (!currentDateEl) return;
  try {
    const today = new Date();
    const options = { weekday: "short", month: "short", day: "numeric" };
    currentDateEl.textContent = `Today • ${today.toLocaleDateString("en-US", options)}`;
  } catch (e) {
    currentDateEl.textContent = "Today's Schedule";
  }
}

// 2. Toast Notification Helper
function showToast(message, type = "info") {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  
  const icon = type === "success" ? "✓" : type === "error" ? "⚠️" : "ℹ️";
  toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${escapeHtml(message)}</span>`;
  
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toastFadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Helper to escape HTML characters
function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// 3. Update sync status indicator
function setSyncStatus(status, text) {
  if (!statusLabel || !syncStatus) return;
  statusLabel.textContent = text;
  
  if (status === "syncing") {
    syncStatus.style.backgroundColor = "var(--primary-soft)";
    syncStatus.style.borderColor = "var(--primary-border)";
    syncStatus.style.color = "var(--primary)";
  } else if (status === "online") {
    syncStatus.style.backgroundColor = "var(--emerald-soft)";
    syncStatus.style.borderColor = "var(--emerald-border)";
    syncStatus.style.color = "#059669";
  } else if (status === "offline") {
    syncStatus.style.backgroundColor = "var(--danger-soft)";
    syncStatus.style.borderColor = "var(--danger-border)";
    syncStatus.style.color = "var(--danger)";
  }
}

// 4. GET: Load tasks from the Flask backend
async function loadTasks() {
  setSyncStatus("syncing", "Syncing...");
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    tasks = data.map(task => ({
      ...task,
      completed: Boolean(task.completed)
    }));

    setSyncStatus("online", "Online");
    renderTasks();
  } catch (error) {
    console.error("Loading tasks failed:", error);
    setSyncStatus("offline", "Offline");
    showToast("Backend may be waking up (free cloud tier). Retrying in background...", "error");
    renderTasks();
  }
}

// 5. Update task counters & visual progress bar
function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const remaining = total - completed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Preserve exact legacy format
  if (taskCount) {
    taskCount.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} remaining`;
  }
  if (completedCount) {
    completedCount.textContent = `${completed} completed`;
  }

  // Modern dashboard extensions
  if (progressRate) {
    progressRate.textContent = `${percentage}%`;
  }
  if (progressFill) {
    progressFill.style.width = `${percentage}%`;
  }

  if (filterAllBadge) filterAllBadge.textContent = total;
  if (filterActiveBadge) filterActiveBadge.textContent = remaining;
  if (filterCompletedBadge) filterCompletedBadge.textContent = completed;
}

// 6. Display tasks based on active filter and search query
function renderTasks() {
  taskList.innerHTML = "";

  // Apply filter & search
  const filtered = tasks.filter(task => {
    // Status filter
    if (currentFilter === "active" && task.completed) return false;
    if (currentFilter === "completed" && !task.completed) return false;

    // Search query filter
    if (searchQuery.trim() !== "") {
      return task.title.toLowerCase().includes(searchQuery.toLowerCase());
    }

    return true;
  });

  // Handle empty states with helpful messaging
  const isListEmpty = filtered.length === 0;
  emptyState.classList.toggle("visible", isListEmpty);

  if (isListEmpty) {
    if (tasks.length === 0) {
      emptyTitle.textContent = "All caught up!";
      emptySubtitle.textContent = "You don't have any tasks scheduled. Add your first assignment or study goal above.";
    } else if (searchQuery.trim() !== "") {
      emptyTitle.textContent = "No matching tasks found";
      emptySubtitle.textContent = `No results found for "${searchQuery}". Try a different keyword.`;
    } else if (currentFilter === "active") {
      emptyTitle.textContent = "No pending tasks!";
      emptySubtitle.textContent = "Awesome job! You have completed every task on your desk.";
    } else if (currentFilter === "completed") {
      emptyTitle.textContent = "No completed tasks yet";
      emptySubtitle.textContent = "Tasks you mark as completed will appear here.";
    }
  }

  // Populate task cards
  filtered.forEach(task => {
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""}`;
    li.setAttribute("data-id", task.id);

    // Left Section: Custom Accessible Checkbox + Task Text
    const leftDiv = document.createElement("div");
    leftDiv.className = "task-left";

    // Custom Styled Checkbox Container
    const checkboxLabel = document.createElement("label");
    checkboxLabel.className = "checkbox-container";
    checkboxLabel.setAttribute("title", task.completed ? "Mark incomplete" : "Mark completed");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Complete task: ${task.title}`);
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const customCheckmark = document.createElement("span");
    customCheckmark.className = "custom-checkmark";
    customCheckmark.innerHTML = `
      <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z" clip-rule="evenodd" />
      </svg>
    `;

    checkboxLabel.append(checkbox, customCheckmark);

    // Title Span inside a wrapper
    const contentDiv = document.createElement("div");
    contentDiv.className = "task-content";

    const titleSpan = document.createElement("span");
    titleSpan.className = "task-text";
    titleSpan.textContent = task.title;
    titleSpan.addEventListener("click", () => toggleTask(task.id));

    contentDiv.appendChild(titleSpan);
    leftDiv.append(checkboxLabel, contentDiv);

    // Actions: Delete Button with sleek SVG
    const actionsDiv = document.createElement("div");
    actionsDiv.className = "task-actions";

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.setAttribute("aria-label", `Delete task: ${task.title}`);
    deleteBtn.setAttribute("title", "Delete task");
    deleteBtn.innerHTML = `
      <svg class="delete-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd" />
      </svg>
    `;
    deleteBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    actionsDiv.appendChild(deleteBtn);
    li.append(leftDiv, actionsDiv);
    taskList.appendChild(li);
  });

  updateStats();
}

// 7. POST: Add a task to the database
async function addTask(title) {
  setSyncStatus("syncing", "Saving...");
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });

    if (!response.ok) {
      throw new Error(`Could not add task (${response.status})`);
    }

    showToast("Task added successfully!", "success");
    await loadTasks();
  } catch (error) {
    console.error("Adding task failed:", error);
    setSyncStatus("offline", "Error");
    showToast("Could not add task. Check that the backend is running.", "error");
  }
}

// 8. PATCH: Change task completion status
async function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const nextState = !task.completed;
  setSyncStatus("syncing", "Updating...");

  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: nextState })
    });

    if (!response.ok) {
      throw new Error(`Could not update task (${response.status})`);
    }

    showToast(nextState ? "Task completed! 🎉" : "Task marked in progress", "info");
    await loadTasks();
  } catch (error) {
    console.error("Updating task failed:", error);
    setSyncStatus("offline", "Error");
    showToast("Could not update task. Please try again.", "error");
  }
}

// 9. DELETE: Remove a task from the database
async function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  const taskName = task ? task.title : "Task";

  setSyncStatus("syncing", "Deleting...");
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error(`Could not delete task (${response.status})`);
    }

    showToast(`Removed "${taskName.length > 25 ? taskName.slice(0, 22) + "..." : taskName}"`, "info");
    await loadTasks();
  } catch (error) {
    console.error("Deleting task failed:", error);
    setSyncStatus("offline", "Error");
    showToast("Could not delete task. Please try again.", "error");
  }
}

// 10. Handle Form Submission
taskForm.addEventListener("submit", async event => {
  event.preventDefault();

  const title = taskInput.value.trim();
  if (!title) return;

  taskInput.disabled = true;
  const originalBtnHTML = addBtn.innerHTML;
  addBtn.disabled = true;
  addBtn.innerHTML = `<span>Adding...</span>`;

  try {
    await addTask(title);
    taskInput.value = "";
  } finally {
    taskInput.disabled = false;
    addBtn.disabled = false;
    addBtn.innerHTML = originalBtnHTML;
    taskInput.focus();
  }
});

// 11. Interactive Filter Tabs
document.querySelectorAll(".filter-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".filter-tab").forEach(t => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    currentFilter = tab.getAttribute("data-filter") || "all";
    renderTasks();
  });
});

// 12. Instant Search Filter
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderTasks();
  });
}

// 13. Quick Suggestion Chips Handlers
document.querySelectorAll(".suggestion-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const sampleTask = chip.getAttribute("data-task");
    if (sampleTask && taskInput) {
      taskInput.value = sampleTask;
      taskInput.focus();
    }
  });
});

// 14. Initialize Application
initDateDisplay();
loadTasks();
