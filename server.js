const express = require("express");
const { DatabaseSync } = require("node:sqlite");
const path = require("path");

const PORT = process.env.PORT || 3000;
const databasePath = path.join(__dirname, "contacts.db");

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname)));

let database = null;

function setupDatabase() {
  database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post("/api/contact", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim();
  const message = String(req.body?.message || "").trim();

  if (!name || name.length > 100) {
    return res.status(400).json({ error: "Please enter your name." });
  }

  if (!isValidEmail(email) || email.length > 255) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  if (message.length > 2000) {
    return res.status(400).json({ error: "Message is too long." });
  }

  if (!database) {
    return res.status(503).json({ error: "The database is not connected. Please try again later." });
  }

  try {
    database
      .prepare("INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)")
      .run(name, email, message);
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Failed to save contact:", error.message);
    return res.status(500).json({ error: "Your message could not be recorded. Please try again." });
  }
});

try {
  setupDatabase();
  console.log(`SQLite ready. Contacts are stored in ${databasePath}`);
} catch (error) {
  database = null;
  console.error("Could not open the SQLite database:", error.message);
}

app.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
});
