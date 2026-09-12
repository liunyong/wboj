import axios from 'axios';

// This adapter is the only provider-specific API code. The service owns the
// rubric and validates results independently of the provider's JSON mode.
export const evaluateWithOpenAiCompatible = async ({ messages, config }) => {
  const response = await axios.post(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    model: config.model,
    messages,
    response_format: { type: 'json_object' },
    max_completion_tokens: 2000
  }, {
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    timeout: config.timeoutMs,
    maxContentLength: 128 * 1024,
    maxRedirects: 0
  });
  const choice = response.data?.choices?.[0];
  if (choice?.finish_reason !== 'stop' || choice?.message?.refusal) throw new Error('Incomplete evaluation');
  return JSON.parse(choice.message.content);
};
