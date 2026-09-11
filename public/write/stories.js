/* The private Story Bank. Everything here is behind the login; nothing is ever published. */
(() => {
  const A = window.__app; const { $, $$, api, esc, toast, S } = A;
  const ST = { data: null, filter: 'all', open: null, talk: { messages: [], busy: false }, ingest: null, showThin: false };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const items = () => (ST.data?.items || []).filter((s) => !s.dismissed);
  const byId = (id) => ST.data?.items.find((s) => s.id === id);
  const fields = () => ST.data.fields;
  const CORE = ['happening', 'role', 'difficulty', 'did', 'outcome', 'thoughtThen', 'thinkNow'];
  const missing = (s) => CORE.filter((k) => !(s[k] || '').trim());
  const needs = (s) => s.kind === 'lead' || missing(s).length > 0;
  const tName = (id) => ST.data.territories.find((t) => t.id === id)?.name || id;
  const qText = (n) => S.questions?.items.find((q) => q.n === n)?.text || `Question ${n}`;
  const PRIV = { private: 'Private only', anonymise: 'Anonymise', usable: 'Usable' };
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  async function load() {
    ST.data = await api('/api/stories');
    const n = items().length, thin = items().filter(needs).length;
    $('#storyCount').textContent = `${n} · ${thin} need detail`;
  }

  // ---------- Opening the view ----------
  async function open(storyId) {
    await A.flushSave();
    if (!ST.data) await load();
    S.inStories = true; document.body.classList.add('inStories'); document.body.classList.remove('menuOpen');
    $$('#steps button').forEach((b) => b.classList.remove('active'));
    $$('.view').forEach((v) => (v.hidden = v.id !== 'view-stories'));
    $('#folio').hidden = true; $('#btnNext').hidden = true;
    if (storyId) ST.open = storyId;
    renderList(); renderPane(); window.scrollTo(0, 0);
  }
  $('#btnStories').addEventListener('click', () => open());

  // ---------- Dashboard prompts ----------
  function prompts() {
    const out = [];
    const mvp = (S.questions?.items || []).filter((q) => q.tier === 'mvp');
    const noEvidence = mvp.filter((q) => !items().some((s) => (s.relatedQuestions || []).includes(q.n)));
    if (noEvidence.length) out.push({ text: `${noEvidence.length} MVP question${noEvidence.length === 1 ? ' has' : 's have'} no linked lived evidence.`, act: 'thin' });
    const leads = items().filter((s) => s.kind === 'lead').length; if (leads) out.push({ text: `${leads} story lead${leads === 1 ? '' : 's'} need more detail.`, act: 'leads' });
    const q = S.post && S.questions?.items.find((x) => x.postId === S.post.id);
    const m = q && ST.data.matches?.[q.n];
    if (m?.items?.length) out.push({ text: `${m.items.length} stor${m.items.length === 1 ? 'y appears' : 'ies appear'} relevant to the question you’re developing.`, act: 'current' });
    const counts = ST.data.summary.territories || {};
    const big = Object.entries(counts).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1])[0];
    if (big) out.push({ text: `Several stories involve ${tName(big[0]).toLowerCase()}. Explore the recurring pattern?`, act: 'pattern', t: big[0] });
    (ST.data.patterns?.contradictions || []).slice(0, 2).forEach((c) => out.push({ text: `Contradiction: ${c.text}`, act: 'ids', ids: c.ids }));
    return out;
  }

  // ---------- List ----------
  const FILTERS = [['all', 'All'], ['needs', 'Needs detail'], ['leads', 'Leads'], ['unlinked', 'Unlinked'], ['linked', 'Linked'], ['private', 'Private only'], ['anonymise', 'Anonymise'], ['usable', 'Usable'], ['recent', 'Recent']];
  function filtered() {
    let list = items();
    const f = ST.filter;
    if (f === 'needs') list = list.filter(needs);
    else if (f === 'leads') list = list.filter((s) => s.kind === 'lead');
    else if (f === 'unlinked') list = list.filter((s) => !(s.relatedQuestions || []).length);
    else if (f === 'linked') list = list.filter((s) => (s.relatedQuestions || []).length);
    else if (['private', 'anonymise', 'usable'].includes(f)) list = list.filter((s) => s.privacy === f);
    else if (f === 'recent') list = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);
    else if (f === 'current') { const q = S.post && S.questions?.items.find((x) => x.postId === S.post.id); const ids = (q && ST.data.matches?.[q.n]?.items || []).map((x) => x.id); list = list.filter((s) => ids.includes(s.id)); }
    else if (f.startsWith('ids:')) { const ids = f.slice(4).split(','); list = list.filter((s) => ids.includes(s.id)); }
    else if (f.startsWith('t:')) list = list.filter((s) => (s.territories || []).includes(f.slice(2)));
    return list;
  }
  function renderList() {
    const list = filtered(), sum = ST.data.summary;
    const counts = { all: items().length, needs: sum.needsDetail, leads: sum.leads, unlinked: sum.unlinked, linked: sum.linked, private: sum.private, anonymise: sum.anonymise, usable: sum.usable };
    let html = `<div class="sHead"><div class="title read sTitle">Story Bank</div><div class="m sec">Private. Nothing here is published, listed, fed or indexed.</div></div>`;
    html += `<div class="sActions"><button class="m link strong red" data-act="new">+ New story</button><button class="m link strong" data-act="lead">+ Lead</button><button class="m link strong" data-act="talk">Talk</button><button class="m link strong" data-act="ingest">Add source document</button><button class="m link sec" data-act="patterns">Find patterns</button></div>`;
    const ps = prompts();
    if (ps.length) html += `<div class="sPrompts">${ps.map((p, i) => `<button class="link" data-p="${i}">${esc(p.text)}</button>`).join('')}</div>`;
    if (ST.showThin) { const mvp = (S.questions?.items || []).filter((q) => q.tier === 'mvp' && !items().some((s) => (s.relatedQuestions || []).includes(q.n))); html += `<div class="sThin">${mvp.map((q) => `<div class="q"><span class="n">${q.n}</span><span class="t" data-q="${q.n}">${esc(q.text)}</span></div>`).join('')}</div>`; }
    html += `<div class="sFilters m">${FILTERS.map(([k, l]) => `<button class="link ${ST.filter === k ? 'strong' : 'sec'}" data-f="${k}">${l}${counts[k] !== undefined ? ` <span class="sec">${counts[k]}</span>` : ''}</button>`).join('')}${ST.filter.startsWith('t:') || ST.filter === 'current' || ST.filter.startsWith('ids:') ? `<button class="link strong" data-f="${ST.filter}">${ST.filter === 'current' ? 'Relevant now' : ST.filter.startsWith('t:') ? esc(tName(ST.filter.slice(2))) : 'Selection'}</button>` : ''}</div>`;
    html += list.map((s) => `<div class="story ${ST.open === s.id ? 'open' : ''} ${s.kind === 'lead' ? 'lead' : ''}" data-id="${s.id}"><span class="sid">${s.id}</span><span><span class="t">${esc(s.title)}</span><span class="st">${s.kind === 'lead' ? 'Lead · ' : needs(s) ? 'Needs detail · ' : ''}${PRIV[s.privacy]}${(s.relatedQuestions || []).length ? ` · ${s.relatedQuestions.length} question${s.relatedQuestions.length === 1 ? '' : 's'}` : ' · unlinked'}${(s.territories || []).length ? ` · ${s.territories.join(' ')}` : ''}</span></span></div>`).join('');
    if (!list.length) html += `<p class="m sec" style="margin-top:24px;">Nothing here.</p>`;
    if (ST.data.note && ST.filter === 'all') html += `<p class="sNote">${esc(ST.data.note)}</p>`;
    $('#storyList').innerHTML = html;
    $$('#storyList [data-f]').forEach((b) => b.addEventListener('click', () => { ST.filter = b.dataset.f; renderList(); }));
    $$('#storyList .story').forEach((r) => r.addEventListener('click', () => { ST.open = r.dataset.id; ST.mode = 'edit'; renderList(); renderPane(); scrollPane(); }));
    $$('#storyList [data-q]').forEach((b) => b.addEventListener('click', () => { ST.mode = 'talk'; ST.open = null; ST.talk = { messages: [], busy: false, questionN: Number(b.dataset.q) }; renderPane(); scrollPane(); }));
    $$('#storyList [data-act]').forEach((b) => b.addEventListener('click', () => action(b.dataset.act)));
    $$('#storyList [data-p]').forEach((b) => b.addEventListener('click', () => {
      const p = ps[Number(b.dataset.p)];
      if (p.act === 'thin') { ST.showThin = !ST.showThin; renderList(); }
      else if (p.act === 'leads') { ST.filter = 'leads'; renderList(); }
      else if (p.act === 'current') { ST.filter = 'current'; renderList(); }
      else if (p.act === 'ids') { ST.filter = 'ids:' + p.ids.join(','); renderList(); }
      else if (p.act === 'pattern') { ST.filter = 't:' + p.t; renderList(); ST.open = null; ST.mode = 'talk'; ST.talk = { messages: [], busy: false, opener: `Several of my stories involve ${tName(p.t).toLowerCase()}. Let’s explore the recurring pattern across them.` }; renderPane(); }
    }));
  }
  function scrollPane() { if (window.innerWidth <= 1100) $('#storyPane').scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  // Slow jobs run in the background on Netlify; we poll for the result.
  async function runJob(name, body, label) {
    const started = Date.now();
    await api(`/api/story-jobs/${name}`, { method: 'POST', body });
    toast(`${label}… this can take a minute.`, 4000);
    for (let i = 0; i < 100; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const jobs = await api('/api/stories/jobs');
      const j = jobs[name];
      if (j && Date.parse(j.at) >= started - 5000 && j.status === 'done') return j.result;
      if (j && Date.parse(j.at) >= started - 5000 && j.status === 'error') throw new Error(j.error || 'Job failed');
    }
    throw new Error('Still running — try again in a minute.');
  }
  async function action(act) {
    if (act === 'new' || act === 'lead') { const s = await api('/api/stories', { method: 'POST', body: { title: act === 'lead' ? 'New lead' : 'New story', kind: act === 'lead' ? 'lead' : 'story' } }); await load(); ST.open = s.id; ST.mode = 'edit'; renderList(); renderPane(); scrollPane(); setTimeout(() => $('#storyPane [data-k="title"]')?.select(), 60); }
    if (act === 'talk') { ST.open = null; ST.mode = 'talk'; ST.talk = { messages: [], busy: false }; renderPane(); scrollPane(); }
    if (act === 'ingest') { ST.open = null; ST.mode = 'ingest'; renderPane(); scrollPane(); }
    if (act === 'patterns') { ST.open = null; ST.mode = 'patterns'; ST.patternsBusy = true; renderPane(); try { ST.data.patterns = await runJob('patterns', { goal: S.questions?.goal || [] }, 'Reading the bank'); } catch (e) { toast(e.message, 6000); } ST.patternsBusy = false; renderList(); renderPane(); }
  }

  // ---------- Pane: editor / talk / ingest / patterns ----------
  function renderPane() {
    const pane = $('#storyPane');
    if (ST.mode === 'talk' && !ST.open) return renderTalk(pane, null);
    if (ST.mode === 'ingest') return renderIngest(pane);
    if (ST.mode === 'patterns') return renderPatterns(pane);
    const s = ST.open && byId(ST.open);
    if (!s) { pane.innerHTML = `<div class="m sec">Open a story, or start with <button class="link strong" data-act="talk">Talk</button>.</div><div class="sWhy"><p>The public site asks: <b>what do I think?</b></p><p>This bank asks: <b>what have I actually seen, done, felt, decided, got wrong or changed my mind about that might help me answer it?</b></p><p>Stories stay separate from the answers. A story can inform public writing, but what is used from it is your decision every time.</p></div>`; pane.querySelector('[data-act]').onclick = () => action('talk'); return; }
    renderEditor(pane, s);
  }

  function renderEditor(pane, s) {
    const miss = missing(s);
    let html = `<div class="sPaneHead"><span class="m sec">${s.id} · ${s.kind === 'lead' ? 'Lead' : 'Story'} · added ${fmtDate(s.createdAt)}</span><button class="link sec m" data-act="back">← All stories</button></div>`;
    html += `<textarea class="sTitleIn" data-k="title" rows="1" placeholder="Working title">${esc(s.title)}</textarea>`;
    html += `<div class="sMeta m"><span>Privacy</span>${['private', 'anonymise', 'usable'].map((p) => `<button class="link ${s.privacy === p ? 'strong red' : 'sec'}" data-priv="${p}">${PRIV[p]}</button>`).join('')}<span class="gap"></span><span>Kind</span><button class="link ${s.kind === 'story' ? 'strong' : 'sec'}" data-kind="story">Story</button><button class="link ${s.kind === 'lead' ? 'strong' : 'sec'}" data-kind="lead">Lead</button></div>`;
    html += `<div class="sMeta m"><span>Territories</span><span class="chips">${ST.data.territories.map((t) => `<button class="chip ${(s.territories || []).includes(t.id) ? 'on' : ''}" data-t="${t.id}" title="${esc(t.name)}">${t.id}</button>`).join('')}</span></div>`;
    if (s.kind === 'lead' || miss.length) html += `<div class="sMissing m sec">${s.kind === 'lead' ? 'A lead: keep it until it is developed or dismissed. ' : ''}${miss.length ? `Still missing: ${miss.map((k) => fields().find((f) => f.key === k).label).join(' · ')}.` : ''}</div>`;
    if ((s.followups || []).length) html += `<div class="sBlock"><div class="m">Follow-up questions</div>${s.followups.map((f, i) => `<div class="fu"><span>${esc(f)}</span><button class="link sec" data-fu="${i}" title="Remove">×</button></div>`).join('')}<button class="m link strong" data-act="talkStory">Answer these in Talk →</button></div>`;
    html += `<div class="sFields">${fields().map((f) => `<label class="sField ${f.short ? 'short' : ''} ${CORE.includes(f.key) && !(s[f.key] || '').trim() ? 'empty' : ''}"><span class="m">${esc(f.label)}</span><textarea class="txt" data-k="${f.key}" rows="1" placeholder="${f.key === 'title' ? '' : '—'}">${esc(s[f.key] || '')}</textarea></label>`).filter((h, i) => fields()[i].key !== 'title').join('')}</div>`;
    if (s.sourceRef) html += `<div class="m sec" style="margin-top:12px;">Source: ${esc(s.sourceRef)}</div>`;
    // questions
    html += `<div class="sBlock"><div class="qHead m"><span>Related questions</span><button class="link sec" data-act="suggestQ">${S.env.hasAi ? 'Suggest questions' : ''}</button></div>`;
    html += (s.relatedQuestions || []).length ? s.relatedQuestions.map((n) => `<div class="q lnk"><span class="n">${n}</span><span><span class="t" data-openq="${n}">${esc(qText(n))}</span></span><button class="link sec" data-unlink="${n}" title="Unlink">×</button></div>`).join('') : `<div class="m sec">None linked yet.</div>`;
    html += `<div class="row" style="margin:8px 0 0;"><select class="m sec" data-linksel><option value="">Link a question…</option>${(S.questions?.items || []).filter((q) => !(s.relatedQuestions || []).includes(q.n)).map((q) => `<option value="${q.n}">${q.n} · ${esc(q.text.slice(0, 90))}</option>`).join('')}</select></div></div>`;
    if ((s.possibleQuestions || []).length) html += `<div class="sBlock"><div class="m">Possible questions</div>${s.possibleQuestions.map((p, i) => `<div class="q lnk"><span class="n">${p.n}</span><span><span class="t">${esc(qText(p.n))}</span><span class="st">${esc(p.why)}</span><span class="row" style="margin:4px 0 0; gap:16px;"><button class="m link strong red" data-linkp="${i}">Link</button><button class="m link sec" data-dropp="${i}">Dismiss</button></span></span></div>`).join('')}</div>`;
    if ((s.newQuestions || []).length) html += `<div class="sBlock"><div class="m">Candidate new questions</div><div class="m sec" style="margin-bottom:8px;">Not in the bank. Your call.</div>${s.newQuestions.map((p, i) => `<div class="q lnk"><span class="n">?</span><span><span class="t">${esc(p.text)}</span>${p.why ? `<span class="st">${esc(p.why)}</span>` : ''}<span class="row" style="margin:4px 0 0; gap:16px;"><button class="m link strong red" data-addq="${i}">Add to question bank</button><button class="m link sec" data-dropn="${i}">Dismiss</button></span></span></div>`).join('')}</div>`;
    html += `<div class="sBlock"><div class="qHead m"><span>Talk about this story</span></div><div id="talkBox"></div></div>`;
    html += `<div class="row" style="margin-top:32px; gap:24px;"><button class="m link sec" data-act="dismiss">${s.dismissed ? 'Restore' : 'Dismiss'}</button><button class="m link sec" data-act="delete">Delete</button></div>`;
    pane.innerHTML = html;
    renderTalk($('#talkBox'), s);
    // wiring
    pane.querySelector('[data-act="back"]').onclick = () => { ST.open = null; ST.mode = null; renderList(); renderPane(); window.scrollTo(0, 0); };
    const save = debounce(async (patch) => { Object.assign(s, patch); try { const r = await api(`/api/stories/${s.id}`, { method: 'PUT', body: patch }); Object.assign(s, r); refreshSummary(); } catch (e) { toast(e.message, 4000); } }, 800);
    $$('[data-k]', pane).forEach((ta) => { grow(ta); ta.addEventListener('input', () => { grow(ta); const v = ta.dataset.k === 'title' ? ta.value.replace(/\n/g, ' ') : ta.value; s[ta.dataset.k] = v; save({ [ta.dataset.k]: v }); if (ta.dataset.k === 'title') { const row = $(`#storyList .story[data-id="${s.id}"] .t`); if (row) row.textContent = v; } }); });
    $$('[data-priv]', pane).forEach((b) => b.onclick = () => { s.privacy = b.dataset.priv; api(`/api/stories/${s.id}`, { method: 'PUT', body: { privacy: s.privacy } }).then(refreshSummary); renderEditor(pane, s); });
    $$('[data-kind]', pane).forEach((b) => b.onclick = () => { s.kind = b.dataset.kind; api(`/api/stories/${s.id}`, { method: 'PUT', body: { kind: s.kind } }).then(refreshSummary); renderEditor(pane, s); });
    $$('[data-t]', pane).forEach((b) => b.onclick = () => { const t = b.dataset.t; s.territories = (s.territories || []).includes(t) ? s.territories.filter((x) => x !== t) : [...(s.territories || []), t].sort(); api(`/api/stories/${s.id}`, { method: 'PUT', body: { territories: s.territories } }).then(refreshSummary); renderEditor(pane, s); });
    $$('[data-fu]', pane).forEach((b) => b.onclick = () => { s.followups.splice(Number(b.dataset.fu), 1); api(`/api/stories/${s.id}`, { method: 'PUT', body: { followups: s.followups } }); renderEditor(pane, s); });
    const talkStory = pane.querySelector('[data-act="talkStory"]'); if (talkStory) talkStory.onclick = () => { $('#talkBox').scrollIntoView({ behavior: 'smooth' }); $('#talkBox textarea')?.focus(); };
    $$('[data-openq]', pane).forEach((b) => b.onclick = async () => { const q = S.questions.items.find((x) => x.n === Number(b.dataset.openq)); if (q) { $('#btnNext').hidden = false; await A.startQuestion(q); } });
    $$('[data-unlink]', pane).forEach((b) => b.onclick = () => link(s, Number(b.dataset.unlink), false));
    pane.querySelector('[data-linksel]').onchange = (e) => { if (e.target.value) link(s, Number(e.target.value), true); };
    $$('[data-linkp]', pane).forEach((b) => b.onclick = () => { const p = s.possibleQuestions[Number(b.dataset.linkp)]; s.possibleQuestions.splice(Number(b.dataset.linkp), 1); link(s, p.n, true, { possibleQuestions: s.possibleQuestions }); });
    $$('[data-dropp]', pane).forEach((b) => b.onclick = () => { s.possibleQuestions.splice(Number(b.dataset.dropp), 1); api(`/api/stories/${s.id}`, { method: 'PUT', body: { possibleQuestions: s.possibleQuestions } }); renderEditor(pane, s); });
    $$('[data-dropn]', pane).forEach((b) => b.onclick = () => { s.newQuestions.splice(Number(b.dataset.dropn), 1); api(`/api/stories/${s.id}`, { method: 'PUT', body: { newQuestions: s.newQuestions } }); renderEditor(pane, s); });
    $$('[data-addq]', pane).forEach((b) => b.onclick = async () => { const p = s.newQuestions[Number(b.dataset.addq)]; const item = await api('/api/questions', { method: 'POST', body: { text: p.text, section: 'Added' } }); S.questions.items.push(item); A.renderRail(); s.newQuestions.splice(Number(b.dataset.addq), 1); link(s, item.n, true, { newQuestions: s.newQuestions }); toast(`Added as question ${item.n}.`); });
    const sq = pane.querySelector('[data-act="suggestQ"]'); if (sq) sq.onclick = async () => { sq.textContent = 'Thinking…'; try { const r = await api('/api/story-ai/questions', { method: 'POST', body: { id: s.id } }); Object.assign(s, r); renderEditor(pane, s); if (!r.possibleQuestions.length && !r.newQuestions.length) toast('No new matches.'); } catch (e) { toast(e.message, 5000); sq.textContent = 'Suggest questions'; } };
    pane.querySelector('[data-act="dismiss"]').onclick = async () => { s.dismissed = !s.dismissed; await api(`/api/stories/${s.id}`, { method: 'PUT', body: { dismissed: s.dismissed } }); await load(); ST.open = null; renderList(); renderPane(); };
    pane.querySelector('[data-act="delete"]').onclick = async () => { if (!confirm(`Delete ${s.id} permanently?`)) return; await api(`/api/stories/${s.id}`, { method: 'DELETE' }); await load(); ST.open = null; renderList(); renderPane(); };
  }
  function grow(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(ta.scrollHeight, 24) + 'px'; }
  async function link(s, n, on, extra = {}) {
    s.relatedQuestions = on ? [...new Set([...(s.relatedQuestions || []), n])].sort((a, b) => a - b) : (s.relatedQuestions || []).filter((x) => x !== n);
    await api(`/api/stories/${s.id}`, { method: 'PUT', body: { relatedQuestions: s.relatedQuestions, ...extra } });
    refreshSummary(); renderEditor($('#storyPane'), s);
  }
  async function refreshSummary() { const cur = ST.open; await load(); ST.open = cur; renderList(); }

  // ---------- Talk ----------
  function renderTalk(box, s) {
    const T = ST.talk;
    const q = T.questionN ? S.questions.items.find((x) => x.n === T.questionN) : (S.post && S.questions?.items.find((x) => x.postId === S.post.id));
    let html = '';
    if (!s) html += `<div class="sPaneHead"><span class="m sec">Talk · an interview, one question at a time</span><button class="link sec m" data-act="back">Close</button></div><div class="m sec" style="margin-bottom:16px;">${q ? `Steering towards: ${esc(q.text)}` : 'It will choose the territory with the biggest gap. Answer in your own words; what you say is captured into a story you can edit.'}</div>`;
    html += `<div class="talk">${T.messages.map((m) => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('')}${T.busy ? '<div class="msg assistant sec">…</div>' : ''}</div>`;
    if (T.captured?.length) html += `<div class="m sec" style="margin:8px 0;">Captured into: ${T.captured.map(esc).join(', ')}. Edit above if it isn’t quite your words.</div>`;
    if (T.newStoryTitle) html += `<div class="row" style="margin:8px 0 0;"><button class="m link strong red" data-act="newFromTalk">Start a separate story: “${esc(T.newStoryTitle)}”</button></div>`;
    html += `<form class="talkForm">${T.messages.length ? '' : `<button type="button" class="m link strong red" data-act="start">${S.env.hasAi ? 'Start' : 'Suggestions are off — add an Anthropic key in Netlify'}</button>`}<textarea class="txt" rows="3" placeholder="${T.messages.length ? 'Your answer…' : 'Or type where you want to start…'}"></textarea><div class="row" style="margin:6px 0 0; gap:20px;"><button class="m link strong" type="submit">Send</button>${s ? '' : `<span class="m sec">Saves into ${T.storyId ? T.storyId : 'a new story'}</span>`}</div></form>`;
    box.innerHTML = html;
    const back = box.querySelector('[data-act="back"]'); if (back) back.onclick = () => { ST.mode = null; renderPane(); };
    const start = box.querySelector('[data-act="start"]'); if (start) start.onclick = () => turn(box, s, T.opener || '');
    const nf = box.querySelector('[data-act="newFromTalk"]'); if (nf) nf.onclick = async () => { const ns = await api('/api/stories', { method: 'POST', body: { title: T.newStoryTitle, kind: 'lead' } }); await load(); T.newStoryTitle = null; T.storyId = ns.id; ST.open = ns.id; ST.mode = 'edit'; renderList(); renderPane(); };
    const form = box.querySelector('form'); form.onsubmit = (e) => { e.preventDefault(); const v = form.querySelector('textarea').value.trim(); if (v) turn(box, s, v); };
    form.querySelector('textarea').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) form.requestSubmit(); });
    if (T.messages.length) box.querySelector('.talk').scrollTop = 1e6;
  }
  async function turn(box, s, text) {
    const T = ST.talk; if (T.busy) return;
    if (text) T.messages.push({ role: 'user', content: text });
    T.busy = true; T.captured = null; renderTalk(box, s);
    const q = T.questionN || (S.post && S.questions?.items.find((x) => x.postId === S.post.id)?.n);
    try {
      let story = s || (T.storyId && byId(T.storyId));
      const r = await api('/api/story-ai/talk', { method: 'POST', body: { storyId: story?.id, questionN: q, messages: T.messages } });
      T.messages.push({ role: 'assistant', content: r.say });
      if ((r.updates || []).length) {
        if (!story) { story = await api('/api/stories', { method: 'POST', body: { title: r.newStoryTitle || 'From Talk', kind: 'lead', territories: r.territory ? [r.territory] : [] } }); T.storyId = story.id; await load(); story = byId(story.id); r.newStoryTitle = null; }
        const patch = {};
        for (const u of r.updates) { const cur = (story[u.field] || '').trim(); story[u.field] = cur ? `${cur}\n\n${u.text}` : u.text; patch[u.field] = story[u.field]; }
        if ((r.followups || []).length) { story.followups = r.followups; patch.followups = r.followups; }
        if (r.territory && !(story.territories || []).includes(r.territory)) { story.territories = [...(story.territories || []), r.territory]; patch.territories = story.territories; }
        patch.transcriptAppend = T.messages.slice(-2);
        await api(`/api/stories/${story.id}`, { method: 'PUT', body: patch });
        T.captured = r.updates.map((u) => fields().find((f) => f.key === u.field)?.label || u.field);
        if (s) { renderEditor($('#storyPane'), s); ST.talk = T; renderTalk($('#talkBox'), s); refreshSummary(); return; }
      }
      if (r.newStoryTitle && story) T.newStoryTitle = r.newStoryTitle;
    } catch (e) { toast(e.message, 6000); T.messages.push({ role: 'assistant', content: `(${e.message})` }); }
    finally { T.busy = false; renderTalk(box, s); box.querySelector('textarea')?.focus(); }
  }

  // ---------- Ingest a source document ----------
  function renderIngest(pane) {
    const I = ST.ingest;
    let html = `<div class="sPaneHead"><span class="m sec">Add a source document</span><button class="link sec m" data-act="back">Close</button></div>`;
    if (!I?.items) html += `<div class="m sec" style="margin-bottom:12px;">Paste the text of a document with career stories, notes or reflections. It is read whole and split into story candidates — nothing is saved until you accept each one. Missing information becomes follow-up questions; nothing is invented.</div><form class="ingest"><input class="txt" name="source" placeholder="Source name (e.g. Personal Cartography, 2025)"><textarea class="txt" name="text" rows="12" placeholder="Paste the document text"></textarea><div class="row" style="margin:8px 0 0;"><button class="m link strong red" type="submit">${I?.busy ? 'Reading…' : 'Find stories'}</button></div></form>`;
    else {
      html += `<div class="m sec" style="margin-bottom:12px;">${I.items.length} candidate${I.items.length === 1 ? '' : 's'} from “${esc(I.source)}”. Accept the ones that are real; skip the rest.</div><div class="row" style="margin:0 0 16px;"><button class="m link strong red" data-act="acceptAll">Accept all</button><button class="m link sec" data-act="reset">Start over</button></div>`;
      html += I.items.map((c, i) => `<div class="cand"><div class="qHead m"><span class="strong">${esc(c.title)}</span><span class="sec">${c.kind}${c.sameAs ? ` · adds to ${esc(c.sameAs)}` : ''}</span></div>${c.sourceRef ? `<div class="m sec">${esc(c.sourceRef)}</div>` : ''}<div class="candFields">${Object.entries(c.fields || {}).filter(([, v]) => v).map(([k, v]) => `<div><span class="m">${esc(fields().find((f) => f.key === k)?.label || k)}</span><div class="a">${esc(v)}</div></div>`).join('')}</div>${(c.followups || []).length ? `<div class="m sec">Follow-ups: ${c.followups.map(esc).join(' · ')}</div>` : ''}<div class="row" style="margin:8px 0 0; gap:20px;"><button class="m link strong red" data-acc="${i}">${c.sameAs ? 'Merge' : 'Accept'}</button><button class="m link sec" data-skip="${i}">Skip</button></div></div>`).join('');
    }
    pane.innerHTML = html;
    pane.querySelector('[data-act="back"]').onclick = () => { ST.mode = null; renderPane(); };
    const form = pane.querySelector('form.ingest');
    if (form) form.onsubmit = async (e) => { e.preventDefault(); const text = form.text.value, source = form.source.value || 'Pasted document'; ST.ingest = { busy: true }; renderIngest(pane); try { ST.ingest = await runJob('ingest', { text, source }, 'Reading the document'); } catch (err) { toast(err.message, 6000); ST.ingest = null; } renderIngest(pane); };
    const accept = async (c) => {
      if (c.sameAs && byId(c.sameAs)) { const s = byId(c.sameAs); const patch = {}; for (const [k, v] of Object.entries(c.fields || {})) if (v) { patch[k] = (s[k] || '').trim() ? `${s[k].trim()}\n\n${v}` : v; } patch.followups = [...(s.followups || []), ...(c.followups || [])]; patch.sourceRef = [s.sourceRef, c.sourceRef].filter(Boolean).join(' · '); await api(`/api/stories/${s.id}`, { method: 'PUT', body: patch }); }
      else await api('/api/stories', { method: 'POST', body: { ...(c.fields || {}), title: c.title, kind: c.kind || 'story', source: I.source, sourceRef: c.sourceRef || '', territories: c.territories || [], followups: c.followups || [], relatedQuestions: c.relatedQuestions || [], newQuestions: c.newQuestions || [] } });
    };
    $$('[data-acc]', pane).forEach((b) => b.onclick = async () => { const c = I.items[Number(b.dataset.acc)]; await accept(c); I.items.splice(Number(b.dataset.acc), 1); await load(); renderList(); renderIngest(pane); toast('Saved to the bank.'); });
    $$('[data-skip]', pane).forEach((b) => b.onclick = () => { I.items.splice(Number(b.dataset.skip), 1); renderIngest(pane); });
    const all = pane.querySelector('[data-act="acceptAll"]'); if (all) all.onclick = async () => { for (const c of I.items) await accept(c); ST.ingest = null; await load(); renderList(); renderIngest(pane); toast('All saved.'); };
    const rs = pane.querySelector('[data-act="reset"]'); if (rs) rs.onclick = () => { ST.ingest = null; renderIngest(pane); };
  }

  function renderPatterns(pane) {
    if (ST.patternsBusy) { pane.innerHTML = `<div class="sPaneHead"><span class="m sec">Patterns</span></div><div class="m sec">Reading every story against the thesis and the question bank… about a minute.</div>`; return; }
    const P = ST.data.patterns || {};
    const list = (arr) => arr.length ? arr.map((x) => `<div class="q lnk"><span class="n">·</span><span><span class="t">${esc(x.text)}</span><span class="st">${(x.ids || []).map((id) => `<button class="link" data-open="${id}">${id}</button>`).join(' ')}</span></span></div>`).join('') : '<div class="m sec">None found.</div>';
    pane.innerHTML = `<div class="sPaneHead"><span class="m sec">Patterns · ${P.at ? fmtDate(P.at) : ''}</span><button class="link sec m" data-act="back">Close</button></div><div class="sBlock"><div class="m">Recurring patterns</div>${list(P.patterns || [])}</div><div class="sBlock"><div class="m">Contradictions</div>${list(P.contradictions || [])}</div><div class="sBlock"><div class="m">MVP questions with thin evidence</div>${(P.thinMvp || []).length ? P.thinMvp.map((n) => `<div class="q lnk"><span class="n">${n}</span><span><span class="t">${esc(qText(n))}</span></span></div>`).join('') : '<div class="m sec">None.</div>'}</div>`;
    pane.querySelector('[data-act="back"]').onclick = () => { ST.mode = null; renderPane(); };
    $$('[data-open]', pane).forEach((b) => b.onclick = () => { ST.open = b.dataset.open; ST.mode = 'edit'; renderList(); renderPane(); });
  }

  // ---------- Evidence while writing (02 Edit) ----------
  async function renderEvidence() {
    const box = $('#evidence'); if (!box || !S.post) return;
    const q = S.questions?.items.find((x) => x.postId === S.post.id);
    const title = A.el.title.value.trim();
    if (!q && !title) { box.innerHTML = ''; return; }
    if (!S.env.hasAi) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="m">Possible evidence</div><div class="m sec">Looking through your stories…</div>`;
    try {
      const r = await api('/api/story-ai/match', { method: 'POST', body: q ? { questionN: q.n } : { text: title } });
      const dec = S.post.evidence || {};
      const row = (x, linked) => `<div class="ev ${dec[x.id] === 'ignore' ? 'off' : ''}" data-id="${x.id}"><span class="sid">${x.id}</span><span><span class="t">${esc(x.title)}</span>${x.why ? `<span class="st">${x.strength === 'contradicts' ? 'Complicates it: ' : ''}${esc(x.why)}</span>` : linked ? '<span class="st">Linked to this question</span>' : ''}${x.needsDetail ? '<span class="st">Needs detail</span>' : ''}<span class="row" style="margin:4px 0 0; gap:14px;"><button class="m link ${dec[x.id] === 'use' ? 'strong red' : 'sec'}" data-d="use">Use this</button><button class="m link sec" data-d="ignore">Ignore</button><button class="m link sec" data-d="explore">Explore story</button><button class="m link sec" data-d="more">Needs more detail</button></span></span></div>`;
      const all = [...r.related.map((x) => row(x, true)), ...r.possible.map((x) => row(x, false))];
      box.innerHTML = `<div class="qHead m"><span>Possible evidence</span><button class="link sec" data-refresh>Refresh</button></div>${all.join('') || '<div class="m sec">No stories match yet.</div>'}${r.gap ? `<div class="m sec evGap">${esc(r.gap)} <button class="link strong" data-talkgap>Talk about it →</button></div>` : ''}`;
      box.querySelector('[data-refresh]').onclick = async () => { box.innerHTML = '<div class="m sec">…</div>'; await api('/api/story-ai/match', { method: 'POST', body: q ? { questionN: q.n, refresh: true } : { text: title } }); renderEvidence(); };
      const tg = box.querySelector('[data-talkgap]'); if (tg) tg.onclick = async () => { await open(); ST.open = null; ST.mode = 'talk'; ST.talk = { messages: [], busy: false, questionN: q?.n }; renderPane(); };
      $$('.ev', box).forEach((ev) => ev.querySelectorAll('[data-d]').forEach((b) => b.onclick = async () => {
        const id = ev.dataset.id, d = b.dataset.d, s = byId(id) || (await api(`/api/stories/${id}`));
        if (d === 'explore') { $('#btnNext').hidden = false; await open(id); return; }
        if (d === 'more') { if (q) { const fu = `Needed for Q${q.n}: what detail would make this usable as evidence?`; await api(`/api/stories/${id}`, { method: 'PUT', body: { followups: [...new Set([...(s.followups || []), fu])] } }); } toast('Noted on the story.'); return; }
        if (d === 'use') { const note = `<!-- Evidence · ${id}: ${s.title}${ev.querySelector('.st') ? ' — ' + ev.querySelector('.st').textContent : ''} · use what you choose; the story itself stays private -->`; if (!A.el.body.value.includes(id)) A.setBody(A.el.body.value.replace(/\s*$/, '') + `\n\n${note}\n`); toast('Note added at the end of your draft.'); }
        S.post.evidence = { ...(S.post.evidence || {}), [id]: d }; api(`/api/posts/${S.post.id}`, { method: 'PUT', body: { evidence: S.post.evidence } });
        ev.classList.toggle('off', d === 'ignore'); ev.querySelectorAll('[data-d]').forEach((x) => x.classList.toggle('strong', x === b && d === 'use')); ev.querySelectorAll('[data-d]').forEach((x) => x.classList.toggle('red', x === b && d === 'use'));
      }));
    } catch (e) { box.innerHTML = `<div class="m">Possible evidence</div><div class="m sec">${esc(e.message)}</div>`; }
  }

  window.Stories = { open, load, renderEvidence };
  if (S.env?.authed) load().catch(() => {});
})();
