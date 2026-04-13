require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const roomRoutes = require('./routes/roomRoutes');

const app = express();
const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/noek';

mongoose
  .connect(mongoUri)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Noek backend is running.' });
});

app.use('/rooms', roomRoutes);

// Proxy voor poly-static assets (Poly Pizza)
app.use('/api/poly-static', async (req, res, next) => {
  try {
    // Dynamisch importeren zodat je geen import problemen krijgt
    const { staticRouter } = await import('../src/server/polyStatic/routes/staticRoutes.js');
    return staticRouter(req, res);
  } catch (err) {
    console.error('Poly-static proxy error:', err);
    res.status(500).json({ error: 'Poly-static proxy failed.' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Noek backend listening on port ${PORT}`);
});
