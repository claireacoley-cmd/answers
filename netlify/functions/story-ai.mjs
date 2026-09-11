// Story Bank intelligence: matching stories ↔ questions, ingesting source documents, the interview ("Talk"),
// and pattern/contradiction spotting. Suggestions only — Claire decides everything. Auth-only.
import { getStore } from '@netlify/blobs';
import { requireAuth } from '../../lib/auth.mjs';
import { json, error, readJson } from '../../lib/http.mjs';
import { askTool, hasKey } from '../../lib/claude.mjs';
import { VOICE } from '../../lib/story-jobs.mjs';
import { loadStories, saveStories } from '../../lib/stories-store.mjs';
import { FIELDS, TERRITORIES, digest, needsDetail, missingCore, territoryName } from '../../lib/story-model.mjs';

const questionsDoc = async () => (await getStore({ name: 'questions', consistency: 'strong' }).get('list', { type: 'json' })) || { items: [] };
const qLine = (q) => `Q${q.n}${q.tier === 'mvp' ? ' [MVP]' : ''}: ${q.text}`;
const storyLine = (s) => `${s.id} — ${s.title}${s.kind === 'lead' ? ' (lead, thin)' : ''}\n  ${digest(s) || '(no detail yet)'}`;


async function matchQuestion(doc, q, stories) {
  const out = await askTool({
    system: VOICE,
    messages: [{ role: 'user', content: `QUESTION Claire is answering:\n${qLine(q)}\n\nSTORIES (id — title, then a digest):\n${stories.map(storyLine).join('\n\n')}\n\nWhich stories could provide lived evidence for this question, or complicate it? Return only genuine matches (0–6). For each, say in one clause why it is relevant — name the tension it tests, not just the topic. Mark strength "strong" when the story clearly bears on the question, "possible" when it might, and "contradicts" when it cuts against the question's likely answer.` }],
    tool: { name: 'matches', schema: { type: 'object', properties: { items: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, why: { type: 'string' }, strength: { type: 'string', enum: ['strong', 'possible', 'contradicts'] } }, required: ['id', 'why', 'strength'] } }, gap: { type: 'string', description: 'If evidence is thin: one sentence on what kind of story would fill the gap, phrased as a question to Claire. Empty if evidence is fine.' } }, required: ['items', 'gap'] } },
    maxTokens: 1200,
  });
  const valid = out.items.filter((m) => stories.some((s) => s.id === m.id));
  doc.matches[q.n] = { at: new Date().toISOString(), items: valid, gap: out.gap || '' };
  return doc.matches[q.n];
}

