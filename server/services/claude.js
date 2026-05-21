const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';

async function askClaude(userPrompt, maxTokens = 4000, systemOverride) {
  const system = systemOverride ||
    'You are an expert resume analyst. Respond with a single valid JSON object ONLY. No markdown fences, no explanation, no preamble. Start directly with { and end with }.';
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  });
  const raw = (msg.content || []).map(b => b.text || '').join('');
  return extractJSON(raw);
}

async function askClaudeText(userPrompt, maxTokens = 3000, systemOverride) {
  const system = systemOverride || 'You are an expert resume writer and career coach. Be concise and professional.';
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  });
  return (msg.content || []).map(b => b.text || '').join('');
}

function extractJSON(raw) {
  let s = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  // Try array first, then object
  const arrStart = s.indexOf('[');
  const arrEnd   = s.lastIndexOf(']');
  const objStart = s.indexOf('{');
  const objEnd   = s.lastIndexOf('}');
  // Pick whichever comes first in the string
  if (arrStart !== -1 && (arrStart < objStart || objStart === -1)) {
    if (arrEnd === -1) throw new Error('No JSON array found in Claude response');
    return JSON.parse(s.slice(arrStart, arrEnd + 1));
  }
  if (objStart === -1 || objEnd === -1) throw new Error('No JSON found in Claude response');
  return JSON.parse(s.slice(objStart, objEnd + 1));
}

module.exports = { askClaude, askClaudeText, extractJSON, MODEL };
