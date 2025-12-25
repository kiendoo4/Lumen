import { litellm } from 'litellm';
import pool from '../config/database.js';

export async function getLLMConfig(userId, provider) {
  const [providers] = await pool.execute(
    'SELECT api_key, base_url FROM llm_providers WHERE user_id = ? AND provider = ?',
    [userId, provider]
  );

  if (providers.length === 0) {
    throw new Error(`Provider ${provider} not configured for user`);
  }

  return providers[0];
}

export async function callLLM(userId, model, messages, settings) {
  try {
    // Determine provider from model
    let provider = 'openai';
    let apiKey = process.env.OPENAI_API_KEY;
    let baseUrl = null;

    if (model.startsWith('gemini') || model.startsWith('google')) {
      provider = 'gemini';
      const config = await getLLMConfig(userId, 'gemini');
      apiKey = config.api_key;
    } else if (model.startsWith('ollama') || model.startsWith('llama')) {
      provider = 'ollama';
      const config = await getLLMConfig(userId, 'ollama');
      baseUrl = config.base_url || 'http://localhost:11434';
    } else {
      // OpenAI or other
      try {
        const config = await getLLMConfig(userId, 'openai');
        apiKey = config.api_key;
      } catch {
        // Use default env key
      }
    }

    const response = await litellm.completion({
      model: model,
      messages: messages,
      temperature: settings.temperature,
      top_p: settings.topP,
      presence_penalty: settings.presencePenalty,
      frequency_penalty: settings.frequencyPenalty,
      max_tokens: settings.maxTokens,
      api_key: apiKey,
      base_url: baseUrl
    });

    return response;
  } catch (error) {
    console.error('LLM call error:', error);
    throw error;
  }
}

// Model cards for UI
export const MODEL_CARDS = {
  openai: [
    { id: 'gpt-4', name: 'GPT-4', description: 'Most capable model, best for complex tasks' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Faster and cheaper than GPT-4' },
    { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Optimized GPT-4 variant' }
  ],
  gemini: [
    { id: 'gemini-pro', name: 'Gemini Pro', description: 'Google\'s advanced model' },
    { id: 'gemini-pro-vision', name: 'Gemini Pro Vision', description: 'Multimodal with vision' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Latest Gemini model' },
    { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Faster Gemini variant' }
  ],
  ollama: [
    { id: 'llama2', name: 'Llama 2', description: 'Meta\'s open-source model' },
    { id: 'llama3', name: 'Llama 3', description: 'Latest Llama model' },
    { id: 'mistral', name: 'Mistral', description: 'High-performance open model' },
    { id: 'codellama', name: 'Code Llama', description: 'Specialized for code' },
    { id: 'phi', name: 'Phi', description: 'Microsoft\'s efficient model' }
  ]
};


