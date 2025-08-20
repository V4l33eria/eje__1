import pool from "./db.js";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const app = express();
const SECRET_KEY = "1234567";

app.use(cors());
app.use(express.json());

// 🔐 Middleware para verificar token
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token requerido" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: "Token inválido" });
  }
}

// 🔧 Crear tablas necesarias
app.post("/create-device-tables", async (req, res) => {
  try {
    const checkLogs = await pool.query(
      'SELECT to_regclass($1)::text AS exists',
      ['public.device_logs']
    );
    if (!checkLogs.rows[0].exists) {
      await pool.query(`
        CREATE TABLE device_logs (
          id SERIAL PRIMARY KEY,
          action VARCHAR(50) NOT NULL,
          "user" TEXT NOT NULL,
          enroll_id TEXT NOT NULL,
          timestamp TIMESTAMP
        )
      `);
    }

    const checkRelay = await pool.query(
      'SELECT to_regclass($1)::text AS exists',
      ['public.relay_status']
    );
    if (!checkRelay.rows[0].exists) {
      await pool.query(`
        CREATE TABLE relay_status (
          id INTEGER PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    const checkUsers = await pool.query(
      'SELECT to_regclass($1)::text AS exists',
      ['public.users']
    );
    if (!checkUsers.rows[0].exists) {
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL
        )
      `);
    }

    const checkData = await pool.query(
      'SELECT to_regclass($1)::text AS exists',
      ['public.data']
    );
    if (!checkData.rows[0].exists) {
      await pool.query(`
        CREATE TABLE data (
          id SERIAL PRIMARY KEY,
          value TEXT NOT NULL,
          created_at TIMESTAMP
        )
      `);
    }

    return res.status(201).json({
      message: "✅ Tablas verificadas/creadas",
      tables: {
        device_logs: checkLogs.rows[0].exists ? "ya existía" : "creada",
        relay_status: checkRelay.rows[0].exists ? "ya existía" : "creada",
        users: checkUsers.rows[0].exists ? "ya existía" : "creada",
        data: checkData.rows[0].exists ? "ya existía" : "creada",
      },
    });
  } catch (error) {
    console.error("❌ Error creando tablas:", error.message);
    return res.status(500).json({ error: "Error al crear/verificar tablas" });
  }
});

// 🔐 Login real
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email y contraseña requeridos" });

  try {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rowCount === 0)
      return res.status(401).json({ error: "Usuario no encontrado" });

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid)
      return res.status(401).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY, {
      expiresIn: "2h",
    });

    return res.json({ token, email: user.email });
  } catch (err) {
    console.error("❌ Error en login:", err.message);
    return res.status(500).json({ error: "Error al iniciar sesión" });
  }
});

// 📝 Registro de usuario
app.post("/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: "Email y contraseña requeridos" });

  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query("INSERT INTO users (email, password) VALUES ($1, $2)", [
      email,
      hashed,
    ]);
    return res.status(201).json({ message: "✅ Usuario registrado" });
  } catch (err) {
    console.error("❌ Error en registro:", err.message);
    return res.status(500).json({ error: "Error al registrar usuario" });
  }
});

// 💡 Encender foco
app.post("/turn-on", verifyToken, async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO relay_status (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `);

    const localTime = new Date().toLocaleString("en-US", {
      timeZone: "America/Mazatlan"
    });

    await pool.query(`
      INSERT INTO device_logs (action, "user", enroll_id, timestamp)
      VALUES ($1, $2, $3, $4)
    `, ["encender", req.user.email, "relay_1", localTime]);

    return res.json({ status: { isOn: true } });
  } catch (err) {
    console.error("Error /turn-on:", err.message);
    return res.status(500).json({ error: "No se pudo encender" });
  }
});

// 💡 Apagar foco
app.post("/turn-off", verifyToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM relay_status WHERE id = $1', [1]);

    const localTime = new Date().toLocaleString("en-US", {
      timeZone: "America/Mazatlan"
    });

    await pool.query(`
      INSERT INTO device_logs (action, "user", enroll_id, timestamp)
      VALUES ($1, $2, $3, $4)
    `, ["apagar", req.user.email, "relay_1", localTime]);

    return res.json({ status: { isOn: false } });
  } catch (err) {
    console.error("Error /turn-off:", err.message);
    return res.status(500).json({ error: "No se pudo apagar" });
  }
});

// 📊 Estado del foco
app.get("/status", async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM relay_status WHERE id = $1', [1]);
    const isOn = result.rowCount > 0;
    return res.json({ status: { isOn } });
  } catch (err) {
    console.error("Error /status:", err.message);
    return res.status(500).json({ error: "No se pudo leer estado" });
  }
});

// 📥 Guardar datos
app.post("/save-data", async (req, res) => {
  const { value } = req.body;
  if (!value) {
    return res.status(400).json({ error: "El campo 'value' es requerido" });
  }

  const localTime = new Date().toLocaleString("en-US", {
    timeZone: "America/Mazatlan"
  });

  const tableName = "data";
  try {
    const result = await pool.query(
      `INSERT INTO ${tableName} (value, created_at) VALUES ($1, $2) RETURNING *`,
      [value, localTime]
    );
    return res.status(201).json({
      message: "✅ Datos guardados exitosamente",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    return res.status(500).json({ error: "Error al guardar los datos" });
  }
});

// 📤 Obtener datos
app.get("/get-data", async (req, res) => {
  const tableName = "data";
  try {
    const result = await pool.query(`SELECT * FROM ${tableName} ORDER BY id`);
    return res.status(200).json({ 
      message: "✅ Datos obtenidos exitosamente",
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: "Error al obtener datos" });
  }
});

// 🗑️ Eliminar tabla
app.post("/delete-table", async (req, res) => {
  try {
    const tableName = "data";
    const checkTable = await pool.query("SELECT to_regclass($1) AS exists", [
      tableName,
    ]);
    if (checkTable.rows[0].exists) {
      await pool.query(`DROP TABLE ${tableName}`);
      return res.status(200).json({ message: "✅ Tabla eliminada exitosamente" });
    } else {
      return res.status(404).json({ message: "ℹ La tabla no existe" });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: "Error al eliminar la tabla" });
  }
});

// 🌡️ Temperatura simulada
app.get("/temperatura", (req, res) => {
  res.json({ valor: "10 °C", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

app.get("/logs", async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userEmail = decoded.email;

    const result = await pool.query(
      `SELECT action, timestamp FROM device_logs WHERE "user" = $1 ORDER BY timestamp DESC`,
      [userEmail]
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Error al obtener logs:", err);
    res.status(500).json({ error: "No se pudieron obtener los logs" });
  }
});
