// GEO / AEO engine: rule checks, schema.org JSON-LD, head tags, off-page checklist.
// Nothing here rewrites your prose. It measures, generates metadata, and suggests.
import { analyse, readingEase, slugify, excerpt, stripInline } from './markdown.mjs';
import { escapeHtml } from './http.mjs';

const QUESTION_WORDS = /^(what|why|how|when|where|who|which|can|should|is|are|does|do|will|did|could|would)\b/i;

/**
 * Run all checks. Returns { score, checks:[{id, group, status:'pass'|'warn'|'fail', label, detail, weight}], stats }
 */
export function runChecks(post, settings = {}, allPosts = []) {
  const a = analyse(post.body || '');
  const title = (post.title || '').trim();
  const meta = (post.metaDescription || '').trim();
  const minWords = settings.minWords || 500;
  const checks = [];
  const add = (id, group, status, label, detail = '', weight = 1) => checks.push({ id, group, status, label, detail, weight });

  // ---- Answer-first (AEO) ----
  const introWords = a.intro ? a.intro.split(/\s+/).length : 0;
  if (!a.intro || introWords < 8) add('intro', 'answer', 'fail', 'Open with the answer', 'The first paragraph should answer the title directly, before any heading.', 3);
  else if (introWords > 70) add('intro', 'answer', 'warn', 'Opening paragraph is long', `${introWords} words. Aim for ≤ 60 so AI engines can lift it as the answer.`, 3);
  else add('intro', 'answer', 'pass', 'Opens with a short, quotable paragraph', `${introWords} words.`, 3);

  const titleIsQuestion = QUESTION_WORDS.test(title) || title.endsWith('?');
  if (!title) add('title', 'answer', 'fail', 'Add a title', 'Phrase it as the question someone would actually ask.', 3);
  else if (title.length > 65) add('title', 'answer', 'warn', 'Title is long', `${title.length} characters; keep ≤ 60 so it isn't truncated.`, 2);
  else add('title', 'answer', 'pass', titleIsQuestion ? 'Title is phrased as a question' : 'Title length is fine', titleIsQuestion ? '' : 'Question-form titles ("How do I…", "What is…") match how people ask AI assistants.', 2);

  if (a.tldr) add('tldr', 'answer', 'pass', 'Has a TL;DR / key takeaways block', '', 2);
  else add('tldr', 'answer', 'warn', 'No TL;DR section', 'A short "## TL;DR" list is the block answer engines most often quote.', 2);

  const hasDefinition = /\b(is|are|means|refers to)\b/.test(a.intro.slice(0, 200));
  if (a.intro && !hasDefinition) add('definition', 'answer', 'warn', 'No definitional sentence up top', 'One "X is …" sentence in the opening helps entity extraction.', 1);
  else if (a.intro) add('definition', 'answer', 'pass', 'Opening contains a definitional sentence', '', 1);

  // ---- Structure ----
  const h2s = a.headings.filter((h) => h.level === 2);
  const h1s = a.headings.filter((h) => h.level === 1);
  if (h1s.length) add('h1', 'structure', 'warn', 'Body contains an H1', 'The title is already the H1; use ## for sections.', 1);
  if (h2s.length === 0) add('h2', 'structure', a.words > 250 ? 'fail' : 'warn', 'No section headings', 'Break the post into ## sections; each should answer one sub-question.', 2);
  else if (h2s.length < 3 && a.words > 400) add('h2', 'structure', 'warn', 'Only ' + h2s.length + ' section heading(s)', 'Longer posts scan better with 3+ sections.', 1);
  else add('h2', 'structure', 'pass', `${h2s.length} section headings`, '', 2);

  const qHeadings = a.headings.filter((h) => QUESTION_WORDS.test(h.text) || h.text.endsWith('?'));
  if (h2s.length && qHeadings.length === 0) add('qheadings', 'structure', 'warn', 'No question-phrased headings', 'Headings that are questions map directly onto what people ask AI.', 1);
  else if (qHeadings.length) add('qheadings', 'structure', 'pass', `${qHeadings.length} question-phrased heading(s)`, '', 1);

  if (a.faq.length >= 2) add('faq', 'structure', 'pass', `FAQ section with ${a.faq.length} questions`, 'FAQPage schema will be generated automatically.', 2);
  else if (a.faq.length === 1) add('faq', 'structure', 'warn', 'FAQ has only one question', 'Add at least one more for FAQPage schema to be worthwhile.', 2);
  else add('faq', 'structure', 'warn', 'No FAQ section', 'Add "## FAQ" with "### Question?" sub-headings and short answers.', 2);

  const longParas = a.paragraphs.filter((p) => !p.block && p.text.split(/\s+/).length > 110);
  if (longParas.length) add('paras', 'structure', 'warn', `${longParas.length} long paragraph(s)`, 'Over ~100 words. Split them; short paragraphs get extracted cleanly.', 1);
  else add('paras', 'structure', 'pass', 'Paragraph lengths are good', '', 1);

  const hasList = a.paragraphs.some((p) => p.block);
  if (!hasList && a.words > 400) add('lists', 'structure', 'warn', 'No lists or tables', 'A list or table gives engines a structured block to cite.', 1);
  else if (hasList) add('lists', 'structure', 'pass', 'Contains a list or table', '', 1);

  // ---- Depth & authority ----
  if (a.words < minWords * 0.5) add('length', 'depth', 'warn', `Short: ${a.words} words`, `Fine for a daily note. For ranking depth aim for ${minWords}+.`, 1);
  else if (a.words < minWords) add('length', 'depth', 'warn', `${a.words} words`, `Target is ${minWords}+.`, 1);
  else add('length', 'depth', 'pass', `${a.words} words`, '', 1);

  const ext = a.links.filter((l) => l.external);
  if (ext.length === 0 && a.words > 300) add('sources', 'depth', 'warn', 'No external sources linked', 'Cite at least one source (a stat, a study, a doc). Cited claims get cited.', 2);
  else if (ext.length) add('sources', 'depth', 'pass', `${ext.length} external link(s)`, '', 2);

  const hasNumbers = /\b\d+(\.\d+)?%|\b\d{2,}\b/.test(a.plain);
  if (!hasNumbers && a.words > 300) add('numbers', 'depth', 'warn', 'No specific numbers or stats', 'Concrete figures make a passage quotable.', 1);
  else if (hasNumbers) add('numbers', 'depth', 'pass', 'Includes specific numbers', '', 1);

  const firstPerson = /\b(I|I've|I'd|my|we|our)\b/.test(a.plain);
  if (!firstPerson && a.words > 300) add('experience', 'depth', 'warn', 'No first-hand perspective', 'Add what you\'ve seen or done. Experience is the E in E-E-A-T and what generic AI content lacks.', 1);
  else if (firstPerson) add('experience', 'depth', 'pass', 'Includes first-hand perspective', '', 1);

  const published = allPosts.filter((p) => p.status === 'published' && p.id !== post.id);
  const internal = a.links.filter((l) => !l.external || l.href.includes('/answers/'));
  if (published.length && internal.length === 0) add('internal', 'depth', 'warn', 'No internal links', `Link to one of your ${published.length} other post(s).`, 1);
  else if (internal.length) add('internal', 'depth', 'pass', `${internal.length} internal link(s)`, '', 1);

  // ---- Readability ----
  const ease = readingEase(a.wordList, a.sentences);
  const avgSent = a.sentences.length ? Math.round(a.wordList.length / a.sentences.length) : 0;
  if (ease !== null && ease < 45) add('readability', 'readability', 'warn', `Reading ease ${ease} (dense)`, `Average sentence ${avgSent} words. Shorter sentences extract better.`, 1);
  else if (ease !== null) add('readability', 'readability', 'pass', `Reading ease ${ease}`, `Average sentence ${avgSent} words.`, 1);
  const longSentences = a.sentences.filter((s) => s.split(/\s+/).length > 35).length;
  if (longSentences) add('longsent', 'readability', 'warn', `${longSentences} very long sentence(s)`, 'Over 35 words. Consider splitting.', 1);

  // ---- Metadata ----
  if (!meta) add('meta', 'meta', 'warn', 'No meta description', 'One will be generated from the opening; better to write it (120–160 chars).', 2);
  else if (meta.length < 90) add('meta', 'meta', 'warn', 'Meta description is short', `${meta.length} chars; aim for 120–160.`, 1);
  else if (meta.length > 165) add('meta', 'meta', 'warn', 'Meta description is long', `${meta.length} chars; will be truncated around 160.`, 1);
  else add('meta', 'meta', 'pass', 'Meta description length is good', `${meta.length} chars.`, 2);

  const slug = post.slug || slugify(title);
  if (slug && slug.split('-').length > 8) add('slug', 'meta', 'warn', 'Slug is long', `/${slug} — trim stop words.`, 1);
  else if (slug) add('slug', 'meta', 'pass', 'Slug looks good', `/answers/${slug}`, 1);

  const noAlt = a.images.filter((i) => !i.alt.trim());
  if (noAlt.length) add('alt', 'meta', 'warn', `${noAlt.length} image(s) without alt text`, '', 1);
  else if (a.images.length) add('alt', 'meta', 'pass', 'All images have alt text', '', 1);
  if (post.coverImage && !post.coverAlt) add('coveralt', 'meta', 'warn', 'Cover image has no alt text', '', 1);

  if (!(post.tags || []).length) add('tags', 'meta', 'warn', 'No tags', 'One or two topic tags help group related answers.', 1);
  else add('tags', 'meta', 'pass', `${post.tags.length} tag(s)`, '', 1);

  if (!settings.authorBio) add('author', 'meta', 'warn', 'Author bio is empty (Settings)', 'A bio + profile links feed the Person schema on every post.', 1);

  // ---- Score ----
  const total = checks.reduce((n, c) => n + c.weight, 0);
  const got = checks.reduce((n, c) => n + (c.status === 'pass' ? c.weight : c.status === 'warn' ? c.weight * 0.4 : 0), 0);
  const score = total ? Math.round((got / total) * 100) : 0;

  return {
    score,
    checks,
    stats: {
      words: a.words,
      sentences: a.sentences.length,
      readingEase: ease,
      readMinutes: Math.max(1, Math.round(a.words / 220)),
      headings: a.headings.length,
      faq: a.faq.length,
      links: a.links.length,
      externalLinks: ext.length,
      hasTldr: Boolean(a.tldr),
    },
    outline: a.headings,
    faq: a.faq,
    paragraphs: a.paragraphs.filter((p) => !p.block).map((p) => ({ line: p.line, preview: p.text.slice(0, 90) })),
  };
}

