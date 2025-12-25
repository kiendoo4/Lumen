import express from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get LLM providers for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [providers] = await pool.execute(
      'SELECT provider, api_key, base_url FROM llm_providers WHERE user_id = ?',
      [req.user.userId]
    );

    res.json({ providers });
  } catch (error) {
    console.error('Get providers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update LLM provider config
router.put('/:provider', authenticateToken, async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey, baseUrl } = req.body;

    if (!['openai', 'gemini', 'ollama'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    await pool.execute(
      `INSERT INTO llm_providers (user_id, provider, api_key, base_url)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE api_key = ?, base_url = ?`,
      [req.user.userId, provider, apiKey, baseUrl, apiKey, baseUrl]
    );

    res.json({ message: 'Provider configuration updated' });
  } catch (error) {
    console.error('Update provider error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


