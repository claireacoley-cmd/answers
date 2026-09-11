// The private Story Bank: source material, never content. Nothing here is ever public.
// A story is evidence Claire can think with later — preserved in her words, with its uncertainty intact.

export const PRIVACY = ['private', 'anonymise', 'usable']; // default: private
export const PRIVACY_LABEL = { private: 'Private only', anonymise: 'Anonymise', usable: 'Usable' };

// Field order as shown in the editor. `key` is the stored property.
export const FIELDS = [
  { key: 'title', label: 'Working title', short: true },
  { key: 'source', label: 'Original source', short: true },
  { key: 'period', label: 'Date / period', short: true },
  { key: 'context', label: 'Company / context', short: true },
  { key: 'people', label: 'People involved', short: true },
  { key: 'happening', label: 'What was happening', core: true },
  { key: 'role', label: 'Claire’s role', core: true },
  { key: 'problem', label: 'The problem or decision' },
  { key: 'difficulty', label: 'Why it was difficult', core: true },
  { key: 'did', label: 'What Claire did', core: true },
  { key: 'next', label: 'What happened next' },
  { key: 'outcome', label: 'Outcome', core: true },
  { key: 'thoughtThen', label: 'What Claire thought at the time', core: true },
  { key: 'thinkNow', label: 'What Claire thinks now', core: true },
  { key: 'gotRight', label: 'What Claire got right' },
  { key: 'gotWrong', label: 'What Claire got wrong' },
  { key: 'scenes', label: 'Specific scenes / moments / details' },
  { key: 'quotes', label: 'Memorable wording / quotes' },
  { key: 'ideas', label: 'Underlying ideas or tensions' },
  { key: 'evidence', label: 'Evidence / source documents' },
];
export const CORE_KEYS = FIELDS.filter((f) => f.core).map((f) => f.key);

// The seven things a story needs before it is "developed" (brief §9).
export function missingCore(story) {
  return CORE_KEYS.filter((k) => !(story[k] || '').trim());
}
export function needsDetail(story) {
  return story.kind === 'lead' || missingCore(story).length > 0;
}

export function blankStory(overrides = {}) {
  const s = { id: null, kind: 'story', privacy: 'private', territories: [], relatedQuestions: [], possibleQuestions: [], newQuestions: [], followups: [], transcript: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), dismissed: false };
  for (const f of FIELDS) s[f.key] = '';
  return { ...s, ...overrides };
}

