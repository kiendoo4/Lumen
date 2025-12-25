import express from 'express';
import multer from 'multer';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { minioClient, BUCKET_NAME } from '../config/minio.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get all conversations for user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const [conversations] = await pool.execute(
      `SELECT c.id, c.title, c.avatar_url, c.created_at, c.updated_at,
              COUNT(DISTINCT d.id) as dialog_count
       FROM conversations c
       LEFT JOIN dialogs d ON d.conversation_id = c.id
       WHERE c.user_id = ?
       GROUP BY c.id
       ORDER BY c.updated_at DESC`,
      [req.user.userId]
    );

    for (const conv of conversations) {
      const [dialogs] = await pool.execute(
        'SELECT id, title, created_at, updated_at FROM dialogs WHERE conversation_id = ? ORDER BY updated_at DESC',
        [conv.id]
      );
      conv.dialogs = dialogs;
    }

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create conversation
router.post('/', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { title } = req.body;
    let avatarUrl = null;

    if (req.file) {
      const fileName = `conversations/${req.user.userId}/${Date.now()}-${req.file.originalname}`;
      await minioClient.putObject(BUCKET_NAME, fileName, req.file.buffer, req.file.size, {
        'Content-Type': req.file.mimetype
      });
      avatarUrl = `/api/files/${fileName}`;
    }

    const [result] = await pool.execute(
      'INSERT INTO conversations (user_id, title, avatar_url) VALUES (?, ?, ?)',
      [req.user.userId, title || 'New Conversation', avatarUrl]
    );

    res.json({ conversation: { id: result.insertId, title, avatarUrl } });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update conversation
router.put('/:id', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const updates = [];
    const values = [];

    // Verify ownership
    const [conversations] = await pool.execute(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (conversations.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    if (title) {
      updates.push('title = ?');
      values.push(title);
    }

    if (req.file) {
      const fileName = `conversations/${req.user.userId}/${Date.now()}-${req.file.originalname}`;
      await minioClient.putObject(BUCKET_NAME, fileName, req.file.buffer, req.file.size, {
        'Content-Type': req.file.mimetype
      });
      const avatarUrl = `/api/files/${fileName}`;
      updates.push('avatar_url = ?');
      values.push(avatarUrl);
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(
        `UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const [updated] = await pool.execute(
      'SELECT id, title, avatar_url FROM conversations WHERE id = ?',
      [id]
    );

    res.json({ conversation: updated[0] });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete conversation
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    const [conversations] = await pool.execute(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );

    if (conversations.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await pool.execute('DELETE FROM conversations WHERE id = ?', [id]);

    res.json({ message: 'Conversation deleted' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


