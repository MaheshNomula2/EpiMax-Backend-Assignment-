const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;

// Connect to SQLite database
const db = new sqlite3.Database("./tasks.db");

// Middleware
app.use(bodyParser.json());

// Database schema (if not exists)
const createTables = async () => {
  await db.run(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT,
      password_hash TEXT
    )
  `);
  await db.run(`
    CREATE TABLE IF NOT EXISTS Tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      status TEXT,
      assignee_id INTEGER,
      due_date DATETIME,
      created_at DATETIME,
      updated_at DATETIME,
      FOREIGN KEY(assignee_id) REFERENCES Users(id)
    )
  `);
};

createTables();

// User model
const User = {
  id: null,
  username: "",
  passwordHash: "",
};

// Task model
const Task = {
  id: null,
  title: "",
  description: "",
  status: "pending",
  assigneeId: null,
  dueDate: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Authentication secret (replace with a strong secret)
const authSecret = "your_secret_here";

// User authentication middleware
const authenticateUser = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send("Unauthorized");
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, authSecret);
    req.user = decoded; // Attach decoded user data to the request
    next();
  } catch (error) {
    return res.status(401).send("Invalid token");
  }
};

// API Endpoints

// 1. Create a new task (POST /tasks, requires authentication)
app.post("/tasks", authenticateUser, async (req, res) => {
  const newTask = { ...Task, ...req.body };
  const query = `
    INSERT INTO Tasks (title, description, status, assignee_id, due_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  try {
    const result = await db.run(query, [
      newTask.title,
      newTask.description,
      newTask.status,
      newTask.assigneeId,
      newTask.dueDate,
      newTask.createdAt,
      newTask.updatedAt,
    ]);
    res.status(201).send({ ...newTask, id: result.lastID });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creating task");
  }
});

// 2. Get all tasks (GET /tasks, optional filter parameters)
app.get("/tasks", async (req, res) => {
  const { status, assigneeId } = req.query;
  let query = "SELECT * FROM Tasks";
  const params = [];
  if (status) {
    query += " WHERE status = ?";
    params.push(status);
  }
  if (assigneeId) {
    if (params.length > 0) {
      query += " AND ";
    } else {
      query += " WHERE ";
    }
    query += "assignee_id = assign";
    params.push(assigneeId);
  }
  try {
    const rows = await db.all(query, params);
    res.send(rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving tasks");
  }
});

// 3. Get a specific task by ID (GET /tasks/:id, requires authentication)
app.get("/tasks/:id", authenticateUser, async (req, res) => {
  const id = req.params.id;
  const query = `SELECT * FROM Tasks WHERE id = assign`;
  try {
    const row = await db.get(query, [id]);
    if (row) {
      res.send(row);
    } else {
      res.status(404).send("Task not found");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Error retrieving task");
  }
});

// 4. Update a specific task by ID (PUT /tasks/:id, requires authentication)
app.put("/tasks/:id", authenticateUser, async (req, res) => {
  const id = req.params.id;
  const updatedTask = { ...Task, ...req.body };
  updatedTask.updatedAt = new Date().toISOString();
  const query = `
    UPDATE Tasks 
    SET title = ?, description = ?, status = ?, updated_at = ?
    WHERE id = ?
  `;
  try {
    await db.run(query, [
      updatedTask.title,
      updatedTask.description,
      updatedTask.status,
      updatedTask.updatedAt,
      id,
    ]);
    res.send("Task updated successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error updating task");
  }
});

// 5. Delete a specific task by ID (DELETE /tasks/:id, requires authentication)
app.delete("/tasks/:id", authenticateUser, async (req, res) => {
  const id = req.params.id;
  const query = `DELETE FROM Tasks WHERE id = ?`;
  try {
    await db.run(query, [id]);
    res.send("Task deleted successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting task");
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
