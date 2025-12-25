import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import llmProviderRoutes from './routes/llmProviders.js';
import conversationRoutes from './routes/conversations.js';
import dialogRoutes from './routes/dialogs.js';
import modelRoutes from './routes/models.js';
import { minioClient, BUCKET_NAME } from './config/minio.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/llm-providers', llmProviderRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/dialogs', dialogRoutes);
app.use('/api/models', modelRoutes);

// File serving from MinIO
app.get('/api/files/*', async (req, res) => {
  try {
    const filePath = req.path.replace('/api/files/', '');
    const dataStream = await minioClient.getObject(BUCKET_NAME, filePath);
    
    // Set appropriate headers
    const stat = await minioClient.statObject(BUCKET_NAME, filePath);
    res.setHeader('Content-Type', stat.metaData['content-type'] || 'application/octet-stream');
    res.setHeader('Content-Length', stat.size);
    
    dataStream.pipe(res);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
