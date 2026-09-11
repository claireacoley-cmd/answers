// Seeded "Inspo" library. Two kinds:
//   structure — a fill-in skeleton that gets inserted into the editor
//   voice     — a reference passage you read alongside your draft (never published)
// Everything here is editable/deletable in the app; paste new ones from Claude / ChatGPT.

const GUIDE = `<!-- Lines like this are notes to you. They are stripped out on publish. -->`;

export const DEFAULT_TEMPLATES = [
  {
    id: 'structure-direct-answer',
    kind: 'structure',
    order: 1,
    name: 'Direct answer (AEO)',
    description: 'Answer the question in the first 50 words, then earn the depth. Best for "what is / how do I / should I" posts.',
    body: `${GUIDE}
<!-- Title should be the exact question a person would ask an AI or Google. -->

<!-- First paragraph: the answer, in ≤ 50 words. No preamble. -->
{{One-paragraph direct answer.}}

## TL;DR

- {{Key point 1}}
- {{Key point 2}}
- {{Key point 3}}

## Why this matters

{{Context. Why the reader is asking. What's usually misunderstood.}}

## {{Sub-question 1 phrased as a question?}}

{{Answer, with a concrete example or number.}}

## {{Sub-question 2 phrased as a question?}}

{{Answer.}}

## What I'd actually do

{{Your opinion, from experience. This is what makes the post citeable rather than generic.}}

## FAQ

### {{Related question 1?}}

{{2–3 sentence answer.}}

### {{Related question 2?}}

{{2–3 sentence answer.}}
`,
  },
  {
    id: 'structure-how-to',
    kind: 'structure',
    order: 2,
    name: 'How-to',
    description: 'Numbered steps with a result up front. Generates HowTo-friendly structure.',
    body: `${GUIDE}
{{One sentence: what you'll be able to do by the end, and how long it takes.}}

## TL;DR

{{Two sentences summarising the method.}}

## What you need

- {{Thing 1}}
- {{Thing 2}}

## Step 1: {{Verb the thing}}

{{What to do and what you should see.}}

## Step 2: {{Verb the thing}}

{{...}}

## Step 3: {{Verb the thing}}

{{...}}

## Common mistakes

{{The one or two things people get wrong.}}

## FAQ

### {{Question?}}

{{Answer.}}
`,
  },
  {
    id: 'structure-opinion',
    kind: 'structure',
    order: 3,
    name: 'Opinion / take',
    description: 'A clear position, stated early, with the strongest counter-argument answered.',
    body: `${GUIDE}
{{Your position in one or two sentences. Say the thing.}}

## TL;DR

{{The position + the single best reason.}}

## The usual view

{{What most people say, fairly stated.}}

## Where it breaks

{{Your evidence: a story, a number, a pattern you've seen.}}

## The strongest objection

{{Steelman it, then answer it.}}

## What to do instead

{{Practical takeaway.}}

## FAQ

### {{Question?}}

{{Answer.}}
`,
  },
  {
    id: 'structure-comparison',
    kind: 'structure',
    order: 4,
    name: 'Comparison (X vs Y)',
    description: 'Answer "which should I choose" with a verdict first and a table.',
    body: `${GUIDE}
{{Verdict in one paragraph: who should pick X, who should pick Y.}}

## TL;DR

- Choose **{{X}}** if {{...}}
- Choose **{{Y}}** if {{...}}

## Side by side

| | {{X}} | {{Y}} |
|---|---|---|
| {{Criterion 1}} | | |
| {{Criterion 2}} | | |
| {{Criterion 3}} | | |

## Where {{X}} wins

{{...}}

## Where {{Y}} wins

{{...}}

## My recommendation

{{...}}

## FAQ

### Is {{X}} better than {{Y}} for {{use case}}?

{{Answer.}}
`,
  },
  {
    id: 'structure-daily',
    kind: 'structure',
    order: 5,
    name: 'Daily note',
    description: 'Lowest-friction option. One idea, 300 words, done.',
    body: `${GUIDE}
{{The idea, stated plainly.}}

{{Why it came up today.}}

{{What it changes about how you'd act.}}

## TL;DR

{{One line.}}
`,
  },
  {
    id: 'voice-satc-opening',
    kind: 'voice',
    order: 10,
    name: 'Sex and the City — the baby shower',
    description: 'Blunt admission, comic escalation in specific images, then one question turns it personal. Reference only, never published.',
    body: `Let’s be honest. Sometimes there is nothing harder in life than being happy for somebody else. Like lottery winners, or extremely successful people who are 27.

Then there’s that hell on earth that only your closest friends can inflict on you — the baby shower.

“You could not drag me to that thing if you put a grappling hook in my mouth.”

“Frankly, I think it’s sad, the way she’s using a child to validate her existence.”

“Exactly. Why can’t she just use sex and a nice cocktail like the rest of us?”

“I’m happy for her… I am. If I see another crepe-paper stork, I’m gonna rip its cardboard beak off.”

“Can I ask you — would any baby shower bother you, or is this one worse because it’s Laney’s?”

Laney Berlin. You can’t really describe her. You just had to know her. Chances are, eight years ago, you probably did.

<!-- Source: Sex and the City, S1E10. Private reference — copyrighted, do not publish. -->`,
  },
];
