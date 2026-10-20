const API_URL = "https://student-task-mangement-vimy.onrender.com/api/tasks";
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const taskCount = document.getElementById("task-count");

const completedCount = document.getElementById("completed-count");

let tasks = [];

// 1. GET: Load tasks from the Flask backend
async function loadTasks() {
  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error("Could not load tasks");
    }

    tasks = (await response.json()).map(task => ({
      ...task,
      completed: Boolean(task.completed)
    }));

    renderTasks();
  } catch (error) {
    console.error("Loading tasks failed:", error);
    alert("Could not connect to the backend. Make sure Flask is running.");
  }
}

// 2. Update task counters
function updateStats() {
  const completed = tasks.filter(task => task.completed).length;
  const remaining = tasks.length - completed;

  taskCount.textContent =
    `${remaining} ${remaining === 1 ? "task" : "tasks"} remaining`;

  completedCount.textContent = `${completed} completed`;
}

// 3. Display tasks
function renderTasks() {
  taskList.innerHTML = "";

  emptyState.classList.toggle("visible", tasks.length === 0);

  tasks.forEach(task => {
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""}`;

    const leftDiv = document.createElement("div");
    leftDiv.className = "task-left";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;
    checkbox.addEventListener("change", () => toggleTask(task.id));

    const titleSpan = document.createElement("span");
    titleSpan.className = "task-text";
    titleSpan.textContent = task.title;
    titleSpan.addEventListener("click", () => toggleTask(task.id));

    leftDiv.append(checkbox, titleSpan);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "&times;";
    deleteBtn.setAttribute("aria-label", "Delete task");
    deleteBtn.addEventListener("click", () => deleteTask(task.id));

    li.append(leftDiv, deleteBtn);
    taskList.appendChild(li);
  });

  updateStats();
}

// 4. POST: Add a task to the database
async function addTask(title) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title })
    });

    if (!response.ok) {
      throw new Error("Could not add task");
    }

    await loadTasks();
  } catch (error) {
    console.error("Adding task failed:", error);
    alert("Could not add task. Check that the backend is running.");
  }
}

// 5. PATCH: Change completion status
async function toggleTask(id) {
  const task = tasks.find(task => task.id === id);
  if (!task) return;

  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: !task.completed })
    });

    if (!response.ok) {
      throw new Error("Could not update task");
    }

    await loadTasks();
  } catch (error) {
    console.error("Updating task failed:", error);
    alert("Could not update task. Please try again.");
  }
}

// 6. DELETE: Remove a task from the database
async function deleteTask(id) {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      throw new Error("Could not delete task");
    }

    await loadTasks();
  } catch (error) {
    console.error("Deleting task failed:", error);
    alert("Could not delete task. Please try again.");
  }
}

// 7. Handle form submission
taskForm.addEventListener("submit", async event => {
  event.preventDefault();

  const title = taskInput.value.trim();
  if (!title) return;

  taskInput.disabled = true;

  try {
    await addTask(title);
    taskInput.value = "";
  } finally {
    taskInput.disabled = false;
    taskInput.focus();
  }
});

// 8. Load saved tasks when the page opens
loadTasks();
