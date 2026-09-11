// One shared way to ask Claude for structured output (forced tool_use). Used by suggestions and the Story Bank.
export function hasKey() { return !!process.env.ANTHROPIC_API_KEY; }

export async function askTool({ system, messages, tool, maxTokens = 2000, model }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('No ANTHROPIC_API_KEY set');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: maxTokens,
      system,
      messages,
      tools: [{ name: tool.name, description: tool.description || 'Return the result', input_schema: tool.schema }],
      tool_choice: { type: 'tool', name: tool.name },
    }),
  });
  if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const use = (data.content || []).find((c) => c.type === 'tool_use');
  if (!use) throw new Error('No structured result returned');
  return use.input;
}
