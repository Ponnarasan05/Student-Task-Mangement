/* ============================================================
   Student Task Manager - script.js
   ============================================================
   This file is the "brain" of the application. It handles:
   1. State: Storing and updating our list of tasks.
   2. LocalStorage: Saving tasks so they persist on page refresh.
   3. DOM Manipulation: Showing tasks dynamically on the screen.
   4. Event Listeners: Responding to user actions (Add, Toggle, Delete).
   ============================================================ */

// 1. SELECT DOM ELEMENTS
// We grab references to the HTML elements we need to interact with.
const taskForm = document.getElementById("task-form");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const emptyState = document.getElementById("empty-state");
const taskCount = document.getElementById("task-count");
const completedCount = document.getElementById("completed-count");

// 2. LOAD TASKS FROM LOCALSTORAGE
// localStorage only saves strings. We use JSON.parse() to turn it back into a JavaScript array.
// If no tasks exist yet in storage, we fall back to an empty array: []
let tasks = JSON.parse(localStorage.getItem("student_tasks")) || [];

// 3. SAVE TASKS TO LOCALSTORAGE
// This helper function converts our tasks array into a string using JSON.stringify()
// and saves it under the key "student_tasks".
function saveTasks() {
  localStorage.setItem("student_tasks", JSON.stringify(tasks));
}

// 4. UPDATE STATS COUNTER
// Updates the count of remaining and completed tasks.
function updateStats() {
  const total = tasks.length;
  const completed = tasks.filter(task => task.completed).length;
  const remaining = total - completed;

  taskCount.textContent = `${remaining} ${remaining === 1 ? "task" : "tasks"} remaining`;
  completedCount.textContent = `${completed} completed`;
}

// 5. RENDER TASKS TO THE SCREEN
// This function clears the current list and re-draws all tasks from the `tasks` array.
function renderTasks() {
  // Clear the existing list inside <ul>
  taskList.innerHTML = "";

  // Show or hide the empty state message
  if (tasks.length === 0) {
    emptyState.classList.add("visible");
  } else {
    emptyState.classList.remove("visible");
  }

  // Loop through each task in our array and create HTML for it
  tasks.forEach((task) => {
    // Create an <li> element for each task
    const li = document.createElement("li");
    li.className = `task-item ${task.completed ? "completed" : ""}`;

    // Create the left side: Checkbox + Title text
    const leftDiv = document.createElement("div");
    leftDiv.className = "task-left";

    // Create checkbox input
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "task-checkbox";
    checkbox.checked = task.completed;
    
    // When the checkbox changes, toggle the completed state
    checkbox.addEventListener("change", () => {
      toggleTask(task.id);
    });

    // Create task title span
    const titleSpan = document.createElement("span");
    titleSpan.className = "task-text";
    titleSpan.textContent = task.title;

    // Clicking the title text also toggles the checkbox for better UX
    titleSpan.addEventListener("click", () => {
      toggleTask(task.id);
    });

    leftDiv.appendChild(checkbox);
    leftDiv.appendChild(titleSpan);

    // Create delete button
    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.innerHTML = "&times;"; // HTML multiplication sign looks like an 'x'
    deleteBtn.setAttribute("aria-label", "Delete task");
    
    // When clicked, delete this specific task
    deleteBtn.addEventListener("click", () => {
      deleteTask(task.id);
    });

    // Assemble everything into the <li>
    li.appendChild(leftDiv);
    li.appendChild(deleteBtn);

    // Add this task item into the <ul> container
    taskList.appendChild(li);
  });

  // Keep the stats counters updated
  updateStats();
}

// 6. ADD A NEW TASK
function addTask(title) {
  const newTask = {
    id: Date.now(), // Unique ID using the current timestamp in milliseconds
    title: title.trim(),
    completed: false
  };

  // Add the new task to the beginning of the list
  tasks.unshift(newTask);

  // Save to browser localStorage and re-render
  saveTasks();
  renderTasks();
}

// 7. TOGGLE TASK COMPLETION
function toggleTask(id) {
  // Find the task with the matching ID and flip its 'completed' boolean value
  tasks = tasks.map((task) => {
    if (task.id === id) {
      return { ...task, completed: !task.completed };
    }
    return task;
  });

  saveTasks();
  renderTasks();
}

// 8. DELETE A TASK
function deleteTask(id) {
  // Filter out the task that matches the ID, keeping all others
  tasks = tasks.filter((task) => task.id !== id);

  saveTasks();
  renderTasks();
}

// 9. EVENT LISTENERS
// Listen for form submission (when user presses Enter or clicks "+ Add Task")
taskForm.addEventListener("submit", (e) => {
  e.preventDefault(); // Prevents the browser from refreshing the page

  const text = taskInput.value.trim();
  if (text !== "") {
    addTask(text);
    taskInput.value = ""; // Clear input field
    taskInput.focus();    // Put cursor back into the input for fast typing
  }
});

// 10. INITIALIZATION
// Render any saved tasks as soon as the script runs
renderTasks();