// ---------------- Head tags + schema ----------------

export function postUrl(site, post) {
  return `${site}/answers/${post.slug}`;
}

export function buildSchema(post, settings, site) {
  const a = analyse(post.body || '');
  const url = postUrl(site, post);
  const desc = post.metaDescription || excerpt(post.body);
  const author = {
    '@type': 'Person',
    '@id': `${site}/#author`,
    name: settings.authorName || 'Claire Coley',
    ...(settings.authorUrl ? { url: settings.authorUrl } : { url: site }),
    ...(settings.authorBio ? { description: settings.authorBio } : {}),
    ...(settings.authorImage ? { image: settings.authorImage } : {}),
    ...((settings.sameAs || []).length ? { sameAs: settings.sameAs } : {}),
  };
  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${site}/#website`,
      url: site,
      name: settings.siteName || 'Claire Coley',
      inLanguage: settings.language || 'en-GB',
    },
    author,
    {
      '@type': 'BlogPosting',
      '@id': `${url}#article`,
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      headline: post.title,
      description: desc,
      inLanguage: settings.language || 'en-GB',
      datePublished: post.publishedAt || post.updatedAt,
      dateModified: post.updatedAt,
      author: { '@id': `${site}/#author` },
      publisher: settings.organisation
        ? { '@type': 'Organization', name: settings.organisation, url: site }
        : { '@id': `${site}/#author` },
      isPartOf: { '@id': `${site}/#website` },
      wordCount: a.words,
      ...(post.tags?.length ? { keywords: post.tags.join(', ') } : {}),
      ...(post.coverImage ? { image: [post.coverImage] } : {}),
      ...(a.tldr
        ? { speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.post-intro', '.post-tldr'] } }
        : { speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.post-intro'] } }),
      articleBody: a.plain.slice(0, 5000),
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${url}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: settings.siteName || 'Home', item: site },
        { '@type': 'ListItem', position: 2, name: settings.blogTitle || 'Answers', item: `${site}/answers` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    },
  ];
  if (a.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      mainEntity: a.faq.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

export function buildHead(post, settings, site) {
  const url = post.canonical || postUrl(site, post);
  const desc = post.metaDescription || excerpt(post.body);
  const title = `${post.title} — ${settings.siteName || 'Claire Coley'}`;
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(desc)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    `<meta name="author" content="${escapeHtml(settings.authorName || '')}">`,
    `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">`,
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${escapeHtml(post.title)}">`,
    `<meta property="og:description" content="${escapeHtml(desc)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:site_name" content="${escapeHtml(settings.siteName || '')}">`,
    `<meta property="og:locale" content="${(settings.language || 'en-GB').replace('-', '_')}">`,
    post.publishedAt ? `<meta property="article:published_time" content="${post.publishedAt}">` : '',
    `<meta property="article:modified_time" content="${post.updatedAt}">`,
    ...(post.tags || []).map((t) => `<meta property="article:tag" content="${escapeHtml(t)}">`),
    post.coverImage ? `<meta property="og:image" content="${escapeHtml(post.coverImage)}">` : '',
    `<meta name="twitter:card" content="${post.coverImage ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${escapeHtml(post.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(desc)}">`,
    post.coverImage ? `<meta name="twitter:image" content="${escapeHtml(post.coverImage)}">` : '',
    `<script type="application/ld+json">${JSON.stringify(buildSchema(post, settings, site))}</script>`,
  ];
  return tags.filter(Boolean).join('\n');
}

// ---------------- Off-page checklist ----------------

export function offpageChecklist(post, settings, site, env = {}) {
  const url = postUrl(site, post);
  const enc = encodeURIComponent;
  const a = analyse(post.body || '');
  const firstFaq = a.faq[0];
  return [
    {
      key: 'indexnow',
      auto: true,
      label: 'Ping IndexNow (Bing, Yandex, DuckDuckGo, Naver…)',
      detail: env.hasIndexNow ? 'Done automatically on publish.' : 'Set INDEXNOW_KEY in Netlify to enable automatic pings.',
      done: Boolean(post.offpage?.indexnow),
    },
    {
      key: 'gsc',
      label: 'Request indexing in Google Search Console',
      detail: 'URL inspection → Request indexing. Google has no IndexNow, so this is manual.',
      link: `https://search.google.com/search-console/inspect?resource_id=${enc(site + '/')}&id=${enc(url)}`,
    },
    {
      key: 'linkedin',
      label: 'Share on LinkedIn',
      detail: 'Paste the TL;DR as the post text; link in the first comment or the body.',
      link: `https://www.linkedin.com/feed/?shareActive=true&text=${enc((a.tldr || post.title) + '\n\n' + url)}`,
    },
    {
      key: 'x',
      label: 'Share on X / Threads / Bluesky',
      link: `https://twitter.com/intent/tweet?text=${enc(post.title)}&url=${enc(url)}`,
    },
    {
      key: 'answer',
      label: 'Answer the question where it is being asked',
      detail: firstFaq
        ? `Find your FAQ question ("${firstFaq.q}") on Reddit, Quora, or a niche forum; answer in your own words and cite the post.`
        : 'Search Reddit / Quora / forums for the title question; answer it and cite the post.',
      link: `https://www.reddit.com/search/?q=${enc(post.title)}`,
    },
    {
      key: 'newsletter',
      label: 'Send to your email list / newsletter',
      detail: 'Even a one-line "I wrote this" note.',
    },
    {
      key: 'backlink',
      label: 'Ask one person for a link or a mention',
      detail: 'Someone you cited, or someone you know who writes about this topic.',
    },
    {
      key: 'perplexity',
      label: 'Check how AI engines answer the question now',
      detail: 'Search the title in Perplexity / ChatGPT / Google AI Overviews. Note who is cited; those are your outreach targets.',
      link: `https://www.perplexity.ai/search?q=${enc(post.title)}`,
    },
    {
      key: 'bing',
      label: 'Verify in Bing Webmaster Tools (once)',
      detail: 'Bing powers ChatGPT search and Copilot. Import from Search Console, submit /answers/sitemap.xml.',
      link: 'https://www.bing.com/webmasters',
    },
    {
      key: 'refresh',
      label: 'Diary a refresh in 90 days',
      detail: 'Update stats, add new FAQs. Fresh "dateModified" keeps citations.',
    },
  ].map((item) => ({ ...item, done: item.done ?? Boolean(post.offpage?.[item.key]) }));
}

/** Ping IndexNow for a list of URLs. Returns {ok, status} or {skipped:true}. */
export async function pingIndexNow(urls, site) {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return { skipped: true };
  const host = new URL(site).host;
  try {
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key, keyLocation: `${site}/answers/indexnow-${key}.txt`, urlList: urls }),
    });
    return { ok: res.ok || res.status === 202, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export { slugify, excerpt, stripInline };