// Priority story territories (brief §7). Used for gap-finding and to steer the interview.
export const TERRITORIES = [
  { id: 'A', name: 'The business becoming something different', prompts: ['Tell me about a specific moment when you realised the company you worked for had become a different kind of business.', 'What had changed?', 'What had not caught up yet?', 'What did leadership think was happening?', 'What did employees think was happening?', 'What did customers see?'] },
  { id: 'B', name: 'M&A', prompts: ['What did everyone believe before the deal that looked different afterwards?', 'What did the deal team care about?', 'What did you care about?', 'What did customers actually experience?', 'What was the hardest people decision?', 'What moment best captures what that acquisition was actually like?'] },
  { id: 'C', name: 'Building and changing teams', prompts: ['When did the team that got you here stop being the team you needed next?', 'Who surprised you by making the transition?', 'Who struggled?', 'When did you keep someone too long?', 'When did you hire capability instead of developing it?', 'When did your own job have to change?'] },
  { id: 'D', name: 'The person inside the change', prompts: ['What did you know that your team didn’t?', 'What couldn’t you tell them?', 'What were you personally worried about?', 'What did people expect you to know that you didn’t?', 'What decision was commercially sensible but personally horrible?', 'When were you unsure whether you were resisting a bad decision or protecting your own position?'] },
  { id: 'E', name: 'Leading in bad times', prompts: ['How did people’s behaviour change when things started going badly?', 'What became harder to say?', 'What did pressure do to your own judgement?', 'What did you have to protect?', 'What did you stop caring about?', 'What did you wish you had someone outside the situation to help you think through?'] },
  { id: 'F', name: 'Working outside your expertise', prompts: ['When were you expected to contribute to a decision you weren’t formally trained to make?', 'What did you need to understand?', 'What didn’t you need to understand?', 'What question unlocked it?', 'When did a specialist know more than you?', 'When did you understand something important they were missing?', 'When did you know you needed to stop and bring in an expert?'] },
  { id: 'G', name: 'Bankers, consultants, lawyers and specialist language', prompts: ['When did someone make an important business issue sound more complicated than it was?', 'What were they actually saying?', 'Which language was necessary precision?', 'Which language created distance?', 'Did you ever feel stupid because everyone else seemed to understand something?', 'Did you later discover other people didn’t understand it either?', 'Who was unusually good at explaining complex things? What did they do differently?'] },
  { id: 'H', name: 'Strategy and direction', prompts: ['When were you given a marketing problem that couldn’t be solved until leadership made a business decision?', 'When did leadership know it wanted change without knowing what it wanted the company to become?', 'What strategic choice did everyone avoid making?', 'When did customer evidence change the direction?'] },
  { id: 'I', name: 'Brand, positioning and proposition', prompts: ['What looked like a brand problem but wasn’t?', 'When did leadership want to say something the business couldn’t yet support?', 'When was an acquired brand worth preserving?', 'When did brand consolidation make sense?', 'When was marketing brought in too late?'] },
  { id: 'J', name: 'Commercial judgement and negotiation', prompts: ['What did you notice that the other person hadn’t?', 'What was the leverage?', 'What looked fair but wasn’t?', 'When did ego interfere with the commercial decision?', 'When did you know the person needed a lawyer/accountant/specialist rather than more advice from you?'] },
  { id: 'K', name: 'Professional identity', prompts: ['When did something you were known for stop being enough?', 'When did the company need a different version of you?', 'When did your status change?', 'When did you wonder whether the company had outgrown you?', 'When did you have more authority than confidence?', 'When did you realise you were now the senior person?', 'When did your job stop feeling like marketing?'] },
  { id: 'L', name: 'Power and politics', prompts: ['Who gained influence? Who lost it?', 'What became harder to say?', 'When did the official strategy differ from what people’s behaviour suggested was actually happening?', 'When did you have to decide whether to challenge, adapt or leave?'] },
  { id: 'M', name: 'Pressure and judgement', prompts: ['Tell me about a decision you had to make faster than you wanted.', 'What information was missing? What did you rely on?', 'When did urgency become panic?', 'When did pressure make you worse at making decisions?', 'When did you make a good decision despite having little information?', 'What do you now recognise about your own judgement under pressure?'] },
  { id: 'N', name: 'Confidence and credibility', prompts: ['When did you feel least credible in a room?', 'What did you think everyone else knew? What did you later realise?', 'When did trying to look more credible make you less like yourself?', 'When did someone underestimate you?'] },
  { id: 'O', name: 'Creativity and commerce', prompts: ['When did you protect a creative idea from being flattened by commercial thinking?', 'When was the creative idea good but commercially wrong?', 'When did you translate between creative people and business leadership?', 'What do commercial people misunderstand about creatives? What do creatives misunderstand about commercial reality?'] },
  { id: 'P', name: 'The informal adviser / agent role', prompts: ['What kinds of problems do people repeatedly bring you?', 'What did you see that they couldn’t?', 'What did they say was useful about talking to you?', 'What were you drawing on?', 'When did you tell them they needed someone else?'] },
  { id: 'Q', name: 'Mistakes and changed minds', priority: true, prompts: ['What did you once believe strongly that you no longer believe?', 'Which hire did you get wrong?', 'Which marketing decision did you get wrong?', 'When did someone junior prove you wrong?', 'When did reality contradict your instincts?', 'What did you learn through experience that you wouldn’t have accepted if someone had simply told you?'] },
  { id: 'R', name: 'Moments that changed how Claire leads', prompts: ['One conversation, one acquisition, one redundancy, one firing, one hire, one mistake.', 'One person who backed you; one who underestimated you.', 'The moment you became the senior person.', 'The moment your understanding of leadership changed.'] },
  { id: 'S', name: 'Things no one tells you before you become senior', prompts: ['What surprised you about senior leadership?', 'What gets harder that people below you cannot see?', 'What looks strategic from outside but messy from inside?', 'What responsibility did you underestimate? What emotional burden surprised you?', 'What did you assume senior leaders knew that you later realised everyone was working out as they went?'] },
  { id: 'T', name: 'AI, expertise and judgement', prompts: ['What can you now do because of AI that you couldn’t realistically have done yourself three years ago?', 'Where has AI allowed you to cross a functional boundary?', 'When has AI given you an answer that sounded right but didn’t fit the situation? What did you know that allowed you to spot that?', 'When has AI made you better at working with an expert rather than replacing one?', 'What do you still refuse to delegate to AI?', 'How do you decide when AI is enough and when you need a specialist?', 'Has AI changed what you think a senior leader needs to know?'] },
];
export const territoryName = (id) => TERRITORIES.find((t) => t.id === id)?.name || id;

// One-line digest used in matching prompts and evidence lists (never public).
export function digest(story) {
  const bits = [story.happening, story.problem, story.ideas].map((s) => (s || '').trim()).filter(Boolean);
  return bits.join(' ').replace(/\s+/g, ' ').slice(0, 600);
}
