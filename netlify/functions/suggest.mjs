// Suggestions from Claude. Hard rule: never rewrite the author's prose.
// Every suggestion is an *addition* (a heading, a question, a summary line, a meta description)
// that the author accepts or rejects in the editor.
import { requireAuth } from '../../lib/auth.mjs';
import { json, error, readJson } from '../../lib/http.mjs';
import { analyse } from '../../lib/markdown.mjs';
import { getSettings } from '../../lib/store.mjs';

const KINDS = {
  subheads: {
    instruction:
      'Propose section headings (H2) that could be inserted between existing paragraphs to make the structure scannable. Prefer question-phrased headings where natural ("Why does X happen?"). Do not propose a heading where one already exists. Use the paragraph indexes given.',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              heading: { type: 'string' },
              beforeParagraph: { type: 'integer', description: 'index of the paragraph this heading should sit above' },
              why: { type: 'string', description: 'one short clause' },
            },
            required: ['heading', 'beforeParagraph'],
          },
        },
      },
      required: ['items'],
    },
  },
  faq: {
    instruction:
      'Propose 3–5 FAQ questions that a reader (or an AI assistant answering on their behalf) would ask after reading this post, and that the post already answers or nearly answers. For each, draft a 1–3 sentence answer composed ONLY from facts and phrasing already present in the post, in the author\'s voice, clearly marked as a draft for them to edit. Do not introduce new claims.',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: { question: { type: 'string' }, draftAnswer: { type: 'string' } },
            required: ['question', 'draftAnswer'],
          },
        },
      },
      required: ['items'],
    },
  },
  tldr: {
    instruction:
      'Propose 2 alternative TL;DR blocks: each is 2–4 bullet points that restate the post\'s key points using the author\'s own wording wherever possible. No new claims. Keep bullets under 20 words.',
    schema: {
      type: 'object',
      properties: {
        items: { type: 'array', items: { type: 'object', properties: { bullets: { type: 'array', items: { type: 'string' } } }, required: ['bullets'] } },
      },
      required: ['items'],
    },
  },
  meta: {
    instruction:
      'Propose 3 meta descriptions, 120–155 characters each, that state the answer or the value plainly (no clickbait, no "in this post"). Use the author\'s voice.',
    schema: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] } } },
      required: ['items'],
    },
  },
  titles: {
    instruction:
      'Propose 4 alternative titles under 60 characters. At least two should be phrased as the exact question a person would type into an AI assistant or search engine. Keep the author\'s tone; no hype.',
    schema: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, why: { type: 'string' } }, required: ['text'] } } },
      required: ['items'],
    },
  },
  review: {
    instruction:
      'Act as an answer-engine optimisation editor. Give at most 5 specific, actionable notes about what would make this post more likely to be cited by AI assistants and featured in search: missing sub-questions, claims that need a source or a number, places where the direct answer is buried, ambiguity in the opening. Never suggest rewording the author\'s sentences; suggest what to add, move, or cut. Each note under 30 words.',
    schema: {
      type: 'object',
      properties: { items: { type: 'array', items: { type: 'object', properties: { note: { type: 'string' }, where: { type: 'string' } }, required: ['note'] } } },
      required: ['items'],
    },
  },
};

export default requireAuth(async (req) => {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return error('ANTHROPIC_API_KEY is not set in Netlify environment variables', 400);
  const body = (await readJson(req)) || {};
  const kind = KINDS[body.kind];
  if (!kind) return error('Unknown suggestion kind');
  if (!body.body?.trim()) return error('Write something first');

  const settings = await getSettings();
  const a = analyse(body.body);
  const paragraphs = a.paragraphs.filter((p) => !p.block);
  const numbered = paragraphs.map((p, i) => `[${i}] ${p.text}`).join('\n\n');
  const outline = a.headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`).join('\n') || '(no headings yet)';

  const system = `You help ${settings.authorName || 'the author'} publish short, direct, first-person blog posts optimised for answer engines (Google AI Overviews, ChatGPT, Perplexity) and search. You NEVER rewrite or paraphrase the author's prose. You only propose additions the author will accept or reject: headings, questions, summaries, metadata. Be concrete, plain, British English, no marketing tone.`;

  const user = `TITLE: ${body.title || '(untitled)'}

CURRENT OUTLINE:
${outline}

PARAGRAPHS (indexed):
${numbered}

TASK: ${kind.instruction}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
      max_tokens: 1500,
      system,
      messages: [{ role: 'user', content: user }],
      tools: [{ name: 'suggest', description: 'Return suggestions', input_schema: kind.schema }],
      tool_choice: { type: 'tool', name: 'suggest' },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    return error(`Anthropic API error ${res.status}: ${t.slice(0, 300)}`, 502);
  }
  const data = await res.json();
  const tool = (data.content || []).find((c) => c.type === 'tool_use');
  if (!tool) return error('No suggestions returned', 502);
  return json({ kind: body.kind, items: tool.input.items || [], paragraphs: paragraphs.map((p) => p.text) });
});

export const config = { path: '/api/suggest' };
