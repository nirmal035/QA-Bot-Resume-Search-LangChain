/*
  Recreated template-like dark UI for RecruitBot
  - Left sidebar: search modes, controls
  - Center: results list + header
  - Right: conversation controls
  - Bottom: chat input bar
*/

const root = document.getElementById('root');
// cache last rendered results so clicks can reference them
let latestResults = [];

function escapeHtml(str){
  if(!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function render() {
  root.innerHTML = `
  <style>
    :root{--bg:#0f0b0a;--panel:#191414;--muted:#9a8f8f;--accent:#c86b3a;--card:#151212}
    html,body,#root{height:100%;margin:0}
    body{background:var(--bg);color:#eee;font-family:Inter,Segoe UI,Roboto,Arial}
    .layout{display:flex;height:100vh}
    .sidebar{width:260px;background:var(--panel);padding:20px;box-sizing:border-box;border-right:1px solid #241f1f}
    .sidebar h2{margin:0 0 12px 0;font-size:16px}
    .modes{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
    .mode{display:flex;gap:10px;align-items:center;background:#0f0b0a;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.02);cursor:pointer;color:var(--muted)}
    .mode .icon{width:18px;height:18px;opacity:0.9;flex:0 0 18px}
    .mode .label{flex:1}
    .mode.active{background:linear-gradient(90deg,#1b1413,#231717);color:#fff;border-color:rgba(200,110,70,0.12)}
    .control{margin-top:12px}
    .control label{display:block;color:var(--muted);font-size:12px;margin-bottom:6px}
    .hybridRow{display:flex;align-items:center;gap:12px}
    .hybridValue{font-size:12px;color:var(--muted);min-width:44px;text-align:right}
    input,select,textarea{width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,0.03);background:transparent;color:#eee}
    .center{flex:1;display:flex;flex-direction:column}
    .header{padding:18px 24px;border-bottom:1px solid #231f1f;background:linear-gradient(180deg,transparent,rgba(0,0,0,0.02))}
    .header h1{margin:0;font-size:18px}
    /* add extra bottom padding so fixed chat input doesn't cover results */
    .content{padding:18px 24px 120px 24px;overflow:auto;flex:1}
    .card{background:var(--card);padding:16px;border-radius:8px;margin-bottom:14px;border:1px solid rgba(255,255,255,0.02)}
    /* custom smooth scrollbar */
    .content::-webkit-scrollbar{width:10px}
    .content::-webkit-scrollbar-track{background:transparent}
    .content::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.04);border-radius:8px}
    .content::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,0.07)}
    .candidate{display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid rgba(255,255,255,0.02)}
    .candidate:last-child{border-bottom:none}
    .candidate .meta{color:var(--muted);font-size:13px}
    .chip{display:inline-block;padding:6px 8px;border-radius:16px;background:rgba(255,255,255,0.02);margin-right:6px;margin-top:6px;font-size:12px}
    .rank{color:var(--muted);text-align:right;font-size:13px}
    /* chat box spans between sidebars */
    .chatBox{position:fixed;left:300px;right:300px;bottom:14px;height:56px;background:linear-gradient(90deg,#0b0b0b,#0f0f0f);border-radius:8px;padding:8px;display:flex;align-items:center;border:1px solid rgba(255,255,255,0.03);z-index:60}
    .chatInput{flex:1;border:none;height:100%;background:rgba(0,0,0,0.35);padding:8px 12px;font-size:14px;color:#ffffff;opacity:1;caret-color:#ffffff;border-radius:6px}
    .chatInput::placeholder{color:rgba(255,255,255,0.5)}
    .chatInput:focus{outline:none;box-shadow:0 0 0 2px rgba(200,100,50,0.08)}
    .sendBtn{background:var(--accent);color:#fff;border:none;padding:10px 14px;border-radius:8px;margin-left:8px;cursor:pointer}
    .small{font-size:12px;color:var(--muted)}
    /* chat message alignment */
    #chatMessages{display:flex;flex-direction:column;gap:8px;margin-bottom:14px}
    .msg{max-width:78%;padding:10px;border-radius:8px;display:flex;gap:8px;align-items:flex-start}
    .msg .msgIcon{width:28px;height:28px;flex:0 0 28px}
    .msg.user{align-self:flex-end;background:rgba(255,255,255,0.04);text-align:right;flex-direction:row-reverse}
    .msg.assistant{align-self:flex-start;background:rgba(255,255,255,0.02);text-align:left}
    /* modal overlay for profile view */
    .overlay{position:fixed;inset:0;background:rgba(0,0,0,0.9);display:flex;align-items:center;justify-content:center;z-index:120}
    .modal{width:80%;max-width:1100px;height:80%;background:linear-gradient(180deg,#0f0f10,#131314);border-radius:10px;padding:20px;color:#eaeaea;overflow:auto;border:1px solid rgba(255,255,255,0.04);box-shadow:0 10px 40px rgba(0,0,0,0.6)}
    .modal .title{font-size:18px;font-weight:700;margin-bottom:8px}
    .modal .closeBtn{position:absolute;right:28px;top:22px;background:transparent;border:1px solid rgba(255,255,255,0.04);color:#fff;padding:6px 8px;border-radius:6px;cursor:pointer}
    .modal pre{white-space:pre-wrap;color:#e8e8e8;font-size:13px}
  </style>

  <div class="layout">
    <aside class="sidebar">
      <h2>RecruitBot</h2>
      <div style="display:flex;flex-direction:column;flex:1">
        <div class="modes">
        <div class="mode active" data-mode="bm25"><span class="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 6h18M3 12h12M3 18h18"/></svg>
          </span><span class="label">BM25</span></div>
        
        <div class="mode" data-mode="vector"><span class="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="3"/><path d="M5 21c3-4 6-6 7-6s4 2 7 6"/></svg>
          </span><span class="label">Vector</span></div>
        <div class="mode" data-mode="hybrid"><span class="icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="10" r="3"/><circle cx="15" cy="10" r="3"/><path d="M12 13v6"/></svg>
          </span><span class="label">Hybrid</span></div>
      <div class="control" style="margin-top:18px">
        <label>Hybrid BM25/Vector weight</label>
        <div class="hybridRow">
          <input id="hybridSlider" type="range" min="0" max="100" value="72" />
          <div id="hybridValue" class="hybridValue">72%</div>
        </div>
      </div>

      <div class="control" style="margin-top:12px">
        <label>Top-K results</label>
        <input id="topK" type="number" min="1" max="50" value="5" />
      </div>

      <div class="control" style="margin-top:8px">
        <label style="display:flex;align-items:center;gap:8px"><input id="summarize" type="checkbox" /> Summarize results</label>
      </div>

        <div style="margin-top:18px">
          <button id="clearBtn" style="width:100%;padding:10px;border-radius:8px;border:none;background:#31211b;color:#fff">Clear / Reset</button>
        </div>

        <!-- Conversation controls moved into left sidebar below Clear/Reset -->
        <div style="margin-top:18px">
          <div class="card">
            <div style="display:flex;align-items:center;gap:8px">
              <svg class="icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5z"/><path d="M21 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/></svg>
              <div class="small">Conversation</div>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px">
              <input id="convId" placeholder="conversation id" />
              <button id="deleteConv">Delete</button>
            </div>
            <div style="margin-top:12px">
              <div class="small">Note</div>
              <div class="small">Use the chat box at the bottom to send messages. Conversation ID will appear here after first response.</div>
            </div>
          </div>
        </div>
      </div>

      

    </aside>

    <main class="center">
      <div class="header">
        <h1 id="viewTitle">Search · BM25</h1>
      </div>
      <div class="content">
        <!-- Single output pane: chat messages above, search results below -->
        <div id="outputArea">
          <div id="chatMessages"></div>
          <div id="results"></div>
        </div>
      </div>
    </main>

    <!-- right pane removed; Conversation controls moved to left sidebar -->
  </div>

  <div class="chatBox">
    <input id="chatInput" class="chatInput" placeholder="Ask about candidates..." />
    <button id="sendChat" class="sendBtn">Send</button>
  </div>
  `;

  attachHandlers();
}

function base(){
  const v = document.getElementById('llmModel') ? document.getElementById('llmModel').value.trim() : '';
  // keep existing API prefix behavior: use /v1 by default
  const bp = document.getElementById('basePath') ? document.getElementById('basePath').value.trim() : '/v1';
  return (bp || '/v1').replace(/\/$/, '');
}

function timeoutMs(){
  const t = document.getElementById('timeout');
  return t ? Number(t.value)||30000 : 30000;
}

async function doFetch(path, opts={}){
  const controller = new AbortController();
  const t = setTimeout(()=>controller.abort(), timeoutMs());
  try{
    const res = await fetch(path, {...opts, signal: controller.signal});
    const text = await res.text();
    try{return JSON.parse(text)}catch(e){return {status:res.status, text}};
  }catch(err){return {error:err.message}}finally{clearTimeout(t)}
}

function formatCandidate(it, i){
  const skills = (it.skills && Array.isArray(it.skills)) ? it.skills : (it.skills ? JSON.parseSafe?.(it.skills) : []);
  return `
    <div class="card candidateCard" data-idx="${i}">
      <div class="candidate">
        <div>
          <div style="font-weight:600">${it.name || it.title || 'Unknown'}</div>
          <div class="meta">${it.role || it.position || ''} · ${it.email || it.contact || ''}</div>
          <div style="margin-top:8px">${(it.skills||[]).slice ? (it.skills||[]).slice(0,8).map(s=>`<span class="chip">${s}</span>`).join('') : ''}</div>
        </div>
        <div class="rank">
          <div>AI Rank</div>
          <div style="font-weight:700">#${i+1}</div>
          <div class="small">Relevance</div>
          <div style="margin-top:6px;color:var(--muted);font-size:12px">Score: ${typeof it.score==='number' ? it.score.toFixed(2) : 'N/A'}</div>
        </div>
      </div>
    </div>
  `;
}

function renderResults(list){
  const container = document.getElementById('results');
  latestResults = Array.isArray(list) ? list : [];
  // Ensure results are ordered by numeric score (desc) when available
  try{ latestResults.sort((a,b)=> (b.score||0) - (a.score||0)); }catch(e){}
  if(!list || list.length===0){ container.innerHTML = '<div class="small">No results</div>'; return }
  container.innerHTML = latestResults.map((it,i)=>formatCandidate(it,i)).join('');

  // attach click handlers so selecting a profile shows its content in the chat pane
  setTimeout(()=>{
    const elems = container.querySelectorAll('.candidateCard');
    elems.forEach((el, idx) => {
      el.style.cursor = 'pointer';
      el.onclick = () => {
        const item = latestResults[idx];
        const msgs = document.getElementById('chatMessages');
        const profileId = `profile_${idx}`;

        // Ensure only one overlay exists at a time
        const existingOverlay = document.getElementById('profileOverlay');
        if (existingOverlay) existingOverlay.remove();

        // Build overlay modal showing full document/profile text
        const overlay = document.createElement('div');
        overlay.id = 'profileOverlay';
        overlay.className = 'overlay';

        const title = item.name || item.title || `Profile #${idx+1}`;
        const modalHtml = `
          <div class="modal" role="dialog" aria-modal="true">
            <button class="closeBtn" aria-label="Close">✕</button>
            <div class="title">${escapeHtml(title)}</div>
            <pre>${escapeHtml(JSON.stringify(item, null, 2))}</pre>
          </div>
        `;
        overlay.innerHTML = modalHtml;

        // Close when clicking background (but not when clicking inside modal)
        overlay.addEventListener('click', (ev) => {
          if (ev.target === overlay) overlay.remove();
        });

        // Close button
        overlay.querySelector('.closeBtn').addEventListener('click', ()=> overlay.remove());

        // Close on Escape
        const escHandler = (e) => { if (e.key === 'Escape') { overlay.remove(); window.removeEventListener('keydown', escHandler); } };
        window.addEventListener('keydown', escHandler);

        document.body.appendChild(overlay);
      };
    });
  }, 20);
}

function attachHandlers(){
  // modes
  document.querySelectorAll('.mode').forEach(el=>el.addEventListener('click', ()=>{
    document.querySelectorAll('.mode').forEach(m=>m.classList.remove('active'));
    el.classList.add('active');
    const mode = el.getAttribute('data-mode');
    document.getElementById('viewTitle').textContent = `Search · ${mode.toUpperCase()}`;
  }));

  // Maintain an in-memory chat history for display
  const chatHistory = [];

  function appendChat(role, text){
    const outEl = document.getElementById('chatMessages');
    const time = new Date().toLocaleTimeString();
    const cls = role === 'user' ? 'small' : 'small';
    const header = role === 'user' ? `You · ${time}` : `Assistant · ${time}`;
    // include user/bot icon with the message
    const iconSvg = role === 'assistant' ?
      `<svg class="msgIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2a2 2 0 0 1 2 2v1h-4V4a2 2 0 0 1 2-2z"/><rect x="6" y="8" width="12" height="10" rx="2"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>` :
      `<svg class="msgIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="3"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>`;

    const block = `<div class="msg ${role}" style="margin-bottom:10px">${iconSvg}<div style="flex:1"><div style="font-weight:600">${header}</div><div style="white-space:pre-wrap;margin-top:6px;color:#e8e8e8">${escapeHtml(text)}</div></div></div>`;
    outEl.innerHTML = (outEl.innerHTML || '') + block;
    // scroll the scrollable content area so new messages/results are visible above the chat box
    const contentEl = document.querySelector('.content');
    if(contentEl) contentEl.scrollTop = contentEl.scrollHeight;
  }

  function displayAssistantResponseOnMain(text){
    const container = document.getElementById('results');
    const header = `<div class="card" id="assistantResponse" style="border-left:4px solid rgba(200,100,50,0.6);">
      <div style="font-weight:700;margin-bottom:8px">Assistant Response</div>
      <div style="white-space:pre-wrap;color:#e8e8e8">${escapeHtml(text)}</div>
    </div>`;
    // insert at the top
    container.innerHTML = header + (container.innerHTML || '');
  }

  function escapeHtml(str){
    if(!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // sendChat uses the single bottom chat input
  document.getElementById('sendChat').onclick = async ()=>{
    const convIdInput = document.getElementById('convId');
    const convId = convIdInput ? convIdInput.value.trim() || undefined : undefined;
    const inputEl = document.getElementById('chatInput');
    const msg = inputEl.value || '';
    if(!msg){ alert('Enter a message'); return }

    // show user message immediately
    appendChat('user', msg);

    const p = '/chat';
    const body = { message: msg };
    // include selected searchType from active mode (map UI mode -> API searchType)
    const activeModeEl = document.querySelector('.mode.active');
    if(activeModeEl){
      const uiMode = activeModeEl.getAttribute('data-mode');
      const map = { bm25: 'keyword', vector: 'vector', hybrid: 'hybrid' };
      body.searchType = map[uiMode] || 'hybrid';
    }
    if(convId) body.conversationId = convId;
    // include optional topK and summarize flags if present in the UI
    const topKEl = document.getElementById('topK');
    if(topKEl){ const v = Number(topKEl.value) || 5; body.topK = v }
    const summarizeEl = document.getElementById('summarize');
    if(summarizeEl){ body.summarize = !!summarizeEl.checked }

    // disable input while awaiting reply
    inputEl.disabled = true;
    document.getElementById('sendChat').disabled = true;

    const out = await doFetch(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

    // re-enable input
    inputEl.disabled = false;
    document.getElementById('sendChat').disabled = false;

    if(out && out.conversationId){ document.getElementById('convId').value = out.conversationId }

    // display assistant response if available (both in right chat log and main area)
    // If the user specifically asked for contact info, only show email/phone from results
    const contactRequest = /(?:\bemail(?:\s*id)?\b|\bcontact(?:\s*number)?\b|\bphone(?:\s*number)?\b|share.*email|share.*contact)/i.test(msg);

    if (contactRequest && out && Array.isArray(out.searchResults) && out.searchResults.length > 0) {
      // Contact-only intent: return exact contact values only (no full profiles)
      const contacts = out.searchResults.map(r => `${r.name || 'Candidate'}: ${r.email || 'N/A'} · ${r.phoneNumber || 'N/A'}`);
      appendChat('assistant', contacts.join('\n'));
    } else if(out && (out.response || out.output || out.answer || out.text)){
      const reply = out.response ?? out.output ?? out.answer ?? out.text;
      appendChat('assistant', reply);
      // render any search results included (below the assistant response)
      if(out && out.searchResults) renderResults(out.searchResults);
    } else if(out && out.error){
      appendChat('assistant', `Error: ${out.error}`);
    } else {
      // fallback: show full JSON in chat
      const asJson = JSON.stringify(out, null, 2);
      appendChat('assistant', asJson);
    }

    // clear input on success
    if(!out || !out.error) inputEl.value = '';
  };

  document.getElementById('deleteConv').onclick = async ()=>{
    const convId = document.getElementById('convId').value.trim();
    if(!convId){ alert('Provide conversationId'); return }
    const p = `/chat/${encodeURIComponent(convId)}`;
    const out = await doFetch(p,{method:'DELETE'});
    const msgArea = document.getElementById('chatMessages');
    msgArea.innerHTML = (msgArea.innerHTML || '') + `<div class="small">Deleted conversation: ${escapeHtml(JSON.stringify(out))}</div>`;
    if(out && out.success){ document.getElementById('convId').value = '' }
  };

  // search controls
  // bottom chat input will be used as the single input for searches and chat
  document.getElementById('chatInput').addEventListener('keydown', (e)=>{ if(e.key==='Enter') document.getElementById('sendChat').click(); });

  document.getElementById('hybridSlider').addEventListener('input', ()=>{})
  // update displayed hybrid value
  const hybridSlider = document.getElementById('hybridSlider');
  const hybridValue = document.getElementById('hybridValue');
  if(hybridSlider && hybridValue){
    hybridValue.textContent = `${hybridSlider.value}%`;
    hybridSlider.addEventListener('input', ()=>{
      hybridValue.textContent = `${hybridSlider.value}%`;
    });
  }

  document.getElementById('clearBtn').onclick = ()=>{
    try{ document.getElementById('query').value=''; }catch(e){}
    try{ document.getElementById('filters').value=''; }catch(e){}
    try{ document.getElementById('convMsg').value=''; }catch(e){}
    const msgs = document.getElementById('chatMessages'); if(msgs) msgs.innerHTML = '';
    document.getElementById('results').innerHTML='';
  };

  // sample search triggers for left modes
  document.querySelector('[data-mode="bm25"]').addEventListener('click', ()=>performSearch('bm25'));
  document.querySelector('[data-mode="vector"]').addEventListener('click', ()=>performSearch('vector'));
  document.querySelector('[data-mode="hybrid"]').addEventListener('click', ()=>performSearch('hybrid'));
  // removed e2e mode - only bm25/vector/hybrid remain
}

async function performSearch(type='bm25', explicitQuery){
  // If explicitQuery provided use it, otherwise read from bottom chat input
  const q = (explicitQuery !== undefined) ? explicitQuery : (document.getElementById('chatInput').value || '');
  // show the user's search query in the chat area
  if(q && q.trim()) appendChat('user', q);
  const topK = Number(document.getElementById('topK').value) || 5;
  // No central filters input; allow optional filters via a hidden or future control
  const filters = {};
  const p = `/search/resumes`;
  document.getElementById('results').innerHTML = '<div class="small">loading...</div>';
  // map UI mode to API searchType
  const map = { bm25: 'keyword', vector: 'vector', hybrid: 'hybrid' };
  const searchType = map[type] || 'keyword';
  const convEl = document.getElementById('convId');
  const conversationId = convEl ? (convEl.value.trim() || undefined) : undefined;
  const out = await doFetch(p,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q,searchType,topK,filters,conversationId})});
  if(out && out.results){
    if(out && out.conversationId){
      try{ document.getElementById('convId').value = out.conversationId }catch(e){}
    }
    // summarize into chat area then render results
    const cnt = Array.isArray(out.results) ? out.results.length : 0;
    appendChat('assistant', `Search results for "${q}" — ${cnt} items`);
    renderResults(out.results);
  }
  else if(Array.isArray(out)){
    appendChat('assistant', `Search results for "${q}" — ${out.length} items`);
    renderResults(out);
  }
  else {
    const text = JSON.stringify(out,null,2);
    appendChat('assistant', text);
    document.getElementById('results').innerHTML = `<pre class="small">${text}</pre>`;
  }
}

// Initialize UI
render();

