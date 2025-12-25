import express from 'express';
import multer from 'multer';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';
import { minioClient, BUCKET_NAME } from '../config/minio.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Get dialogs for conversation
router.get('/conversation/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;

    // Verify ownership
    const [conversations] = await pool.execute(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, req.user.userId]
    );

    if (conversations.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const [dialogs] = await pool.execute(
      `SELECT d.*, 
              (SELECT COUNT(*) FROM messages WHERE dialog_id = d.id) as message_count
       FROM dialogs d
       WHERE d.conversation_id = ?
       ORDER BY d.updated_at DESC`,
      [conversationId]
    );

    for (const dialog of dialogs) {
      const [sources] = await pool.execute(
        'SELECT id, file_name, source_type, source_value FROM dialog_sources WHERE dialog_id = ?',
        [dialog.id]
      );
      dialog.sources = sources;
    }

    res.json({ dialogs });
  } catch (error) {
    console.error('Get dialogs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create dialog
router.post('/conversation/:conversationId', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title, llmModel, freedom, temperature, topP, presencePenalty, frequencyPenalty, maxTokens } = req.body;

    // Verify ownership
    const [conversations] = await pool.execute(
      'SELECT id FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, req.user.userId]
    );

    if (conversations.length === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const [result] = await pool.execute(
      `INSERT INTO dialogs (conversation_id, title, llm_model, freedom, temperature, top_p, 
                           presence_penalty, frequency_penalty, max_tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        conversationId,
        title || 'New Dialog',
        llmModel || 'gpt-4',
        freedom || 0.5,
        temperature || 0.7,
        topP || 0.9,
        presencePenalty || 0.0,
        frequencyPenalty || 0.0,
        maxTokens || 2000
      ]
    );

    res.json({ dialog: { id: result.insertId } });
  } catch (error) {
    console.error('Create dialog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update dialog settings
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, llmModel, freedom, temperature, topP, presencePenalty, frequencyPenalty, maxTokens } = req.body;

    // Verify ownership through conversation
    const [dialogs] = await pool.execute(
      `SELECT d.id FROM dialogs d
       JOIN conversations c ON c.id = d.conversation_id
       WHERE d.id = ? AND c.user_id = ?`,
      [id, req.user.userId]
    );

    if (dialogs.length === 0) {
      return res.status(404).json({ error: 'Dialog not found' });
    }

    const updates = [];
    const values = [];

    if (title) {
      updates.push('title = ?');
      values.push(title);
    }
    if (llmModel) {
      updates.push('llm_model = ?');
      values.push(llmModel);
    }
    if (freedom !== undefined) {
      updates.push('freedom = ?');
      values.push(freedom);
    }
    if (temperature !== undefined) {
      updates.push('temperature = ?');
      values.push(temperature);
    }
    if (topP !== undefined) {
      updates.push('top_p = ?');
      values.push(topP);
    }
    if (presencePenalty !== undefined) {
      updates.push('presence_penalty = ?');
      values.push(presencePenalty);
    }
    if (frequencyPenalty !== undefined) {
      updates.push('frequency_penalty = ?');
      values.push(frequencyPenalty);
    }
    if (maxTokens !== undefined) {
      updates.push('max_tokens = ?');
      values.push(maxTokens);
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.execute(
        `UPDATE dialogs SET ${updates.join(', ')} WHERE id = ?`,
        values
      );
    }

    const [updated] = await pool.execute('SELECT * FROM dialogs WHERE id = ?', [id]);
    res.json({ dialog: updated[0] });
  } catch (error) {
    console.error('Update dialog error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Add source to dialog (for RAG)
router.post('/:id/sources', authenticateToken, upload.array('files'), async (req, res) => {
  try {
    const { id } = req.params;
    const { sourceType, sourceValue } = req.body;

    // Verify ownership
    const [dialogs] = await pool.execute(
      `SELECT d.id FROM dialogs d
       JOIN conversations c ON c.id = d.conversation_id
       WHERE d.id = ? AND c.user_id = ?`,
      [id, req.user.userId]
    );

    if (dialogs.length === 0) {
      return res.status(404).json({ error: 'Dialog not found' });
    }

    const sources = [];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileName = `sources/${req.user.userId}/${id}/${Date.now()}-${file.originalname}`;
        await minioClient.putObject(BUCKET_NAME, fileName, file.buffer, file.size, {
          'Content-Type': file.mimetype
        });

        const [result] = await pool.execute(
          `INSERT INTO dialog_sources (dialog_id, file_name, file_path, file_type, file_size, source_type, source_value)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            file.originalname,
            `/api/files/${fileName}`,
            file.mimetype,
            file.size,
            'file',
            file.originalname
          ]
        );

        sources.push({ id: result.insertId, fileName: file.originalname });
      }
    } else if (sourceType && sourceValue) {
      const [result] = await pool.execute(
        `INSERT INTO dialog_sources (dialog_id, source_type, source_value)
         VALUES (?, ?, ?)`,
        [id, sourceType, sourceValue]
      );
      sources.push({ id: result.insertId });
    }

    res.json({ sources });
  } catch (error) {
    console.error('Add source error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete source
router.delete('/:id/sources/:sourceId', authenticateToken, async (req, res) => {
  try {
    const { id, sourceId } = req.params;

    // Verify ownership
    const [sources] = await pool.execute(
      `SELECT ds.* FROM dialog_sources ds
       JOIN dialogs d ON d.id = ds.dialog_id
       JOIN conversations c ON c.id = d.conversation_id
       WHERE ds.id = ? AND ds.dialog_id = ? AND c.user_id = ?`,
      [sourceId, id, req.user.userId]
    );

    if (sources.length === 0) {
      return res.status(404).json({ error: 'Source not found' });
    }

    // Delete file from MinIO if it's a file source
    if (sources[0].file_path) {
      const filePath = sources[0].file_path.replace('/api/files/', '');
      try {
        await minioClient.removeObject(BUCKET_NAME, filePath);
      } catch (err) {
        console.error('Error deleting file from MinIO:', err);
      }
    }

    await pool.execute('DELETE FROM dialog_sources WHERE id = ?', [sourceId]);

    res.json({ message: 'Source deleted' });
  } catch (error) {
    console.error('Delete source error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;


