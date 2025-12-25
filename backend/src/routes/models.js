import express from 'express';
import { MODEL_CARDS } from '../utils/litellm.js';

const router = express.Router();

// Get available models
router.get('/', (req, res) => {
  res.json({ models: MODEL_CARDS });
});

export default router;


