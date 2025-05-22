const express = require("express");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/temperatura", (req, res) => {
  res.json({ valor: "10°C", timestamp: new Date().toISOString() });
});


app.get("/Universidad", (req, res) => {
  res.json({ nombres: ["Universidad Tecnológica de la Laguna Durango"], timestamp: new Date().toISOString() });
});

app.get("/velocidad", (req, res) => {
  res.json({ valor: "25 km/h", timestamp: new Date().toISOString() });
});

app.listen(port, () => {
  console.log(`Servidor corriendo en puerto ${port}`);
});