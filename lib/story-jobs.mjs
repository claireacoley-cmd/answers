// Long-running Story Bank jobs (run in a background function; results stored on the stories document).
import { askTool } from './claude.mjs';
import { FIELDS, TERRITORIES, digest } from './story-model.mjs';
const qLine = (q) => `Q${q.n}${q.tier === 'mvp' ? ' [MVP]' : ''}: ${q.text}`;
const storyLine = (s) => `${s.id} — ${s.title}${s.kind === 'lead' ? ' (lead, thin)' : ''}\n  ${digest(s) || '(no detail yet)'}`;
export const VOICE = `You work inside Claire Coley's private Story Bank. Stories are her lived experiences — source material, not content. Rules you never break: quote or closely reflect Claire's own words; never invent facts; never manufacture a clean lesson; preserve uncertainty, contradiction and mistakes; a story may have no conclusion. Prefer a concrete scene over a generic leadership lesson. British English. Be brief and plain.`;

    // ---- Source document → story candidates (nothing is saved until Claire accepts) ----
export async function runIngest({ body, stories, qdoc }) {
  const text = (body.text || '').trim();
  if (text.length < 40) throw new Error('Paste the document text first.');
  const source = body.source || 'Pasted document';
  const fieldList = FIELDS.map((f) => `${f.key}: ${f.label}`).join('; ');
  const out = await askTool({
    system: VOICE,
    messages: [{ role: 'user', content: `SOURCE DOCUMENT ("${source}"):\n${text.slice(0, 60000)}\n\nEXISTING STORIES (do not duplicate; if the document adds detail to one of these, return it with sameAs set to that id):\n${stories.map((s) => `${s.id} — ${s.title}`).join('\n')}\n\nQUESTION BANK:\n${qdoc.items.map(qLine).join('\n')}\n\nRead the whole document. Identify distinct potential stories — a decision, a mistake, a conversation, a meeting, a comment someone made, a pattern, a moment of doubt. One document is not one story; split separate events into separate records; if unsure whether two things are one story, keep them separate. Extract only what is actually known, in Claire's words (copy her sentences into the fields rather than summarising). Do not invent. Fields: ${fieldList}. Set kind "lead" when the material is only a fragment. Add followups where useful information is missing (specific questions to Claire). Suggest relatedQuestions (bank numbers) and newQuestions where the experience exposes something the bank lacks. Territories letters: ${TERRITORIES.map((t) => `${t.id}=${t.name}`).join('; ')}. Include sourceRef (where in the document). Skip purely personal material with no bearing on leadership, work, expertise, identity at work, or advising.` }],
    tool: { name: 'candidates', schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, kind: { type: 'string', enum: ['story', 'lead'] }, sameAs: { type: 'string' }, sourceRef: { type: 'string' }, fields: { type: 'object', additionalProperties: { type: 'string' } }, territories: { type: 'array', items: { type: 'string' } }, followups: { type: 'array', items: { type: 'string' } }, relatedQuestions: { type: 'array', items: { type: 'integer' } }, newQuestions: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, why: { type: 'string' } }, required: ['text'] } } }, required: ['title', 'kind', 'fields'] } } }, required: ['items'] } },
    maxTokens: 8000,
  });
  return { items: out.items, source };
}


    // ---- Patterns and contradictions across the bank (brief §13) ----
export async function runPatterns({ body, stories, qdoc, doc }) {
  const out = await askTool({
    system: VOICE,
    messages: [{ role: 'user', content: `STORIES:\n${stories.map(storyLine).join('\n\n')}\n\nCORE THESIS: ${(body.goal || []).join(' ')}\n\nQUESTION BANK (MVP marked):\n${qdoc.items.map(qLine).join('\n')}\n\n1) PATTERNS: where several stories suggest the same unexpected pattern (name the story ids). 2) CONTRADICTIONS: where a story contradicts the thesis or another story (ids, and what the contradiction is). 3) THIN EVIDENCE: MVP questions with no strong lived evidence in the bank (question numbers). Be sparing — only genuine findings, max 4 per list.` }],
    tool: { name: 'patterns', schema: { type: 'object', properties: { patterns: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } } }, required: ['text', 'ids'] } }, contradictions: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, ids: { type: 'array', items: { type: 'string' } } }, required: ['text', 'ids'] } }, thinMvp: { type: 'array', items: { type: 'integer' } } }, required: ['patterns', 'contradictions', 'thinMvp'] } },
    maxTokens: 1500,
  });
  doc.patterns = { at: new Date().toISOString(), ...out };
  return doc.patterns;
}
