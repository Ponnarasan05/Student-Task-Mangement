
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Flask, jsonify, request, g
from flask_cors import CORS
import jwt
from werkzeug.security import generate_password_hash, check_password_hash


app = Flask(__name__)

# Configure CORS to permit Authorization headers across origins (e.g. GitHub Pages)
CORS(
    app,
    resources={r"/*": {"origins": "*"}},
    allow_headers=["Content-Type", "Authorization"]
)

# Read SECRET_KEY strictly from environment; no hardcoded production fallback
SECRET_KEY = os.environ.get("SECRET_KEY")
app.config["SECRET_KEY"] = SECRET_KEY


def get_jwt_secret():
    """
    Retrieve SECRET_KEY securely.
    Does not use a hardcoded production fallback.
    In production, if SECRET_KEY is missing, authentication operations fail safely.
    In local development/debug mode, permits a designated dev key with a clear fallback.
    """
    key = os.environ.get("SECRET_KEY")
    if not key:
        if app.debug or os.environ.get("FLASK_DEBUG") == "1":
            return "dev-local-only-insecure-secret-key"
        return None
    return key


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.environ.get("DATABASE_PATH", os.path.join(BASE_DIR, "tasks.db"))



# Connect to the database
def get_db():
    conn = sqlite3.connect(DATABASE, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


# Initialize and safely migrate database schema
def init_db():
    """
    Safely initialize and migrate the database schema.
    Idempotent, transactional, and safe for concurrent startup.
    Preserves all existing task rows with user_id = NULL.
    """
    conn = get_db()
    try:
        # Acquire an immediate lock to prevent race conditions during startup
        conn.execute("BEGIN IMMEDIATE")

        # 1. Create users table if it does not exist
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)

        # 2. Create tasks table if it does not exist
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                completed INTEGER DEFAULT 0
            );
        """)

        # 3. Add user_id column only if it is missing
        columns = [row["name"] for row in conn.execute("PRAGMA table_info(tasks)").fetchall()]
        if "user_id" not in columns:
            try:
                conn.execute("ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id);")
            except sqlite3.OperationalError as e:
                # Defensive check: if another worker raced and added it, ignore safely
                if "duplicate column name" not in str(e).lower():
                    raise

        # 4. Guarantee the user_id index exists unconditionally
        conn.execute("CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);")

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# Backward compatibility alias
create_table = init_db

# Initialize database schema safely on application startup
init_db()


# JWT Token Generator
def generate_token(user_id, username):
    """
    Generate a signed JWT token for an authenticated user.
    Uses 'sub' claim for user_id (as string) and sets a 1-hour expiration.
    Returns None if SECRET_KEY is not configured.
    """
    secret = get_jwt_secret()
    if not secret:
        return None
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "username": username,
        "iat": now,
        "exp": now + timedelta(hours=1)
    }
    return jwt.encode(payload, secret, algorithm="HS256")


# Authentication Middleware / Decorator
def token_required(f):
    """
    Decorator to protect API routes with JWT authentication.
    Reads token strictly from the 'Authorization: Bearer <token>' header.
    Validates token, extracts user_id, verifies user exists in database,
    and sets g.user_id and g.current_user on Flask request context.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "").strip()
        if not auth_header:
            return jsonify({"error": "Authorization token is required"}), 401

        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Invalid authorization header format. Expected 'Bearer <token>'"}), 401

        token = parts[1]
        secret = get_jwt_secret()
        if not secret:
            return jsonify({"error": "Authentication service is currently unavailable"}), 503

        try:
            payload = jwt.decode(token, secret, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Token has expired. Please log in again"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid authorization token"}), 401

        user_id_str = payload.get("sub")
        if not user_id_str or not str(user_id_str).isdigit():
            return jsonify({"error": "Invalid token subject"}), 401

        user_id = int(user_id_str)

        conn = get_db()
        user = conn.execute(
            "SELECT id, username FROM users WHERE id = ?",
            (user_id,)
        ).fetchone()
        conn.close()

        if user is None:
            return jsonify({"error": "User account no longer exists"}), 401

        g.user_id = user["id"]
        g.current_user = dict(user)
        return f(*args, **kwargs)

    return decorated


