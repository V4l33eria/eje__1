import pool from "./db.js";
import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Endpoint para crear tabla 
app.post("/create-table", async (req, res) => {
  try {
    const tableName = "data";

    const checkTable = await pool.query("SELECT to_regclass($1) AS exists", [
      tableName,
    ]);

    if (!checkTable.rows[0].exists) {
      await pool.query(`
        CREATE TABLE ${tableName} (
          id SERIAL PRIMARY KEY,
          nombre VARCHAR(100) NOT NULL,
          matricula VARCHAR(50) NOT NULL,
          value TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      return res.status(201).json({ message: "✅ Tabla creada exitosamente con campos: nombre, matricula, value" });
    } else {
      return res.status(200).json({ message: "ℹ La tabla ya existe" });
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    res.status(500).json({ error: "Error al procesar la solicitud" });
  }
});

// guardar datos
app.post("/savedata", async (req, res) => {
  const { nombre, matricula, value } = req.body;

  if (!nombre || !matricula || !value) {
    return res.status(400).json({ 
      error: "Los campos 'nombre', 'matricula' y 'value' son requeridos" 
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO data (nombre, matricula, value) VALUES ($1, $2, $3) RETURNING *;`, 
      [nombre, matricula, value]
    );

    return res
      .status(201)
      .json({
        message: "✅ Datos guardados exitosamente",
        data: result.rows[0],
      });
  } catch (err) {
    console.error("❌ Error:", err.message);
    res.status(500).json({ error: "Error al guardar los datos" });
  }
});

// Endpoint para obtener datos 
app.get("/getdata", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM data ORDER BY id");
    
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