export default requireAuth(async (req, context) => {
  if (req.method !== 'POST') return error('Method not allowed', 405);
  if (!hasKey()) return error('Add an Anthropic key in Netlify to enable Story Bank suggestions.', 503);
  const { action } = context.params || {};
  const body = (await readJson(req)) || {};
  const doc = await loadStories();
  const stories = doc.items.filter((s) => !s.dismissed);
  const qdoc = await questionsDoc();

  try {
    // ---- QUESTION → stories ----
    if (action === 'match') {
      let q = qdoc.items.find((x) => x.n === Number(body.questionN));
      if (!q && body.text?.trim()) q = { n: 0, text: body.text.trim(), tier: 'bank' };
      if (!q) return error('Question not found', 404);
      const cached = q.n ? doc.matches[q.n] : null;
      const fresh = body.refresh || !cached || (Date.now() - Date.parse(cached.at)) > 7 * 86400e3 || (cached.storyCount !== undefined && cached.storyCount !== stories.length);
      const m = fresh ? await matchQuestion(doc, q, stories) : cached;
      m.storyCount = stories.length;
      if (!q.n) delete doc.matches[0];
      if (fresh && q.n) await saveStories(doc);
      const related = stories.filter((s) => (s.relatedQuestions || []).includes(q.n)).map((s) => ({ id: s.id, title: s.title, kind: s.kind, needsDetail: needsDetail(s) }));
      const possible = m.items.filter((x) => !related.some((r) => r.id === x.id)).map((x) => { const s = stories.find((y) => y.id === x.id); return { ...x, title: s.title, kind: s.kind, needsDetail: needsDetail(s) }; });
      return json({ related, possible, gap: m.gap, at: m.at });
    }

    // ---- STORY → questions ----
    if (action === 'questions') {
      const s = stories.find((x) => x.id === body.id);
      if (!s) return error('Story not found', 404);
      const full = FIELDS.map((f) => (s[f.key] ? `${f.label}: ${s[f.key]}` : '')).filter(Boolean).join('\n');
      const out = await askTool({
        system: VOICE,
        messages: [{ role: 'user', content: `STORY ${s.id}:\n${full}\n\nQUESTION BANK:\n${qdoc.items.map(qLine).join('\n')}\n\nTwo separate lists.\n1) EXISTING QUESTION MATCHES: which bank questions this story could give evidence for (0–5), each with one clause on why — the tension it tests.\n2) NEW QUESTION SUGGESTIONS (0–3): questions the story exposes that the bank does not yet hold. A good new question exposes a tension rather than describing the event. Bad: "How did Claire manage an acquisition?" Better: "What happens when the people responsible for integrating an acquisition were not involved in deciding to buy it?" Only suggest if the bank genuinely lacks it.\nAlso 3) TERRITORIES: which of these territory letters apply: ${TERRITORIES.map((t) => `${t.id}=${t.name}`).join('; ')}.` }],
        tool: { name: 'result', schema: { type: 'object', properties: { existing: { type: 'array', items: { type: 'object', properties: { n: { type: 'integer' }, why: { type: 'string' } }, required: ['n', 'why'] } }, newQuestions: { type: 'array', items: { type: 'object', properties: { text: { type: 'string' }, why: { type: 'string' } }, required: ['text', 'why'] } }, territories: { type: 'array', items: { type: 'string' } } }, required: ['existing', 'newQuestions', 'territories'] } },
        maxTokens: 1200,
      });
      s.possibleQuestions = out.existing.filter((e) => qdoc.items.some((q) => q.n === e.n) && !(s.relatedQuestions || []).includes(e.n));
      s.newQuestions = out.newQuestions;
      if (!(s.territories || []).length) s.territories = out.territories.filter((t) => TERRITORIES.some((x) => x.id === t));
      s.updatedAt = new Date().toISOString();
      await saveStories(doc);
      return json({ possibleQuestions: s.possibleQuestions, newQuestions: s.newQuestions, territories: s.territories });
    }

    // ---- Talk: the interview ----
    if (action === 'talk') {
      const s = body.storyId ? stories.find((x) => x.id === body.storyId) : null;
      const q = body.questionN ? qdoc.items.find((x) => x.n === Number(body.questionN)) : null;
      const counts = Object.fromEntries(TERRITORIES.map((t) => [t.id, stories.filter((x) => (x.territories || []).includes(t.id)).length]));
      const gaps = TERRITORIES.filter((t) => counts[t.id] === 0).map((t) => t.id);
      const thin = stories.filter(needsDetail).slice(0, 8).map((x) => `${x.id} ${x.title} — missing: ${x.kind === 'lead' ? 'most of it' : missingCore(x).join(', ')}; follow-ups: ${(x.followups || []).slice(0, 3).join(' | ')}`);
      const territoryGuide = TERRITORIES.map((t) => `${t.id}. ${t.name}${t.priority ? ' (PRIORITISE)' : ''} [${counts[t.id]} stories]\n   e.g. ${t.prompts.slice(0, 3).join(' / ')}`).join('\n');
      const focus = s ? `STORY OPEN NOW (${s.id} — ${s.title}). Fields so far:\n${FIELDS.map((f) => (s[f.key] ? `${f.label}: ${s[f.key]}` : '')).filter(Boolean).join('\n')}\nMissing core elements: ${missingCore(s).join(', ') || 'none'}. Follow-ups noted: ${(s.followups || []).join(' | ') || 'none'}.` : 'No story is open. Choose the most useful area: a gap in the bank, a thin lead, the question Claire is answering, a theme that keeps recurring, or a part of the core thesis with no lived evidence.';
      const system = `${VOICE}\n\nYou are interviewing Claire to recover stories. Do not work through topics as a questionnaire. Ask ONE strong question (or a small cluster of two or three tightly related ones) at a time. Follow specificity: if she says "that acquisition was horrible", do not move on — ask what actually happened, which meeting, who was in the room, what was said, what she thought when they said it, what she did afterwards. Use her exact phrases back to her. Choose territory by: gaps in the bank (${gaps.join(', ') || 'none'}), the question being answered${q ? ` (${qLine(q)})` : ''}, thin leads, recurring themes, thesis areas lacking evidence. Never flatter. Never summarise her story back as a tidy lesson.\n\nTERRITORIES with prompt examples:\n${territoryGuide}\n\nTHIN LEADS:\n${thin.join('\n') || 'none'}\n\n${focus}\n\nOn every turn, besides your next question, capture what Claire just said into the story fields: put her words (verbatim or lightly trimmed, first person, never paraphrased into corporate language) into the most fitting field(s) as updates. If nothing new was said, return no updates. If she reveals a story that is clearly separate from the open one, set newStoryTitle so it can be started as its own record. Update followups with what is still missing.`;
      const msgs = (body.messages || []).filter((m) => m.role && m.content).slice(-30);
      if (!msgs.length) msgs.push({ role: 'user', content: '(Claire has opened the interview. Ask your opening question.)' });
      const out = await askTool({
        system, messages: msgs,
        tool: { name: 'turn', schema: { type: 'object', properties: { say: { type: 'string', description: 'Your next question(s) to Claire. Short.' }, territory: { type: 'string' }, updates: { type: 'array', items: { type: 'object', properties: { field: { type: 'string', enum: FIELDS.map((f) => f.key) }, text: { type: 'string' } }, required: ['field', 'text'] } }, followups: { type: 'array', items: { type: 'string' } }, newStoryTitle: { type: 'string' } }, required: ['say', 'updates'] } },
        maxTokens: 900,
      });
      return json(out);
    }

    return error('Unknown action', 404);
  } catch (e) {
    return error(e.message || 'Story Bank request failed', 502);
  }
});

export const config = { path: '/api/story-ai/:action' };
