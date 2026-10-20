
from flask import Flask, jsonify, request 
from flask_cors import CORS
import sqlite3

app = Flask(__name__)
CORS(app)

DATABASE = "tasks.db"


# Connect to the database
def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# Create the tasks table
def create_table():
    conn = get_db()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed INTEGER DEFAULT 0
        )
    """)

    conn.commit()
    conn.close()


# Home route
@app.route("/")
def home():
    return jsonify({
        "message": "Student Task Management Backend is running!"
    })


# Get all tasks
@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    conn = get_db()
    tasks = conn.execute("SELECT * FROM tasks").fetchall()
    conn.close()

    return jsonify([dict(task) for task in tasks])


# Add a task
@app.route("/api/tasks", methods=["POST"])
def add_task():
    data = request.get_json()

    if not data or not data.get("title", "").strip():
        return jsonify({"error": "Task title is required"}), 400

    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO tasks (title) VALUES (?)",
        (data["title"].strip(),)
    )
    conn.commit()

    task_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "id": task_id,
        "title": data["title"].strip(),
        "completed": 0
    }), 201


# Complete or uncomplete a task
@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
def update_task(task_id):
    data = request.get_json() or {}

    if "completed" not in data:
        return jsonify({"error": "completed field is required"}), 400

    conn = get_db()
    cursor = conn.execute(
        "UPDATE tasks SET completed = ? WHERE id = ?",
        (1 if data["completed"] else 0, task_id)
    )
    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task updated successfully"})


# Delete a task
@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    conn = get_db()
    cursor = conn.execute(
        "DELETE FROM tasks WHERE id = ?",
        (task_id,)
    )
    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task deleted successfully"})


if __name__ == "__main__":
    create_table()
    app.run(debug=True)
