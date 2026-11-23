const express = require("express");
const mysql = require("mysql2/promise");
const path = require("path");

const PORT = process.env.PORT || 3000;
const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "portfolio",
};

if (!/^[A-Za-z0-9_]+$/.test(dbConfig.database)) {
  throw new Error("MYSQL_DATABASE may only contain letters, numbers, and underscores.");
}

const app = express();
app.use(express.json({ limit: "20kb" }));
app.use(express.static(path.join(__dirname)));

let pool = null;

async function setupDatabase() {
  const connection = await mysql.createConnection({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
  });

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await connection.end();

  pool = mysql.createPool({
    host: dbConfig.host,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL,
      message TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  if (!pool) {
    return res.status(503).json({ error: "The database is not connected. Please try again later." });
  }

  try {
    await pool.execute(
      "INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)",
      [name, email, message]
    );
    return res.status(201).json({ ok: true });
  } catch (error) {
    console.error("Failed to save contact:", error.message);
    return res.status(500).json({ error: "Your message could not be recorded. Please try again." });
  }
});

app.listen(PORT, () => {
  console.log(`Portfolio running at http://localhost:${PORT}`);
});

setupDatabase()
  .then(() => {
    console.log(`MySQL ready. Contacts are stored in ${dbConfig.database}.contacts`);
  })
  .catch((error) => {
    pool = null;
    console.error("Could not connect to MySQL:", error.code || error.message);
    console.error("Start MySQL, then submit the form again. Defaults: localhost, user root, database portfolio.");
  });