# User Registration
@app.route("/api/register", methods=["POST"])
def register():
    """
    Register a new user account.
    Validates username and password length, hashes password securely,
    and returns user details with a signed JWT token.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    username = data.get("username", "")
    password = data.get("password", "")

    if not isinstance(username, str) or not username.strip():
        return jsonify({"error": "Username is required"}), 400
    if not isinstance(password, str) or not password:
        return jsonify({"error": "Password is required"}), 400

    username = username.strip()

    if len(username) < 3 or len(username) > 50:
        return jsonify({"error": "Username must be between 3 and 50 characters"}), 400
    if len(password) < 6 or len(password) > 128:
        return jsonify({"error": "Password must be between 6 and 128 characters"}), 400

    secret = get_jwt_secret()
    if not secret:
        return jsonify({"error": "Authentication service is currently unavailable"}), 503

    password_hash = generate_password_hash(password)

    conn = get_db()
    try:
        cursor = conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, password_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Username is already taken"}), 409
    conn.close()

    token = generate_token(user_id, username)

    return jsonify({
        "message": "User registered successfully",
        "token": token,
        "user": {
            "id": user_id,
            "username": username
        }
    }), 201


# User Login
@app.route("/api/login", methods=["POST"])
def login():
    """
    Authenticate an existing user.
    Verifies credentials using check_password_hash and returns a signed JWT.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be valid JSON"}), 400

    username = data.get("username", "")
    password = data.get("password", "")

    if not isinstance(username, str) or not username.strip() or not isinstance(password, str) or not password:
        return jsonify({"error": "Username and password are required"}), 400

    username = username.strip()

    secret = get_jwt_secret()
    if not secret:
        return jsonify({"error": "Authentication service is currently unavailable"}), 503

    conn = get_db()
    user = conn.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        (username,)
    ).fetchone()
    conn.close()

    if user is None or not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Invalid username or password"}), 401

    token = generate_token(user["id"], user["username"])

    return jsonify({
        "message": "Login successful",
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"]
        }
    }), 200


# Current Authenticated User Profile
@app.route("/api/me", methods=["GET"])
@token_required
def get_current_user():
    """
    Get profile information for the authenticated user.
    Protected by @token_required.
    """
    return jsonify({
        "user": {
            "id": g.user_id,
            "username": g.current_user["username"]
        }
    }), 200


# Home route

@app.route("/")
def home():
    return jsonify({
        "message": "Student Task Management Backend is running!"
    })


# Get all tasks for the authenticated user
@app.route("/api/tasks", methods=["GET"])
@token_required
def get_tasks():
    conn = get_db()
    tasks = conn.execute(
        "SELECT id, title, completed FROM tasks WHERE user_id = ? ORDER BY id DESC",
        (g.user_id,)
    ).fetchall()
    conn.close()

    return jsonify([dict(task) for task in tasks])


# Add a task for the authenticated user
@app.route("/api/tasks", methods=["POST"])
@token_required
def add_task():
    data = request.get_json(silent=True)

    if not data or not isinstance(data.get("title"), str) or not data.get("title", "").strip():
        return jsonify({"error": "Task title is required"}), 400

    title = data["title"].strip()
    if len(title) > 255:
        return jsonify({"error": "Task title must not exceed 255 characters"}), 400

    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO tasks (title, user_id) VALUES (?, ?)",
        (title, g.user_id)
    )
    conn.commit()

    task_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "id": task_id,
        "title": title,
        "completed": 0
    }), 201


# Complete or uncomplete a task owned by the authenticated user
@app.route("/api/tasks/<int:task_id>", methods=["PATCH"])
@token_required
def update_task(task_id):
    data = request.get_json(silent=True) or {}

    if "completed" not in data:
        return jsonify({"error": "completed field is required"}), 400

    conn = get_db()
    cursor = conn.execute(
        "UPDATE tasks SET completed = ? WHERE id = ? AND user_id = ?",
        (1 if data["completed"] else 0, task_id, g.user_id)
    )
    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task updated successfully"})


# Delete a task owned by the authenticated user
@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@token_required
def delete_task(task_id):
    conn = get_db()
    cursor = conn.execute(
        "DELETE FROM tasks WHERE id = ? AND user_id = ?",
        (task_id, g.user_id)
    )
    conn.commit()
    conn.close()

    if cursor.rowcount == 0:
        return jsonify({"error": "Task not found"}), 404

    return jsonify({"message": "Task deleted successfully"})


if __name__ == "__main__":
    app.run(debug=True)
