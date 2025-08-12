import pool from "./db.js";
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Endpoint para crear tabla 
app.post("/create-device-tables", async (req, res) => {
  try {
    // --- device_logs ---
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
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    // --- relay_status ---
    const checkRelay = await pool.query(
      'SELECT to_regclass($1)::text AS exists',
      ['public.relay_status']
    );

    if (!checkRelay.rows[0].exists) {
      // Row existence will represent ON/OFF (id=1 present => ON)
      await pool.query(`
        CREATE TABLE relay_status (
          id INTEGER PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
    }

    return res.status(201).json({
      message: "✅ Tablas verificadas/creadas",
      tables: {
        device_logs: checkLogs.rows[0].exists ? "ya existía" : "creada",
        relay_status: checkRelay.rows[0].exists ? "ya existía" : "creada",
      },
    });
  } catch (error) {
    console.error("❌ Error creando tablas:", error.message);
    return res.status(500).json({ error: "Error al crear/verificar tablas" });
  }
});

app.post("/turn-on", async (req, res) => {
  try {
    await pool.query(`
      INSERT INTO relay_status (id) VALUES (1)
      ON CONFLICT (id) DO NOTHING
    `);
    return res.json({ status: { isOn: true } });
  } catch (err) {
    console.error("Error /turn-on:", err.message);
    return res.status(500).json({ error: "No se pudo encender" });
  }
});

app.post("/turn-off", async (req, res) => {
  try {
    await pool.query('DELETE FROM relay_status WHERE id = $1', [1]);
    return res.json({ status: { isOn: false } });
  } catch (err) {
    console.error("Error /turn-off:", err.message);
    return res.status(500).json({ error: "No se pudo apagar" });
  }
});

app.get("/status", async (req, res) => {
  try {
    const result = await pool.query('SELECT 1 FROM relay_status WHERE id = $1', [1]);
    const isOn = result.rowCount > 0;
    return res.json({ status: { isOn } });
  } catch (err) {
    console.error("Error /status:", err.message);
    return res.status(500).json({ error: "No se pudo leer estado" });
  }
});


app.post("/save-data", async (req, res) => {
  const { value } = req.body;

  if (!value) {
    return res.status(400).json({ error: "El campo 'value' es requerido" });
  }
  const tableName = "data";
  try {
    const result = await pool.query(
      `INSERT INTO ${tableName} (value) VALUES ($1) RETURNING *`,
      [value]
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

// Endpoint para obtener datos 
//app.get("/getdata", async (req, res) => {
 // try {
 //  const result = await pool.query("SELECT * FROM data ORDER BY id");
    
   // return res.status(200).json({ 
  //    message: "✅ Datos obtenidos exitosamente",
   //   data: result.rows,
   //   total: result.rows.length
   // });
 // } catch (error) {
 //   console.error("❌ Error:", error.message);
 //   res.status(500).json({ error: "Error al obtener datos" });
 // }
//});

// Endpoint para obtener datos
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

// Endpoint para eliminar tabla 
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
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// Endpoint de temperatura 
app.get("/temperatura", (req, res) => {
  res.json({ valor: "10 °C", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});