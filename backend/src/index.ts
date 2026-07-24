import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

// Import des routes
import authRoutes from './routes/auth.js';
import annuairesRoutes from './routes/annuaires.js';
import thematiquesRoutes from './routes/thematiques.js';
import tableauxRoutes from './routes/tableaux.js';
import tableauxDataRoutes from './routes/tableaux-data.js';
import tableauxIndicesRoutes from './routes/tableaux-indices.js';
import liaisonsRoutes from './routes/liaisons.js';
import rupturesRoutes from './routes/ruptures.js';
import fusionRoutes from './routes/fusion.js';
import viewsRoutes from './routes/views.js';
import rpcRoutes from './routes/rpc.js';
import adminRoutes from './routes/admin.js';
import correctionsRoutes from './routes/corrections.js';

const app = express();
const PORT = parseInt(process.env.API_PORT || '3001');

// Middlewares globaux
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/annuaires', annuairesRoutes);
app.use('/api/thematiques', thematiquesRoutes);
app.use('/api/tableaux', tableauxRoutes);
app.use('/api/tableaux-data', tableauxDataRoutes);
app.use('/api/tableaux-indices', tableauxIndicesRoutes);
app.use('/api/liaisons', liaisonsRoutes);
app.use('/api/ruptures', rupturesRoutes);
app.use('/api/corrections', correctionsRoutes);
app.use('/api/fusion', fusionRoutes);
app.use('/api/views', viewsRoutes);
app.use('/api/rpc', rpcRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`[SERVER] API démarrée sur http://localhost:${PORT}`);
  console.log(`[SERVER] Frontend attendu sur ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
});

export default app;
