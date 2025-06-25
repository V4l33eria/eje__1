import pg from "pg";
const { Pool } = pg;

const pool = new Pool({
  connectionString: "postgresql://root:Wf0hoYLqhg30mzZmIeLCRRlqwiLgMLn2@dpg-d0vknmggjchc7388rdq0-a.oregon-postgres.render.com/iot4_db",
  ssl: {
    rejectUnauthorized: false,
  },
});

export default pool;

// 🔎 Función de prueba de conexión
async function TestConnection() {
  try {
    const client = await pool.connect();
    console.log("✅ Conexión exitosa a la base de datos");
    client.release();
  } catch (err) {
    console.error("❌ Error de conexión a la base de datos:", err);
  }
}

TestConnection();


/*
async function TestConecction() {
try {
    const client = await pool.connect();
    console.log("conexion exitosa");
    client.release();
} catch(err) { 
    console.error("Error de conexion a la base de datos:", err);
}}

TestConecction();

//module.exports = pool;
*/
