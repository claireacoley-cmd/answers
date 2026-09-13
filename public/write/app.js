/* Write — three steps: 01 Write · 02 Edit · 03 Publish. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  let toastTimer;
  const toast = (msg, ms = 2600) => { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), ms); };
  const api = async (path, opts = {}) => {
    const res = await fetch(path, { headers: { 'content-type': 'application/json' }, ...opts, body: opts.body && typeof opts.body !== 'string' ? JSON.stringify(opts.body) : opts.body });
    if (res.status === 401) { showLogin(); throw new Error('Not logged in'); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  };

  const S = window.__S = { posts: [], post: null, settings: null, inspo: [], questions: null, env: {}, analysis: null, dirty: false, step: 'write', qFilter: 'open' };
  const bodyEd = window.createEditor({ parent: $('#body'), placeholderText: 'Write the answer first.', onChange: () => bodyEd._on && bodyEd._on() });
  const el = { title: $('#title'), body: bodyEd, saveState: $('#saveState') };
  $$('.fmt [data-fmt]').forEach((b) => b.addEventListener('mousedown', (e) => { e.preventDefault(); bodyEd[b.dataset.fmt](); }));

  // ---------- Auth ----------
  function showLogin() { $('#login').hidden = false; $('#app').hidden = true; setTimeout(() => $('#password').focus(), 50); }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('#loginError').hidden = true;
    try { await api('/api/login', { method: 'POST', body: { password: $('#password').value } }); $('#password').value = ''; await boot(); }
    catch (err) { $('#loginError').textContent = err.message; $('#loginError').hidden = false; }
  });
  $('#btnLogout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); location.reload(); });

  async function boot() {
    const me = await api('/api/me'); S.env = me;
    if (!me.authed) return showLogin();
    $('#login').hidden = true; $('#app').hidden = false;
    [S.settings, S.posts, S.inspo, S.questions] = await Promise.all([api('/api/settings'), api('/api/posts'), api('/api/inspo'), api('/api/questions').catch(() => null)]);
    $('#masthead').textContent = S.settings.authorName || S.settings.siteName || 'Write';
    $('#folioFoot').textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#addrHost').textContent = (me.siteUrl || location.origin).replace(/^https?:\/\//, '') + '/answers/';
    $('#aiOff').hidden = me.hasAi;
    $$('#sugBtns [data-kind]').forEach((b) => (b.disabled = !me.hasAi, b.style.opacity = me.hasAi ? '' : '0.3'));
    renderRail();
    if (window.Stories) window.Stories.load().catch(() => {});
    const last = localStorage.getItem('write:lastPost');
    if (last && S.posts.some((p) => p.id === last)) await openPost(last);
    else if (S.posts.length) await openPost(S.posts[0].id);
    else await newPost();
  }

  // ---------- Steps ----------
  $$('#steps button').forEach((b) => b.addEventListener('click', () => go(b.dataset.step)));
  async function go(step) {
    if (step === 'new') return goNew();
    if (!S.post) return;
    await flushSave();
    if (step !== 'write' && !el.title.value.trim() && !el.body.value.trim()) { toast('Write something first.'); return; }
    S.step = step; S.inStories = false; document.body.classList.remove('inStories');
    $$('#steps button').forEach((b) => { b.classList.toggle('active', b.dataset.step === step); });
    $$('.view').forEach((v) => (v.hidden = v.id !== `view-${step}`));
    $('#folio').hidden = step !== 'write'; $('#btnNext').hidden = false;
    $('#btnNext').textContent = step === 'write' ? 'Done →' : step === 'edit' ? 'Ready to publish →' : 'Write another →';
    if (step === 'edit') renderEdit();
    if (step === 'publish') renderPublish();
    if (step === 'write') setTimeout(() => (el.title.value ? el.body : el.title).focus(), 50);
    window.scrollTo(0, 0);
  }
  $('#btnNext').addEventListener('click', () => go(S.step === 'write' ? 'edit' : S.step === 'edit' ? 'publish' : 'new'));
  $('#backToWrite').addEventListener('click', () => go('write'));
  const goNew = async () => { await newPost(); go('write'); };

  // ---------- Posts ----------
  function renderRail() {
    const drafts = S.posts.filter((p) => p.status !== 'published').length, live = S.posts.length - drafts;
    $('#draftCount').textContent = `${drafts} draft${drafts === 1 ? '' : 's'} · ${live} live`;
    $('#refCount').textContent = `${S.inspo.length} note${S.inspo.length === 1 ? '' : 's'}`;
    if (S.questions) { const done = S.questions.items.filter(qDone).length; $('#qCount').textContent = `${done} / ${S.questions.items.length} answered`; }
  }
  async function refreshList() { S.posts = await api('/api/posts'); renderRail(); }
  async function newPost() {
    await flushSave();
    const post = await api('/api/posts', { method: 'POST', body: {} });
    await refreshList(); await openPost(post.id, post);
  }
  async function openPost(id, loaded) {
    await flushSave();
    const post = loaded || (await api(`/api/posts/${id}`));
    S.post = post; S.analysis = null;
    try { localStorage.setItem('write:lastPost', id); } catch {}
    try {
      const bk = JSON.parse(localStorage.getItem(`write:backup:${id}`) || 'null');
      if (bk && bk.updatedAt > post.updatedAt && (bk.body !== post.body || bk.title !== post.title) && confirm('A newer unsaved version was found in this browser. Restore it?')) { post.body = bk.body; post.title = bk.title; markDirty(); }
    } catch {}
    S.loading = true; el.title.value = post.title || ''; el.body.value = post.body || ''; S.loading = false;
    $('#slug').value = post.slug || ''; $('#metaDescription').value = post.metaDescription || ''; $('#tags').value = (post.tags || []).join(', ');
    $('#suggestions').innerHTML = ''; $('#proofList').innerHTML = '';
    autogrow(); updateCounts(); renderRail();
    if (S.step !== 'write') go('write'); else { $$('#steps button')[0].classList.add('active'); $('#btnNext').textContent = 'Done →'; }
  }

  // ---------- Editing & autosave ----------
  const collect = () => ({ title: el.title.value, body: el.body.value, slug: $('#slug').value.trim(), metaDescription: $('#metaDescription').value, tags: $('#tags').value.split(',').map((s) => s.trim()).filter(Boolean) });
  function markDirty() {
    S.dirty = true; el.saveState.textContent = 'Unsaved';
    try { localStorage.setItem(`write:backup:${S.post.id}`, JSON.stringify({ ...collect(), updatedAt: new Date().toISOString() })); } catch {}
    scheduleSave();
  }
  const scheduleSave = debounce(saveNow, 1500);
  async function saveNow() {
    if (!S.post || !S.dirty) return;
    const data = collect(); S.dirty = false;
    try {
      const saved = await api(`/api/posts/${S.post.id}`, { method: 'PUT', body: data });
      Object.assign(S.post, saved);
      if (!$('#slug').value) $('#slug').value = saved.slug || '';
      el.saveState.textContent = `Saved ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
      try { localStorage.removeItem(`write:backup:${S.post.id}`); } catch {}
      const li = S.posts.find((p) => p.id === saved.id); if (li) { li.title = saved.title; li.updatedAt = saved.updatedAt; }
    } catch (err) { S.dirty = true; el.saveState.textContent = 'Save failed — retrying'; scheduleSave(); }
  }
  async function flushSave() { if (S.dirty) await saveNow(); }
  window.addEventListener('beforeunload', (e) => { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });
  el.title.addEventListener('input', () => { el.title.value = el.title.value.replace(/\n/g, ' '); markDirty(); updateCounts(); autogrow(); });
  el.body.addEventListener('input', () => { if (S.loading) return; markDirty(); updateCounts(); });
  ['#slug', '#metaDescription', '#tags'].forEach((s) => $(s).addEventListener('input', () => { markDirty(); updateCounts(); analyseSoon(); }));
  el.title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); el.body.focus(); } });
  document.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveNow(); } if (e.key === 'Escape') closePanel(); });
  function autogrow() { if (CSS.supports && CSS.supports('field-sizing', 'content')) return; el.title.style.height = 'auto'; el.title.style.height = el.title.scrollHeight + 'px'; }
  function updateCounts() {
    const words = el.body.value.split(/\s+/).filter(Boolean).length;
    $('#wordCount').textContent = `Words · ${words}`;
    const m = $('#metaDescription').value.length; $('#metaCount').textContent = m ? `· ${m}` : '';
  }

  // ---------- 02 Edit ----------
  async function renderEdit() {
    $('#editTitle').textContent = el.title.value || 'Untitled';
    await flushSave();
    try { const { html } = await api(`/api/posts/${S.post.id}/preview`); $('#editBody').innerHTML = html; }
    catch { $('#editBody').textContent = el.body.value; }
    analyse();
    if (window.Stories) window.Stories.renderEvidence();
  }
  const analyseSoon = debounce(analyse, 900);
  async function analyse() {
    if (!S.post) return;
    try {
      const r = await api(`/api/posts/${S.post.id}/analyse`, { method: 'POST', body: collect() });
      S.analysis = r;
      $('#scoreNum').textContent = r.score;
      const issues = r.checks.filter((c) => c.status !== 'pass');
      $('#scoreNote').textContent = issues.length ? `${issues.length} thing${issues.length === 1 ? '' : 's'} would help` : 'Nothing to fix';
      $('#checks').innerHTML = issues.map((c) => `<div class="check ${c.status}"><span class="dot"></span><span>${esc(c.label)}${c.detail ? `<span class="dtl">${esc(c.detail)}</span>` : ''}</span></div>`).join('');
      snapToGrid('#checks .check');
      if (!$('#slug').value && r.suggestedSlug) $('#slug').placeholder = r.suggestedSlug;
      if (!$('#metaDescription').value) $('#metaDescription').placeholder = r.suggestedMeta;
      renderOffpage(r.offpage);
    } catch (err) { console.warn(err); }
  }

  $$('#sugBtns [data-kind]').forEach((b) => b.addEventListener('click', () => suggest(b.dataset.kind, b)));
  async function suggest(kind, btn) {
    btn.disabled = true; const old = btn.textContent; btn.textContent = 'Thinking…';
    try { const r = await api('/api/suggest', { method: 'POST', body: { kind, title: el.title.value, body: el.body.value } }); renderSuggestions(kind, r); }
    catch (err) { toast(err.message, 5000); } finally { btn.disabled = false; btn.textContent = old; }
  }
  const LABEL = { subheads: 'Subheads', faq: 'FAQ', tldr: 'TL;DR', meta: 'Meta', titles: 'Titles', review: 'Notes' };
  function renderSuggestions(kind, r) {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div class="sugHead m"><span class="strong">${LABEL[kind]}</span><button class="link sec">Clear</button></div>`;
    wrap.querySelector('button').onclick = () => wrap.remove();
    if (!r.items.length) wrap.insertAdjacentHTML('beforeend', '<p class="m sec">Nothing to suggest.</p>');
    r.items.forEach((it) => {
      const d = document.createElement('div'); d.className = 'sug';
      let inner = '', action = null, label = 'Add';
      if (kind === 'subheads') { const para = r.paragraphs[it.beforeParagraph] || ''; inner = `<div class="q">## ${esc(it.heading)}</div><div class="m sec">above “${esc(para.slice(0, 60))}…”</div>`; action = () => insertHeadingBefore(para, it.heading); }
      else if (kind === 'faq') { inner = `<div class="q">${esc(it.question)}</div><div class="a">${esc(it.draftAnswer)}</div><div class="m sec">Draft from your own words — edit after adding</div>`; action = () => appendFaq(it.question, it.draftAnswer); }
      else if (kind === 'tldr') { inner = `<div class="a">${it.bullets.map((b) => `— ${esc(b)}`).join('\n')}</div>`; label = S.analysis?.stats?.hasTldr ? 'Replace' : 'Add'; action = () => insertTldr(it.bullets); }
      else if (kind === 'meta') { inner = `<div class="a">${esc(it.text)}</div><div class="m sec">${it.text.length} characters</div>`; label = 'Use'; action = () => { $('#metaDescription').value = it.text; markDirty(); updateCounts(); analyseSoon(); }; }
      else if (kind === 'titles') { inner = `<div class="q">${esc(it.text)}</div>${it.why ? `<div class="m sec">${esc(it.why)}</div>` : ''}`; label = 'Use'; action = () => { el.title.value = it.text; $('#editTitle').textContent = it.text; markDirty(); analyseSoon(); }; }
      else if (kind === 'review') { inner = `<div class="a">${esc(it.note)}</div>${it.where ? `<div class="m sec">${esc(it.where)}</div>` : ''}`; }
      d.innerHTML = inner + `<div class="row">${action ? `<button class="m link strong red accept">${label}</button>` : ''}<button class="m link sec reject">Skip</button></div>`;
      if (action) d.querySelector('.accept').onclick = () => { action(); d.remove(); renderEdit(); toast('Added to your draft.'); };
      d.querySelector('.reject').onclick = () => d.remove();
      wrap.appendChild(d);
    });
    $('#suggestions').prepend(wrap);
  }
  function setBody(v) { el.body.value = v; markDirty(); updateCounts(); autogrow(); }
  function insertHeadingBefore(paraText, heading) {
    const body = el.body.value, needle = paraText.slice(0, 40); let idx = needle ? body.indexOf(needle) : -1;
    if (idx < 0) return setBody(body.replace(/\s*$/, '') + `\n\n## ${heading}\n`);
    const ls = body.lastIndexOf('\n', idx - 1) + 1; setBody(body.slice(0, ls) + `## ${heading}\n\n` + body.slice(ls));
  }
  function appendFaq(q, a) {
    const body = el.body.value, m = body.match(/^##\s+(FAQ|FAQs|Frequently asked.*|Common questions|Questions)\s*$/im), block = `### ${q}\n\n${a}\n`;
    if (!m) return setBody(body.replace(/\s*$/, '') + `\n\n## FAQ\n\n${block}`);
    const start = m.index + m[0].length, next = body.slice(start).search(/^##\s+/m);
    if (next < 0) setBody(body.replace(/\s*$/, '') + `\n\n${block}`); else { const at = start + next; setBody(body.slice(0, at).replace(/\s*$/, '') + `\n\n${block}\n` + body.slice(at)); }
  }
  function insertTldr(bullets) {
    const body = el.body.value, block = `## TL;DR\n\n${bullets.map((b) => `- ${b}`).join('\n')}\n`, m = body.match(/^##\s+(TL;?DR|Key takeaways?|In short|Summary)[^\n]*\n/im);
    if (m) { const after = m.index + m[0].length, next = body.slice(after).search(/^##\s+/m), end = next < 0 ? body.length : after + next; return setBody(body.slice(0, m.index) + block + '\n' + body.slice(end).replace(/^\s*/, '')); }
    const fh = body.search(/^##\s+/m), ie = body.search(/\n\s*\n/);
    if (ie > 0 && (fh < 0 || ie < fh)) setBody(body.slice(0, ie) + `\n\n${block}\n` + body.slice(ie).replace(/^\s+/, ''));
    else if (fh > 0) setBody(body.slice(0, fh) + block + '\n' + body.slice(fh)); else setBody(body.replace(/\s*$/, '') + `\n\n${block}`);
  }

  // Proofread
  $('#btnProofread').addEventListener('click', async () => {
    const list = $('#proofList'); list.innerHTML = '<p class="m sec">Checking…</p>';
    try {
      const text = `${el.title.value}\n\n${el.body.value}`;
      const r = await api('/api/proofread', { method: 'POST', body: { text, language: 'en-GB' } });
      renderProof(r.matches || [], el.title.value.length + 2);
    } catch (err) { list.innerHTML = `<p class="m err">${esc(err.message)}</p>`; }
  });
  function renderProof(matches, bodyOffset) {
    const list = $('#proofList');
    if (!matches.length) { list.innerHTML = '<p class="m sec">No spelling or grammar issues found.</p>'; return; }
    list.innerHTML = `<div class="sugHead m"><span class="strong">Proofread · ${matches.length}</span><button class="link sec">Clear</button></div>`;
    list.querySelector('button').onclick = () => (list.innerHTML = '');
    matches.forEach((m) => {
      const d = document.createElement('div'); d.className = 'proof';
      const c = m.context, before = c.text.slice(0, c.offset), hit = c.text.substr(c.offset, c.length), after = c.text.slice(c.offset + c.length);
      d.innerHTML = `…${esc(before)}<mark>${esc(hit)}</mark>${esc(after)}…<span class="msg">${esc(m.message)}</span><div class="row">${m.replacements.slice(0, 4).map((r) => `<button class="m link strong red rep">${esc(r.value) || '(remove)'}</button>`).join('')}<button class="m link sec ign">Ignore</button></div>`;
      d.querySelectorAll('.rep').forEach((b, i) => b.onclick = () => {
        const v = m.replacements[i].value, inTitle = m.offset < bodyOffset, target = inTitle ? el.title : el.body, off = inTitle ? m.offset : m.offset - bodyOffset, cur = target.value;
        if (cur.substr(off, m.length) !== hit) { toast('Text changed — run Proofread again.'); return; }
        target.value = cur.slice(0, off) + v + cur.slice(off + m.length);
        const delta = v.length - m.length; matches.forEach((o) => { if (o !== m && o.offset > m.offset && (inTitle ? o.offset < bodyOffset : true)) o.offset += delta; }); if (inTitle) bodyOffset += delta;
        markDirty(); updateCounts(); renderEdit(); d.remove();
      });
      d.querySelector('.ign').onclick = () => d.remove();
      list.appendChild(d);
    });
  }

  // ---------- 03 Publish ----------
  function renderPublish() {
    const p = S.post, live = p.status === 'published', host = $('#addrHost').textContent;
    const slug = $('#slug').value || $('#slug').placeholder || p.slug || '';
    $('#pubStatus').textContent = live ? `Published · ${new Date(p.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Draft — not on the site yet. It will go to';
    $('#pubAddress').innerHTML = live ? 'It’s live.' : esc(host + slug).replace(/-/g, '-<wbr>');
    $('#pubNote').textContent = live ? host + p.slug : 'Schema, meta, sitemap and feed are handled. Search engines are pinged.';
    $('#btnPublish').textContent = live ? 'Update & re-ping' : 'Publish';
    $('#btnUnpublish').hidden = !live; const v = $('#viewLive'); v.hidden = !live; if (live) v.href = `/answers/${p.slug}`;
    if (!S.analysis) analyse(); else renderOffpage(S.analysis.offpage);
  }
  $('#btnPublish').addEventListener('click', async () => {
    await flushSave();
    const score = S.analysis?.score ?? 0;
    if (S.post.status !== 'published' && score < 55 && !confirm(`The GEO score is ${score} — it will still publish fine. Publish now?`)) return;
    try {
      const r = await api(`/api/posts/${S.post.id}/publish`, { method: 'POST' });
      S.post = r.post; $('#slug').value = r.post.slug; await refreshList(); renderPublish(); analyse();
      const q = S.questions?.items.find((x) => x.postId === S.post.id); if (q && !q.done) { q.done = true; S.qNext = null; api(`/api/questions/${q.n}`, { method: 'PUT', body: { done: true } }); }
      renderRail();
      toast(r.republished ? 'Updated and re-pinged.' : `Published — live at ${r.url}`, 5000);
    } catch (err) { toast(err.message, 5000); }
  });
  $('#btnUnpublish').addEventListener('click', async () => { if (!confirm('Unpublish this post?')) return; const r = await api(`/api/posts/${S.post.id}/unpublish`, { method: 'POST' }); S.post = r.post; await refreshList(); renderPublish(); renderRail(); });
  $('#btnDelete').addEventListener('click', async () => { if (!confirm('Delete this post permanently?')) return; await api(`/api/posts/${S.post.id}`, { method: 'DELETE' }); S.post = null; await refreshList(); if (S.posts.length) await openPost(S.posts[0].id); else await newPost(); go('write'); });
  function snapToGrid(sel) { $$(sel).forEach((n) => { n.style.paddingBottom = '12px'; const h = n.offsetHeight; const r = h % 26; if (r) n.style.paddingBottom = (12 + 26 - r) + 'px'; }); }
  function renderOffpage(items) {
    $('#offpage').innerHTML = items.map((it) => `<li class="${it.done ? 'done' : ''}"><input type="checkbox" data-key="${it.key}" ${it.done ? 'checked' : ''} ${it.auto ? 'disabled' : ''}><span><span class="lbl">${esc(it.label)}${it.link ? ` <a href="${esc(it.link)}" target="_blank" rel="noopener">↗</a>` : ''}</span>${it.detail ? `<span class="dtl">${esc(it.detail)}</span>` : ''}</span></li>`).join('');
    $('#offNum').textContent = `${items.filter((i) => i.done).length}\u200A/\u200A${items.length}`; snapToGrid('#offpage li');
    $$('#offpage input').forEach((cb) => cb.addEventListener('change', async () => { const offpage = { ...(S.post.offpage || {}), [cb.dataset.key]: cb.checked }; S.post.offpage = offpage; cb.closest('li').classList.toggle('done', cb.checked); await api(`/api/posts/${S.post.id}`, { method: 'PUT', body: { offpage } }); }));
  }

  // ---------- Pull-out panel ----------
  function openPanel(title, html) { $('#panelTitle').textContent = title; $('#panelBody').innerHTML = html; $('#panel').hidden = false; }
  function closePanel() { $('#panel').hidden = true; }
  $('#panelClose').addEventListener('click', closePanel);

  $('#btnDrafts').addEventListener('click', () => {
    const item = (p) => `<div class="item draft" data-id="${p.id}"><div class="name">${esc(p.title || 'Untitled')}</div><div class="m sec">${p.status === 'published' ? 'Live' : 'Draft'} · ${p.words} words · ${new Date(p.updatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div></div>`;
    openPanel('Drafts', `<button class="m link strong red" id="panelNew">+ New post</button>${S.posts.map(item).join('')}`);
    $('#panelNew').onclick = async () => { closePanel(); await goNew(); };
    $$('#panelBody .draft').forEach((d) => d.addEventListener('click', async () => { closePanel(); await openPost(d.dataset.id); }));
  });

  $('#btnRefs').addEventListener('click', renderRefs);
  function renderRefs() {
    const items = S.inspo;
    const row = (t, i) => `<div class="q ref" data-id="${t.id}"><span class="n">${i + 1}</span><span><span class="t">${esc(t.name)}</span><span class="st">${t.kind === 'voice' ? 'Voice' : 'Structure'}${t.description ? ' · ' + esc(t.description) : ''}</span><div class="refBody" hidden>${t.kind === 'voice' ? `<div class="voice">${esc(t.body.replace(/<!--[\s\S]*?-->/g, '').trim())}</div>` : `<pre class="struct">${esc(t.body.replace(/<!--[\s\S]*?-->\n?/g, '').trim())}</pre>`}<div class="row" style="margin: 8px 0 0; gap: 20px;">${t.kind === 'voice' ? '' : `<button class="m link strong insert">Insert into draft</button>`}<button class="m link sec edit">Edit</button><button class="m link sec del">Delete</button></div></div></span></div>`;
    openPanel('References', `<div class="qHead m"><span class="sec">${items.length} saved · click one to open it</span><button class="link sec" id="refPrompt">Copy prompt</button></div>${items.map(row).join('')}
      <form class="qAdd" id="refQuick"><input class="txt" name="name" placeholder="Add a reference — a name or a line you want to keep"><textarea class="txt" name="body" rows="3" placeholder="Paste the passage, structure or link (optional — you can add it later)"></textarea><div class="row" style="margin:0; gap: 20px;"><select name="kind" class="m sec" style="width:auto;"><option value="voice">Voice — something to read</option><option value="structure">Structure — something to insert</option></select><button class="m link strong red" type="submit">Add</button></div></form><div id="refForm"></div>`);
    $('#refPrompt').onclick = async () => {
      const prompt = `I write short, first-person blog posts optimised for answer engines (Google AI Overviews, ChatGPT, Perplexity). Create a reusable Markdown post STRUCTURE (not a finished post) for: [DESCRIBE THE TYPE OF POST].\n\nRules:\n- Use "## " for section headings and "### " for FAQ questions. No H1.\n- Open with a placeholder for a direct answer paragraph of ≤ 50 words, before any heading.\n- Include a "## TL;DR" section with 3 bullet placeholders.\n- Phrase at least two headings as questions people would actually ask.\n- End with a "## FAQ" section containing 2–3 "### Question?" placeholders with short-answer placeholders.\n- Mark every placeholder like {{this}} and put guidance in HTML comments like <!-- this -->.\n- Under 40 lines. No marketing tone.\n\nReturn only the Markdown.`;
      try { await navigator.clipboard.writeText(prompt); toast('Prompt copied.'); } catch { alert(prompt); }
    };
    $$('#panelBody .ref').forEach((c) => {
      const t = items.find((x) => x.id === c.dataset.id);
      c.querySelector('.t').addEventListener('click', () => { const b = c.querySelector('.refBody'); b.hidden = !b.hidden; });
      c.querySelector('.insert')?.addEventListener('click', () => { insertStructure(t); closePanel(); });
      c.querySelector('.edit').addEventListener('click', () => refForm(t));
      c.querySelector('.del').addEventListener('click', async () => { if (!confirm(`Delete “${t.name}”?`)) return; await api(`/api/inspo/${t.id}`, { method: 'DELETE' }); S.inspo = await api('/api/inspo'); renderRail(); renderRefs(); });
    });
    $('#refQuick').addEventListener('submit', async (e) => {
      e.preventDefault(); const f = e.target; const name = f.name.value.trim(); if (!name) return;
      await api('/api/inspo', { method: 'POST', body: { name, body: f.body.value.trim() || name, kind: f.kind.value } });
      S.inspo = await api('/api/inspo'); renderRail(); renderRefs(); toast('Saved to References.');
    });
  }
  function refForm(t) {
    $('#refForm').innerHTML = `<form class="form"><select name="kind"><option value="structure" ${t?.kind !== 'voice' ? 'selected' : ''}>Structure — insertable</option><option value="voice" ${t?.kind === 'voice' ? 'selected' : ''}>Voice — a passage to read</option></select><input name="name" class="txt" placeholder="Name" value="${esc(t?.name || '')}" required><input name="description" class="txt" placeholder="Why it works (optional)" value="${esc(t?.description || '')}"><textarea name="body" class="txt" placeholder="Paste Markdown. Use {{placeholders}} and <!-- notes --> in structures." required>${esc(t?.body || '')}</textarea><div class="row" style="margin:0;"><button class="m link strong red" type="submit">Save</button><button class="m link sec" type="button" id="refCancel">Cancel</button></div></form>`;
    $('#refCancel').onclick = () => ($('#refForm').innerHTML = '');
    $('#refForm form').onsubmit = async (e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target).entries()); await api(t ? `/api/inspo/${t.id}` : '/api/inspo', { method: t ? 'PUT' : 'POST', body: data }); S.inspo = await api('/api/inspo'); renderRail(); renderRefs(); toast('Saved.'); };
    $('#refForm').scrollIntoView({ behavior: 'smooth' });
  }
  function insertStructure(t) {
    if (S.step !== 'write') go('write');
    const body = el.body.value;
    if (body.trim() && !confirm('Append this structure to the end of your draft?')) return;
    const text = t.body.replace(/\{\{date\}\}/g, new Date().toLocaleDateString('en-GB')).replace(/\{\{title\}\}/g, el.title.value);
    setBody(body.trim() ? body.replace(/\s*$/, '') + '\n\n' + text : text);
    el.body.focus(); const ph = el.body.value.indexOf('{{'); if (ph >= 0) el.body.setSelectionRange(ph, el.body.value.indexOf('}}', ph) + 2);
  }

  // ---------- Questions ----------
  $('#btnQuestions').addEventListener('click', async () => { renderQuestions(); try { const r = await api('/api/questions/sync', { method: 'POST' }); if (r.changed) { S.questions = r; S.qNext = null; renderRail(); renderQuestions(); toast(`${r.changed} question${r.changed === 1 ? '' : 's'} ticked from published posts.`); } } catch {} });
  function qPost(q) { return q.postId ? S.posts.find((x) => x.id === q.postId) : null; }
  function qDone(q) { const p = qPost(q); return q.done || (p && p.status === 'published'); }
  function qStatus(q) {
    const p = qPost(q); if (!p) return '';
    return `<span class="st ${p.status === 'published' ? 'live' : ''}">${p.status === 'published' ? 'Answered' : 'In draft'} · ${p.words} words</span>`;
  }
  // Prioritisation: MVP questions first, in their order; then the bank, choosing the bucket furthest behind.
  const isMvp = (q) => q.tier === 'mvp';
  function mvpList() { return S.questions.items.filter(isMvp).sort((a, b) => (a.order || 0) - (b.order || 0) || a.n - b.n); }
  function buckets() {
    const map = new Map();
    for (const q of S.questions.items) { if (isMvp(q)) continue; const b = map.get(q.section) || { section: q.section, items: [] }; b.items.push(q); map.set(q.section, b); }
    return [...map.values()].map((b) => ({ ...b, done: b.items.filter(qDone).length, open: b.items.filter((q) => !qDone(q)) })).sort((a, b) => a.section.localeCompare(b.section));
  }
  function pickNext(skip) {
    const mvpOpen = mvpList().filter((q) => !qDone(q) && q.n !== skip);
    const mvpAll = mvpList();
    if (mvpOpen.length) return { q: mvpOpen[0], why: `MVP · ${mvpAll.filter(qDone).length} of ${mvpAll.length} written · next in order` };
    // even coverage: the bucket with the lowest share written, then a random open question from it
    const open = buckets().filter((b) => b.open.some((q) => q.n !== skip));
    if (!open.length) return null;
    const ratio = (b) => b.done / b.items.length;
    const min = Math.min(...open.map(ratio));
    const behind = open.filter((b) => ratio(b) === min);
    const b = behind[Math.floor(Math.random() * behind.length)];
    const pool = b.open.filter((q) => q.n !== skip);
    const q = pool[Math.floor(Math.random() * pool.length)];
    return { q, why: `From the bank · ${b.section} · ${b.done} of ${b.items.length} written${behind.length < open.length ? ' · furthest behind' : ''}` };
  }
  function renderQuestions() {
    if (!S.questions) return toast('Questions not available.');
    const items = S.questions.items;
    const done = items.filter(qDone).length;
    const mvp = mvpList(), mvpDone = mvp.filter(qDone).length;
    if (!(S.qNext && items.includes(S.qNext.q) && !qDone(S.qNext.q))) S.qNext = pickNext();
    const next = S.qNext;
    let html = `<div class="qHead m"><span class="sec">${done} of ${items.length} answered</span><span><button class="link ${S.qFilter === 'open' ? 'strong' : 'sec'}" data-f="open">Open</button>&nbsp;&nbsp;&nbsp;<button class="link ${S.qFilter === 'all' ? 'strong' : 'sec'}" data-f="all">All</button></span></div>`;
    if (next) {
      html += `<div class="qNext"><div class="m sec">Next to write</div><div class="t" data-next="${next.q.n}">${esc(next.q.text)}</div><div class="m sec why">${esc(next.why)}</div><div class="row" style="margin:12px 0 0;"><button class="m link strong red" data-act="write">Write this →</button><button class="m link sec" data-act="another">Another</button></div></div>`;
    }
    const row = (q, label, ctl) => `<div class="q ${qDone(q) ? 'done' : ''} ${qPost(q) && !qDone(q) ? 'draft' : ''}" data-n="${q.n}"><input type="checkbox" ${qDone(q) ? 'checked' : ''} title="Mark answered"><span class="n">${label}</span><span><span class="t" title="Open this one">${esc(q.text)}</span>${qStatus(q)}</span>${ctl}</div>`;
    // MVP, in order
    const mvpShown = S.qFilter === 'open' ? mvp.filter((q) => !qDone(q)) : mvp;
    html += `<div class="qSec">MVP <span class="m sec" style="float:right;">${mvpDone} of ${mvp.length}</span></div><div class="m sec qSub">In the order you'll write them. Use the arrows to reprioritise.</div>`;
    mvpShown.forEach((q, i) => { html += row(q, q.order || i + 1, `<span class="ctl"><button class="link" data-mv="-1" title="Earlier">↑</button><button class="link" data-mv="1" title="Later">↓</button><button class="link sec" data-tier="bank" title="Move to the bank">×</button></span>`); });
    if (!mvpShown.length) html += `<p class="m sec" style="margin-top:12px;">All MVP questions written.</p>`;
    // the wider bank, by bucket
    for (const b of buckets()) {
      const shown = S.qFilter === 'open' ? b.open : b.items;
      if (!shown.length) continue;
      html += `<div class="qSec">${esc(b.section)} <span class="m sec" style="float:right;">${b.done} of ${b.items.length}</span></div>`;
      for (const q of shown) html += row(q, q.n, `<span class="ctl"><button class="link sec" data-tier="mvp" title="Add to MVP">MVP</button></span>`);
    }
    html += `<form class="qAdd"><input class="txt" name="text" placeholder="Add a question to the bank"><div class="row" style="margin:0;"><button class="m link strong red" type="submit">Add</button></div></form>`;
    html += `<div class="qGoal"><div class="m sec" style="margin-bottom:8px;">What answering these should reveal</div>${(S.questions.goal || []).map((g) => `<p>${esc(g)}</p>`).join('')}</div>`;
    openPanel('Questions', html);
    $$('#panelBody [data-f]').forEach((b) => b.addEventListener('click', () => { S.qFilter = b.dataset.f; renderQuestions(); }));
    if (next) {
      $('#panelBody [data-act="write"]').addEventListener('click', () => startQuestion(next.q));
      $('#panelBody .qNext .t').addEventListener('click', () => startQuestion(next.q));
      $('#panelBody [data-act="another"]').addEventListener('click', () => { S.qNext = pickNext(next.q.n) || S.qNext; renderQuestions(); });
    }
    const reorder = async (list) => { S.questions = await api('/api/questions/reorder', { method: 'POST', body: { ns: list.map((q) => q.n) } }); S.qNext = null; renderRail(); renderQuestions(); };
    $$('#panelBody .q').forEach((rowEl) => {
      const q = items.find((x) => x.n === Number(rowEl.dataset.n));
      rowEl.querySelector('input').addEventListener('change', async (e) => { q.done = e.target.checked; rowEl.classList.toggle('done', q.done); S.qNext = null; renderRail(); await api(`/api/questions/${q.n}`, { method: 'PUT', body: { done: q.done } }); });
      rowEl.querySelector('.t').addEventListener('click', () => startQuestion(q));
      rowEl.querySelectorAll('[data-mv]').forEach((b) => b.addEventListener('click', () => { const list = mvpList(); const i = list.indexOf(q), j = i + Number(b.dataset.mv); if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; reorder(list); }));
      rowEl.querySelectorAll('[data-tier]').forEach((b) => b.addEventListener('click', () => { const list = mvpList().filter((x) => x !== q); if (b.dataset.tier === 'mvp') list.push(q); reorder(list); }));
    });
    $('#panelBody .qAdd').addEventListener('submit', async (e) => { e.preventDefault(); const text = e.target.text.value.trim(); if (!text) return; const item = await api('/api/questions', { method: 'POST', body: { text } }); S.questions.items.push(item); renderRail(); renderQuestions(); toast('Added.'); });
  }
  async function startQuestion(q) {
    closePanel();
    // if this question already has a post, open it; otherwise use the current empty page or start a new one
    if (q.postId && S.posts.some((p) => p.id === q.postId)) { await openPost(q.postId); go('write'); return; }
    if (el.title.value.trim() || el.body.value.trim()) await newPost();
    el.title.value = q.text; markDirty(); await flushSave();
    q.postId = S.post.id; await api(`/api/questions/${q.n}`, { method: 'PUT', body: { postId: S.post.id } });
    go('write'); setTimeout(() => el.body.focus(), 80);
  }

  // ---------- Prompt ----------
  const PROMPT = [
    ['Thing', 'What am I actually doing? What is happening?'],
    ['Problem', 'Why does this need doing?'],
    ['Place', 'What specific moment best demonstrates that problem?'],
    ['Uncomfortable thought', 'What might be true here that I haven’t fully admitted?'],
    ['Plot', 'What will physically happen?'],
    ['Story', 'What belief, question or understanding could change?'],
    ['Story question', 'What don’t I know at the beginning?'],
    ['Attempt', 'What am I going to try?'],
    ['Complication', 'What could make this harder or prove my assumption wrong?'],
    ['Test', 'How will we know whether it worked?'],
    ['Open', 'Scene → tension → thought → context → question.'],
  ];
  const LENS = [
    ['Problem underneath the thing', 'Why am I doing this now? What isn’t working?', 'Business cards → I don’t like how my current work presents me → my work has changed but my identity hasn’t caught up. “I think I’ve outgrown the way I present myself.” The most reliable method: the activity is usually evidence of a bigger problem.'],
    ['Contradiction / uncomfortable thought', 'I’m starting to realise… · I’ve always told myself X, but… · I thought X would help, but… · I hate admitting that… · The weird thing is… · I know this shouldn’t matter, but…', '“I spend my career telling companies not to obsess over cosmetic branding, and I’ve spent three days choosing the colour of a business card.” The activity barely changed. The angle changed.'],
    ['Place', 'Where can I physically see the problem happening? Person, Location, Action, Cost, Era.', 'Not “I’m trying to work out how to present myself” but you, on the office floor, comparing fourteen almost-identical reds; hours and wasted prints; this particular moment of rebuilding your work. The scene reveals the story without announcing it.'],
    ['The constraint', 'What makes this harder than it normally would be?', 'Thing: make something. Constraint: the baby could sleep for 8 minutes or 2 hours. Story: can I make something good with no control over the time? Constraints create events.'],
    ['The experiment', 'Turn it into a question you genuinely don’t know the answer to.', 'Can I redesign this in one afternoon? Can I make something during one nap? Can I actually follow the advice I give clients? Attempt → evidence → answer. Useful when there isn’t much emotional story underneath.'],
    ['Change', 'What is different now from before?', 'I used to believe X, now Y. I used to do X, now I’m trying Y. This used to work; it doesn’t any more. I wanted X, and now that I have it, it feels different. A before/after without forcing a transformation.'],
    ['Behaviour as evidence', 'What oddly specific thing do I keep doing, and what does it reveal?', 'I’ve printed this same red nine times. I keep moving this desk six inches to the left. Every time the baby goes down I open my laptop. Start with observable life, not a thesis.'],
  ];
  $('#btnPrompt').addEventListener('click', () => {
    openPanel('Prompt', `<div class="qHead m"><span class="sec">Answer these before you write. Insert puts them in the draft as notes that never publish.</span></div>
      ${PROMPT.map(([k, q], i) => `<div class="q prompt"><span class="n">${i + 1}</span><span><span class="t" style="cursor: default;">${esc(k)}</span><span class="st">${esc(q)}</span></span></div>`).join('')}
      <div class="row" style="margin-top: 24px; gap: 20px;"><button class="m link strong red" id="promptInsert">Insert into draft</button></div>
      <div class="qSec">Story lens</div>
      <div class="m sec qSub">Start with something boring — “I’m redesigning my business cards” — and run it through a method. Click one to see the example.</div>
      ${LENS.map(([k, q, ex], i) => `<div class="q prompt lens"><span class="n">${i + 1}</span><span><span class="t">${esc(k)}</span><span class="st">${esc(q)}</span><div class="refBody" hidden><div class="voice" style="font-style: normal;">${esc(ex)}</div></div></span></div>`).join('')}`);
    $$('#panelBody .lens .t').forEach((t) => { t.style.cursor = 'pointer'; t.addEventListener('click', () => { const b = t.parentElement.querySelector('.refBody'); b.hidden = !b.hidden; }); });
    $('#promptInsert').onclick = () => {
      const block = PROMPT.map(([k, q]) => `<!-- ${k.toUpperCase()}: ${q} -->\n`).join('\n');
      const body = el.body.value;
      el.body.value = body.trim() ? body.replace(/\s*$/, '') + '\n\n' + block : block + '\n';
      markDirty(); updateCounts(); closePanel(); if (S.step !== 'write') go('write'); el.body.focus();
      toast('Prompt added as notes — they are stripped on publish.');
    };
  });

  $('#btnSettings').addEventListener('click', () => {
    const s = S.settings;
    const f = (k, label, v = s[k] ?? '', tag = 'input') => `<label class="field"><span class="m sec">${label}</span>${tag === 'textarea' ? `<textarea name="${k}" class="txt" rows="3">${esc(Array.isArray(v) ? v.join('\n') : v)}</textarea>` : `<input name="${k}" class="txt" value="${esc(v)}">`}</label>`;
    openPanel('Settings', `<form class="form" style="border:0;margin:0;padding:0;">${f('authorName', 'Your name')}${f('authorBio', 'Bio — used in the author schema', s.authorBio, 'textarea')}${f('authorUrl', 'Author URL')}${f('sameAs', 'Profile links, one per line', s.sameAs, 'textarea')}${f('siteName', 'Site name')}${f('blogTitle', 'Blog title')}${f('blogTagline', 'Blog tagline')}${f('minWords', 'Target word count')}<div class="row" style="margin:8px 0 0;"><button class="m link strong red" type="submit">Save</button><a class="m link sec" href="/api/export" target="_blank">Export everything</a></div><p class="m sec">Suggestions: ${S.env.hasAi ? 'on' : 'off'} · IndexNow: ${S.env.hasIndexNow ? 'on' : 'off'}</p></form>`);
    $('#panelBody form').onsubmit = async (e) => { e.preventDefault(); S.settings = await api('/api/settings', { method: 'PUT', body: Object.fromEntries(new FormData(e.target).entries()) }); $('#masthead').textContent = S.settings.authorName || S.settings.siteName; toast('Settings saved.'); closePanel(); };
  });

  // ---------- Mobile menu (the rail as a sheet) ----------
  $('#menuBtn').addEventListener('click', () => document.body.classList.toggle('menuOpen'));
  $$('.rail button').forEach((b) => b.addEventListener('click', () => document.body.classList.remove('menuOpen')));

  // Bridge for stories.js
  window.__app = { $, $$, api, esc, toast, go, openPost, newPost, startQuestion, setBody, el, renderRail, openPanel, closePanel, flushSave, markDirty, updateCounts, snapToGrid, qDone, S };
  boot().catch((e) => { console.error(e); showLogin(); });
})();
