const express = require('express');
const path = require('path');
const app = express();
const PORT = 3000;

// Servir archivos estáticos
app.use(express.static('public'));
app.use('/pages', express.static('pages'));

// Ruta principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para páginas
app.get('/pages/:page', (req, res) => {
  const page = req.params.page;
  res.sendFile(path.join(__dirname, 'pages', `${page}.html`));
});

app.listen(PORT, () => {
  console.log(`🌱 EcoPrado Frontend: http://localhost:${PORT}`);
});
