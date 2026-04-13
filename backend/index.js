require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const roomRoutes = require('./routes/roomRoutes');

const app = express();
const primaryMongoUri = process.env.MONGO_URI;
const fallbackMongoUri = 'mongodb://127.0.0.1:27017/noek';

async function connectMongo() {
  const attemptedUris = [];

  if (primaryMongoUri) {
    attemptedUris.push(primaryMongoUri);
  }

  if (!attemptedUris.includes(fallbackMongoUri)) {
    attemptedUris.push(fallbackMongoUri);
  }

  let lastError = null;

  for (const uri of attemptedUris) {
    try {
      await mongoose.connect(uri);
      console.log(`MongoDB connected (${uri === primaryMongoUri ? 'MONGO_URI' : 'local fallback'})`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`MongoDB connection failed for ${uri === primaryMongoUri ? 'MONGO_URI' : 'local fallback'}:`, error.message);
    }
  }

  throw lastError;
}

connectMongo().catch((err) => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

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
