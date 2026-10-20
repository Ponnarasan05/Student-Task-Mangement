/**
 * Student Task Manager - Frontend Controller
 * Connects securely with the Flask / SQLite API using JWT authentication
 */

// ============================================================
// 1. Backend Configuration
// ============================================================
// For Local Testing: "http://127.0.0.1:5000"
// For Render Production Deployment: "https://student-task-management-vimy.onrender.com"
const API_BASE_URL = "https://student-task-management-vimy.onrender.com";
const TASKS_ENDPOINT = `${API_BASE_URL}/api/tasks`;
const AUTH_ENDPOINT = `${API_BASE_URL}/api`;

// Storage Keys (sessionStorage ensures tokens clear when the tab closes)
const TOKEN_KEY = "stm_token";
const USERNAME_KEY = "stm_username";

// ============================================================
// 2. DOM Elements
// ============================================================
// Core Task Dashboard Elements
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const emptyTitle = document.getElementById("empty-title");
const emptySubtitle = document.getElementById("empty-subtitle");
const taskCount = document.getElementById("task-count");
const completedCount = document.getElementById("completed-count");
const addBtn = document.getElementById("add-btn");
const progressRate = document.getElementById("progress-rate");
const progressFill = document.getElementById("progress-fill");
const filterAllBadge = document.getElementById("filter-all-badge");
const filterActiveBadge = document.getElementById("filter-active-badge");
const filterCompletedBadge = document.getElementById("filter-completed-badge");
const searchInput = document.getElementById("search-input");
const currentDateEl = document.getElementById("current-date");
const statusLabel = document.getElementById("status-label");
const syncStatus = document.getElementById("sync-status");
const toastContainer = document.getElementById("toast-container");

// Auth Navigation Elements
const authNavContainer = document.getElementById("auth-nav-container");
const btnOpenLogin = document.getElementById("btn-open-login");
const userDisplayName = document.getElementById("user-display-name");
const btnLogout = document.getElementById("btn-logout");

// Auth Modal & Form Elements
const authModal = document.getElementById("auth-modal");
const authModalClose = document.getElementById("auth-modal-close");
const tabLogin = document.getElementById("tab-login");
const tabRegister = document.getElementById("tab-register");
const loginPanel = document.getElementById("login-panel");
const registerPanel = document.getElementById("register-panel");
const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginUsernameInput = document.getElementById("login-username");
const loginPasswordInput = document.getElementById("login-password");
const registerUsernameInput = document.getElementById("register-username");
const registerPasswordInput = document.getElementById("register-password");
const loginErrorBanner = document.getElementById("login-error-banner");
const registerErrorBanner = document.getElementById("register-error-banner");
const loginSubmitBtn = document.getElementById("login-submit-btn");
const registerSubmitBtn = document.getElementById("register-submit-btn");
const switchToRegister = document.getElementById("switch-to-register");
const switchToLogin = document.getElementById("switch-to-login");

// State
let tasks = [];
let currentFilter = "all"; // 'all' | 'active' | 'completed'
let searchQuery = "";
let isSubmitting = false;

// ============================================================
// 3. JWT & Session Management (sessionStorage)
// ============================================================
function getAuthToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

function setAuthSession(token, username) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
  if (username) {
    sessionStorage.setItem(USERNAME_KEY, username);
  }
}

function clearAuthSession() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USERNAME_KEY);
}

function isAuthenticated() {
  return Boolean(getAuthToken());
}

// ============================================================
// 4. UI State & Navigation Controller
// ============================================================
function updateAuthUI(isLoggedIn, username = "") {
  if (authNavContainer) {
    if (isLoggedIn) {
      authNavContainer.classList.add("logged-in");
    } else {
      authNavContainer.classList.remove("logged-in");
    }
  }

  if (userDisplayName) {
    userDisplayName.textContent = username || "Student";
  }

  // Manage task input readiness
  if (taskInput) {
    taskInput.disabled = !isLoggedIn;
    taskInput.placeholder = isLoggedIn
      ? "e.g. Finish Math Chapter 4 Exercises..."
      : "Please sign in above to add personal tasks...";
  }
  if (addBtn) {
    addBtn.disabled = !isLoggedIn;
  }
}

function openAuthModal(mode = "login") {
  if (!authModal) return;
  clearAuthErrors();
  switchAuthTab(mode);
  authModal.classList.add("open");

  // Keyboard accessibility: focus on first active input
  setTimeout(() => {
    if (mode === "login" && loginUsernameInput) {
      loginUsernameInput.focus();
    } else if (mode === "register" && registerUsernameInput) {
      registerUsernameInput.focus();
    }
  }, 100);
}

