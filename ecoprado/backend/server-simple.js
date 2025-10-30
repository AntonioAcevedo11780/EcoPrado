const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(bodyParser.json());

// Base de datos en memoria
const users = [];
const actions = [];
const marketplace = [
  { id: 1, name: 'Café Orgánico Local', price: 50, category: 'alimentos', image: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400' },
  { id: 2, name: 'Taller de Compostaje', price: 75, category: 'educacion', image: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=400' },
  { id: 3, name: 'Productos Agrícolas Sostenibles', price: 100, category: 'alimentos', image: 'https://images.unsplash.com/photo-1471193945509-9ad0617afabf?w=400' },
  { id: 4, name: 'TourXochitepec', price: 150, category: 'turismo', image: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=400' },
  { id: 5, name: 'Planta Nativa para tu Jardín', price: 30, category: 'jardineria', image: 'https://images.unsplash.com/photo-1466781783364-36c955e42a7f?w=400' },
  { id: 6, name: 'Descuento Transporte Público', price: 20, category: 'transporte', image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400' }
];

// Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'EcoPrado API funcionando' });
});

app.post('/api/users/register', async (req, res) => {
  const { name, email, role, publicKey, secretKey } = req.body;
  
  const user = {
    id: users.length + 1,
    name,
    email,
    role,
    publicKey,
    createdAt: new Date()
  };
  
  users.push(user);
  res.json({ success: true, user });
});

app.get('/api/users/:publicKey', async (req, res) => {
  const user = users.find(u => u.publicKey === req.params.publicKey);
  
  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }
  
  // Simular balance y datos
  const balance = Math.random() * 100 + 50; // Balance simulado
  const userActions = actions.filter(a => a.userPublicKey === user.publicKey);
  const co2Saved = userActions.length * 2.5;
  
  res.json({ ...user, balance, totalActions: userActions.length, co2Saved });
});

app.post('/api/actions/report', async (req, res) => {
  const { userPublicKey, actionType, description, evidence } = req.body;
  
  const rewards = {
    'reciclaje': 10,
    'transporte_verde': 15,
    'ahorro_agua': 20,
    'agricultura_sostenible': 50,
    'educacion_ambiental': 25
  };
  
  const rewardAmount = rewards[actionType] || 10;
  
  const action = {
    id: actions.length + 1,
    userPublicKey,
    actionType,
    description,
    evidence,
    rewardAmount,
    status: 'completed',
    createdAt: new Date()
  };
  
  actions.push(action);
  
  // Simular éxito
  res.json({ success: true, action });
});

app.get('/api/actions/:publicKey', (req, res) => {
  const userActions = actions.filter(a => a.userPublicKey === req.params.publicKey);
  res.json(userActions);
});

app.get('/api/marketplace', (req, res) => {
  res.json(marketplace);
});

app.get('/api/stats', async (req, res) => {
  const totalUsers = users.length;
  const totalActions = actions.length;
  const totalTokens = actions.reduce((sum, a) => sum + (a.rewardAmount || 0), 0);
  const co2Avoided = totalActions * 2.5;
  
  res.json({
    totalUsers,
    totalActions,
    totalTokens,
    co2Avoided: Math.round(co2Avoided * 10) / 10
  });
});

app.listen(PORT, () => {
  console.log(`🌱 EcoPrado API corriendo en http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
});
