// Markdown analysis + rendering. Pure functions over the post body.
import { marked } from 'marked';

marked.setOptions({ gfm: true, breaks: false });

/** Remove <!-- notes --> and {{placeholders}} left over from structures. */
export function cleanBody(md = '') {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function stripInline(md = '') {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~>#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function slugify(s = '') {
  return String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80);
}

/**
 * Split markdown into a structured outline.
 * Returns { headings:[{level,text,line}], paragraphs:[{text,line}], sections:[{heading, level, content}],
 *           links:[{text,href,external}], images:[{alt,src}], intro, tldr, faq:[{q,a}], words, sentences }
 */
export function analyse(mdRaw = '') {
  const md = cleanBody(mdRaw);
  const lines = md.split('\n');
  const headings = [];
  const paragraphs = [];
  let inCode = false;
  let buf = [];
  let bufStart = 0;

  const flush = (i) => {
    if (buf.length) {
      const text = buf.join(' ').trim();
      if (text) paragraphs.push({ text, line: bufStart });
      buf = [];
    }
    bufStart = i + 1;
  };

  lines.forEach((line, i) => {
    if (/^```/.test(line)) {
      inCode = !inCode;
      flush(i);
      return;
    }
    if (inCode) return;
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      flush(i);
      headings.push({ level: h[1].length, text: h[2].trim(), line: i });
      return;
    }
    if (/^\s*$/.test(line)) {
      flush(i);
      return;
    }
    if (/^\s*([-*+]|\d+\.)\s+/.test(line) || /^\s*\|/.test(line) || /^\s*>/.test(line)) {
      // list / table / quote lines: treat each as its own "paragraph" for readability but don't merge into prose
      flush(i);
      paragraphs.push({ text: line.replace(/^\s*([-*+]|\d+\.|>)\s*/, '').trim(), line: i, block: true });
      bufStart = i + 1;
      return;
    }
    if (!buf.length) bufStart = i;
    buf.push(line.trim());
  });
  flush(lines.length);

  // sections
  const sections = [];
  let current = { heading: null, level: 0, content: [] , line: -1 };
  headings.forEach((h) => {
    const nextLine = h.line;
    current.content = paragraphs.filter((p) => p.line > current.line && p.line < nextLine);
    sections.push(current);
    current = { heading: h.text, level: h.level, content: [], line: h.line };
  });
  current.content = paragraphs.filter((p) => p.line > current.line);
  sections.push(current);

  // links & images
  const links = [];
  const images = [];
  for (const m of md.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) images.push({ alt: m[1], src: m[2] });
  for (const m of md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').matchAll(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g)) {
    links.push({ text: m[1], href: m[2], external: /^https?:\/\//i.test(m[2]) });
  }

  // intro = first prose paragraph before any heading
  const firstHeadingLine = headings.length ? headings[0].line : Infinity;
  const intro = paragraphs.find((p) => !p.block && p.line < firstHeadingLine)?.text || paragraphs.find((p) => !p.block)?.text || '';

  // TL;DR section
  const tldrSection = sections.find((s) => s.heading && /^(tl;?dr|key takeaways?|in short|summary)\b/i.test(s.heading));
  const tldr = tldrSection ? tldrSection.content.map((p) => p.text).join(' ') : '';

  // FAQ: section titled FAQ/Questions; each H3 (or bold question line) becomes a Q, following paragraphs the A.
  const faq = [];
  const faqIdx = headings.findIndex((h) => /^(faq|faqs|frequently asked|common questions|questions)/i.test(h.text));
  if (faqIdx >= 0) {
    const faqLevel = headings[faqIdx].level;
    const start = headings[faqIdx].line;
    const nextSame = headings.slice(faqIdx + 1).find((h) => h.level <= faqLevel);
    const end = nextSame ? nextSame.line : Infinity;
    const qs = headings.filter((h) => h.line > start && h.line < end && h.level > faqLevel);
    qs.forEach((q, i) => {
      const qEnd = qs[i + 1] ? qs[i + 1].line : end;
      const a = paragraphs
        .filter((p) => p.line > q.line && p.line < qEnd)
        .map((p) => p.text)
        .join(' ');
      if (a) faq.push({ q: q.text, a: stripInline(a) });
    });
  }

  const plain = stripInline(paragraphs.map((p) => p.text).join(' '));
  const words = plain ? plain.split(/\s+/).filter(Boolean) : [];
  const sentences = plain ? plain.split(/(?<=[.!?])\s+(?=[A-Z0-9"“‘(])/).filter((s) => s.trim().length > 1) : [];

  return {
    md,
    headings,
    paragraphs,
    sections,
    links,
    images,
    intro,
    tldr,
    faq,
    words: words.length,
    wordList: words,
    sentences,
    plain,
  };
}

/** Flesch reading ease (approximate syllable count). */
export function readingEase(words, sentences) {
  if (!words.length || !sentences.length) return null;
  const syllables = words.reduce((n, w) => n + countSyllables(w), 0);
  const score = 206.835 - 1.015 * (words.length / sentences.length) - 84.6 * (syllables / words.length);
  return Math.round(Math.max(0, Math.min(100, score)));
}

function countSyllables(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const m = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '').match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

/** Render markdown to HTML (guide notes + placeholders removed). */
export function render(md = '') {
  return marked.parse(cleanBody(md));
}

/** Plain-text excerpt for meta description fallback. */
export function excerpt(md = '', max = 155) {
  const a = analyse(md);
  const src = a.intro || a.plain;
  if (src.length <= max) return src;
  const cut = src.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), 80)).trim() + '…';
}