function closeAuthModal() {
  if (!authModal) return;
  authModal.classList.remove("open");
  if (window.location.hash === "#auth-modal") {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  clearAuthErrors();
}

function switchAuthTab(mode) {
  clearAuthErrors();
  const isLogin = mode === "login";

  if (tabLogin) {
    tabLogin.classList.toggle("active", isLogin);
    tabLogin.setAttribute("aria-selected", isLogin ? "true" : "false");
  }
  if (tabRegister) {
    tabRegister.classList.toggle("active", !isLogin);
    tabRegister.setAttribute("aria-selected", !isLogin ? "true" : "false");
  }

  if (loginPanel) {
    loginPanel.classList.toggle("active", isLogin);
    loginPanel.hidden = !isLogin;
  }
  if (registerPanel) {
    registerPanel.classList.toggle("active", !isLogin);
    registerPanel.hidden = isLogin;
  }

  if (isLogin && loginUsernameInput) {
    loginUsernameInput.focus();
  } else if (!isLogin && registerUsernameInput) {
    registerUsernameInput.focus();
  }
}

function showAuthError(panel, message) {
  const banner = panel === "login" ? loginErrorBanner : registerErrorBanner;
  if (!banner) return;
  banner.textContent = message;
  banner.hidden = false;
}

function clearAuthErrors() {
  if (loginErrorBanner) {
    loginErrorBanner.textContent = "";
    loginErrorBanner.hidden = true;
  }
  if (registerErrorBanner) {
    registerErrorBanner.textContent = "";
    registerErrorBanner.hidden = true;
  }
}

// ============================================================
// 5. Authenticated Fetch Helper
// ============================================================
async function authFetch(url, options = {}) {
  const token = getAuthToken();
  if (!token) {
    handleUnauthorized("Please sign in to view and manage tasks.");
    throw new Error("Unauthorized: No token in session");
  }

  const headers = {
    "Authorization": `Bearer ${token}`,
    ...(options.headers || {})
  };

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (networkError) {
    console.error("Network error during request:", networkError);
    setSyncStatus("offline", "Offline");
    throw new Error("Unable to connect to backend. Please ensure Flask is running.");
  }

  if (response.status === 401) {
    handleUnauthorized("Your session has expired or is invalid. Please sign in again.");
    throw new Error("Unauthorized: Invalid session");
  }

  return response;
}

function handleUnauthorized(message) {
  clearAuthSession();
  updateAuthUI(false);
  tasks = [];
  renderTasks();
  showToast(message, "error");
  openAuthModal("login");
}

// ============================================================
// 6. Registration, Login & Logout Handlers
// ============================================================
async function handleLogin(event) {
  event.preventDefault();
  clearAuthErrors();

  const username = loginUsernameInput ? loginUsernameInput.value.trim() : "";
  const password = loginPasswordInput ? loginPasswordInput.value : "";

  if (!username || !password) {
    showAuthError("login", "Please provide both username and password.");
    return;
  }

  const originalBtnHTML = loginSubmitBtn.innerHTML;
  loginSubmitBtn.disabled = true;
  loginSubmitBtn.innerHTML = `<span>Signing in...</span>`;

  try {
    const response = await fetch(`${AUTH_ENDPOINT}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || `Login failed (${response.status})`;
      showAuthError("login", errorMsg);
      return;
    }

    // Success: store in sessionStorage (clears on tab close)
    setAuthSession(data.token, data.user.username);
    updateAuthUI(true, data.user.username);
    closeAuthModal();

    if (loginForm) loginForm.reset();
    showToast(`Welcome back, ${data.user.username}!`, "success");

    await loadTasks();
  } catch (error) {
    console.error("Login request failed:", error);
    showAuthError("login", "Network error. Make sure the local Flask server is running.");
  } finally {
    loginSubmitBtn.disabled = false;
    loginSubmitBtn.innerHTML = originalBtnHTML;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  clearAuthErrors();

  const username = registerUsernameInput ? registerUsernameInput.value.trim() : "";
  const password = registerPasswordInput ? registerPasswordInput.value : "";

  if (!username || !password) {
    showAuthError("register", "Please fill in all registration fields.");
    return;
  }

  if (username.length < 3 || username.length > 50) {
    showAuthError("register", "Username must be between 3 and 50 characters.");
    return;
  }

  if (password.length < 6 || password.length > 128) {
    showAuthError("register", "Password must be at least 6 characters.");
    return;
  }

  const originalBtnHTML = registerSubmitBtn.innerHTML;
  registerSubmitBtn.disabled = true;
  registerSubmitBtn.innerHTML = `<span>Creating account...</span>`;

  try {
    const response = await fetch(`${AUTH_ENDPOINT}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMsg = data.error || `Registration failed (${response.status})`;
      showAuthError("register", errorMsg);
      return;
    }

    // Success: store in sessionStorage
    setAuthSession(data.token, data.user.username);
    updateAuthUI(true, data.user.username);
    closeAuthModal();

    if (registerForm) registerForm.reset();
    showToast(`Account created! Welcome, ${data.user.username}! 🎉`, "success");

    await loadTasks();
  } catch (error) {
    console.error("Registration request failed:", error);
    showAuthError("register", "Network error. Make sure the local Flask server is running.");
  } finally {
    registerSubmitBtn.disabled = false;
    registerSubmitBtn.innerHTML = originalBtnHTML;
  }
}

function handleLogout() {
  clearAuthSession();
  updateAuthUI(false);
  tasks = [];
  renderTasks();
  setSyncStatus("offline", "Signed Out");
  showToast("You have been signed out.", "info");
}

// ============================================================
// 7. Date Display & Toast Notification Helpers
// ============================================================
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

function showToast(message, type = "info") {
  if (!toastContainer) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const iconSpan = document.createElement("span");
  iconSpan.className = "toast-icon";
  iconSpan.textContent = type === "success" ? "✓" : type === "error" ? "⚠️" : "ℹ️";

  const textSpan = document.createElement("span");
  textSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(textSpan);
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "toastFadeOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

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

// ============================================================
// 8. User-Scoped Task Operations
// ============================================================
async function loadTasks() {
  if (!isAuthenticated()) {
    tasks = [];
    renderTasks();
    setSyncStatus("offline", "Signed Out");
    return;
  }

  setSyncStatus("syncing", "Syncing...");
  try {
    const response = await authFetch(TASKS_ENDPOINT);
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
    setSyncStatus("offline", "Error");
    renderTasks();
  }
}

async function addTask(title) {
  if (!isAuthenticated()) {
    showToast("Please sign in to add tasks.", "error");
    openAuthModal("login");
    return;
  }

  setSyncStatus("syncing", "Saving...");
  try {
    const response = await authFetch(TASKS_ENDPOINT, {
      method: "POST",
      body: JSON.stringify({ title })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Could not add task (${response.status})`);
    }

    showToast("Task added successfully!", "success");
    await loadTasks();
  } catch (error) {
    console.error("Adding task failed:", error);
    setSyncStatus("offline", "Error");
    showToast(error.message || "Could not add task.", "error");
  }
}

async function toggleTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  const nextState = !task.completed;
  setSyncStatus("syncing", "Updating...");

  try {
    const response = await authFetch(`${TASKS_ENDPOINT}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ completed: nextState })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Could not update task (${response.status})`);
    }

    showToast(nextState ? "Task completed! 🎉" : "Task marked in progress", "info");
    await loadTasks();
  } catch (error) {
    console.error("Updating task failed:", error);
    setSyncStatus("offline", "Error");
    showToast(error.message || "Could not update task.", "error");
  }
}

async function deleteTask(id) {
  const task = tasks.find(t => t.id === id);
  const taskName = task ? task.title : "Task";

  setSyncStatus("syncing", "Deleting...");
  try {
    const response = await authFetch(`${TASKS_ENDPOINT}/${id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Could not delete task (${response.status})`);
    }

    showToast(`Removed "${taskName.length > 25 ? taskName.slice(0, 22) + "..." : taskName}"`, "info");
    await loadTasks();
  } catch (error) {
    console.error("Deleting task failed:", error);
    setSyncStatus("offline", "Error");
    showToast(error.message || "Could not delete task.", "error");
  }
}

// ============================================================
// 9. Task Rendering & Stats
// ============================================================
function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const remaining = total - completed;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  if (taskCount) {
    taskCount.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} remaining`;
  }
  if (completedCount) {
    completedCount.textContent = `${completed} completed`;
  }
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

function renderTasks() {
  taskList.innerHTML = "";

  if (!isAuthenticated()) {
    emptyState.classList.add("visible");
    if (emptyTitle) emptyTitle.textContent = "Sign in to manage your tasks";
    if (emptySubtitle) emptySubtitle.textContent = "Your coursework and personal study goals are safely isolated to your account.";
    updateStats();
    return;
  }

  const filtered = tasks.filter(task => {
    if (currentFilter === "active" && task.completed) return false;
    if (currentFilter === "completed" && !task.completed) return false;

    if (searchQuery.trim() !== "") {
      return task.title.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

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

  filtered.forEach(task => {
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""}`;
    li.setAttribute("data-id", task.id);

    // Left Section: Checkbox + Safe Task Title
    const leftDiv = document.createElement("div");
    leftDiv.className = "task-left";

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

    const contentDiv = document.createElement("div");
    contentDiv.className = "task-content";

    // Safe DOM API: textContent prevents XSS injection
    const titleSpan = document.createElement("span");
    titleSpan.className = "task-text";
    titleSpan.textContent = task.title;
    titleSpan.addEventListener("click", () => toggleTask(task.id));

    contentDiv.appendChild(titleSpan);
    leftDiv.append(checkboxLabel, contentDiv);

    // Right Section: Delete Action
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

// ============================================================
// 10. Event Listeners & Interactive Handlers
// ============================================================
// Add Task Form Submission
if (taskForm) {
  taskForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (isSubmitting) return;

    const title = taskInput.value.trim();
    if (!title) return;

    if (!isAuthenticated()) {
      showToast("Please sign in to add tasks.", "error");
      openAuthModal("login");
      return;
    }

    isSubmitting = true;
    taskInput.disabled = true;
    const originalBtnHTML = addBtn.innerHTML;
    addBtn.disabled = true;
    addBtn.innerHTML = `<span>Adding...</span>`;

    try {
      await addTask(title);
      taskInput.value = "";
    } finally {
      isSubmitting = false;
      taskInput.disabled = false;
      addBtn.disabled = false;
      addBtn.innerHTML = originalBtnHTML;
      taskInput.focus();
    }
  });
}

// Filter Tabs
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

// Search Filter
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    renderTasks();
  });
}

// Quick Suggestion Chips
document.querySelectorAll(".suggestion-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    const sampleTask = chip.getAttribute("data-task");
    if (sampleTask && taskInput) {
      taskInput.value = sampleTask;
      taskInput.focus();
    }
  });
});

// Modal Open Trigger
if (btnOpenLogin) {
  btnOpenLogin.addEventListener("click", (e) => {
    e.preventDefault();
    openAuthModal("login");
  });
}

// Modal Close Button
if (authModalClose) {
  authModalClose.addEventListener("click", (e) => {
    e.preventDefault();
    closeAuthModal();
  });
}

// Close Modal on Outside Backdrop Click
if (authModal) {
  authModal.addEventListener("click", (e) => {
    if (e.target === authModal) {
      closeAuthModal();
    }
  });
}

// Close Modal on Escape Key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && authModal && authModal.classList.contains("open")) {
    closeAuthModal();
  }
});

// Tab Switching
if (tabLogin) {
  tabLogin.addEventListener("click", () => switchAuthTab("login"));
}
if (tabRegister) {
  tabRegister.addEventListener("click", () => switchAuthTab("register"));
}
if (switchToRegister) {
  switchToRegister.addEventListener("click", () => switchAuthTab("register"));
}
if (switchToLogin) {
  switchToLogin.addEventListener("click", () => switchAuthTab("login"));
}

// Form Submissions
if (loginForm) {
  loginForm.addEventListener("submit", handleLogin);
}
if (registerForm) {
  registerForm.addEventListener("submit", handleRegister);
}

// Logout Trigger
if (btnLogout) {
  btnLogout.addEventListener("click", handleLogout);
}

// ============================================================
// 11. Application Initialization & Session Verification
// ============================================================
async function initApp() {
  initDateDisplay();

  const token = getAuthToken();
  const cachedUsername = sessionStorage.getItem(USERNAME_KEY);

  if (!token) {
    updateAuthUI(false);
    setSyncStatus("offline", "Signed Out");
    renderTasks();
    return;
  }

  // Restore optimistic UI display while validating session with GET /api/me
  updateAuthUI(true, cachedUsername || "Student");
  setSyncStatus("syncing", "Verifying session...");

  try {
    const response = await fetch(`${AUTH_ENDPOINT}/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const verifiedUsername = data.user && data.user.username ? data.user.username : cachedUsername;
      setAuthSession(token, verifiedUsername);
      updateAuthUI(true, verifiedUsername);
      await loadTasks();
    } else {
      // Token is expired, invalid, or user was deleted
      clearAuthSession();
      updateAuthUI(false);
      setSyncStatus("offline", "Signed Out");
      renderTasks();
    }
  } catch (err) {
    console.error("Session verification failed:", err);
    setSyncStatus("offline", "Offline");
    // Preserve local state if offline; user can still see cached state or retry
  }
}

// Start application
initApp();
