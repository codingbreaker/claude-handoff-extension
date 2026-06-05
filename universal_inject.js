// AI Handoff — universal_inject.js
// Runs on ALL AI platforms: Claude, ChatGPT, Gemini, Grok, Perplexity, Copilot, DeepSeek, Mistral, Poe, You.com
// Export from ANY AI → Continue on ANY AI
// @codingbreaker | github.com/codingbreaker

(function () {
  'use strict';

  // ══════════════════════════════════════════════════════════════════
  //  PLATFORM CONFIG
  // ══════════════════════════════════════════════════════════════════
  const PLATFORMS = {
    'claude.ai':             { name: 'Claude',     ctx: 200000,  color: '#d97706' },
    'chatgpt.com':           { name: 'ChatGPT',    ctx: 128000,  color: '#10a37f' },
    'chat.openai.com':       { name: 'ChatGPT',    ctx: 128000,  color: '#10a37f' },
    'gemini.google.com':     { name: 'Gemini',     ctx: 1000000, color: '#4285f4' },
    'grok.com':              { name: 'Grok',       ctx: 131072,  color: '#1d9bf0' },
    'x.com':                 { name: 'Grok',       ctx: 131072,  color: '#1d9bf0' },
    'perplexity.ai':         { name: 'Perplexity', ctx: 200000,  color: '#20b2aa' },
    'copilot.microsoft.com': { name: 'Copilot',    ctx: 128000,  color: '#0078d4' },
    'chat.deepseek.com':     { name: 'DeepSeek',   ctx: 128000,  color: '#4d6bfe' },
    'chat.mistral.ai':       { name: 'Mistral',    ctx: 128000,  color: '#ff6b35' },
    'poe.com':               { name: 'Poe',        ctx: 200000,  color: '#9333ea' },
    'you.com':               { name: 'You.com',    ctx: 200000,  color: '#ff4f00' },
    'meta.ai':               { name: 'Meta AI',    ctx: 128000,  color: '#0081fb' },
  };

  // Platform-specific message selectors: [userSel, aiSel]
  const SELECTORS = {
    'claude.ai':         [['[data-testid="human-turn"]','[data-message-author-role="human"]'], ['[data-testid="ai-turn"]','[data-message-author-role="assistant"]']],
    'chatgpt.com':       [['[data-message-author-role="user"]'],  ['[data-message-author-role="assistant"]']],
    'chat.openai.com':   [['[data-message-author-role="user"]'],  ['[data-message-author-role="assistant"]']],
    'gemini.google.com': [['user-query','.user-query-text','.user-query-content'], ['model-response','.model-response-text','.response-content']],
    'grok.com':          [['[data-testid="user-message"]','.user-message'], ['[data-testid="assistant-message"]','.assistant-message']],
    'perplexity.ai':     [['[data-testid="user-message"]','.user'],  ['[data-testid="answer"]','.answer','.prose']],
    'copilot.microsoft.com': [['[data-testid="user-message"]'], ['[data-testid="ai-message"]']],
    'chat.deepseek.com': [['[class*="human"],[class*="user"]'],   ['[class*="assistant"],[class*="ai"]']],
    'chat.mistral.ai':   [['[class*="user"]'],  ['[class*="assistant"]']],
    'poe.com':           [['[class*="human"],[data-author="human"]'], ['[class*="bot"],[data-author]']],
    'you.com':           [['[class*="user-message"],[class*="UserMessage"]'], ['[class*="ai-message"],[class*="AiMessage"]']],
  };

  const host     = location.hostname.replace('www.','');
  const platform = PLATFORMS[host] || { name: host, ctx: 128000, color: '#7c3aed' };

  // ── Settings ──────────────────────────────────────────────────────────────
  const CFG_DEFAULTS = { showExportBtn: true };
  let CFG = { ...CFG_DEFAULTS };

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.hoffSettings) return;
    CFG = { ...CFG_DEFAULTS, ...(changes.hoffSettings.newValue || {}) };
    const pill = document.getElementById('__hoff_export_pill');
    if (!CFG.showExportBtn) { pill?.remove(); }
    else if (!pill) { injectExportPill(); }
  });

  // ══════════════════════════════════════════════════════════════════
  //  BOOT — single settings read, then inject
  // ══════════════════════════════════════════════════════════════════
  function boot() {
    chrome.storage.sync.get('hoffSettings', ({ hoffSettings }) => {
      CFG = { ...CFG_DEFAULTS, ...(hoffSettings || {}) };
      if (CFG.showExportBtn) injectExportPill();
    });

    chrome.storage.local.get(['handoff_doc','handoff_ts','handoff_count','handoff_from'], (data) => {
      if (!data.handoff_doc) return;
      if (Date.now() - (data.handoff_ts||0) > 30*60*1000) {
        chrome.storage.local.remove(['handoff_doc','handoff_ts','handoff_count','handoff_from']);
        return;
      }
      // Don't show banner on the source platform itself
      if (data.handoff_from === platform.name) return;
      waitAndShowBanner(data.handoff_doc, data.handoff_count||'?');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // ── Keep export pill alive: MutationObserver (instant) + fallback interval ─
  let _pillTimer = null;
  new MutationObserver(() => {
    if (!CFG.showExportBtn) return;
    if (!document.getElementById('__hoff_export_pill')) {
      clearTimeout(_pillTimer);
      _pillTimer = setTimeout(injectExportPill, 200);
    }
  }).observe(document.body, { childList: true, subtree: false });

  setInterval(() => {
    if (!CFG.showExportBtn) return;
    if (!document.getElementById('__hoff_export_pill')) injectExportPill();
  }, 3000);

  // ══════════════════════════════════════════════════════════════════
  //  EXPORT PILL — bottom-right, on every AI platform
  // ══════════════════════════════════════════════════════════════════
  function injectExportPill() {
    if (document.getElementById('__hoff_export_pill')) return;

    const pill = document.createElement('button');
    pill.id = '__hoff_export_pill';
    pill.title = `Export ${platform.name} conversation → switch to any AI\nRight-click = debug`;
    pill.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
      </svg>
      <span style="font-size:11px;font-weight:700;letter-spacing:.2px">Handoff</span>
    `;

    Object.assign(pill.style, {
      position:    'fixed',
      bottom:      '18px',
      right:       '14px',
      zIndex:      '2147483647',
      display:     'inline-flex',
      alignItems:  'center',
      gap:         '5px',
      padding:     '5px 11px',
      borderRadius:'20px',
      border:      `1px solid ${platform.color}55`,
      background:  `linear-gradient(135deg, ${platform.color}dd, ${platform.color}88)`,
      color:       '#fff',
      cursor:      'pointer',
      fontFamily:  'system-ui,-apple-system,sans-serif',
      boxShadow:   `0 2px 10px ${platform.color}44`,
      userSelect:  'none',
      transition:  'transform .15s, box-shadow .15s',
      backdropFilter: 'blur(4px)',
      lineHeight:  '1',
    });

    pill.onmouseenter = () => { pill.style.transform='scale(1.07)'; pill.style.boxShadow=`0 4px 16px ${platform.color}66`; };
    pill.onmouseleave = () => { pill.style.transform='scale(1)';    pill.style.boxShadow=`0 2px 10px ${platform.color}44`; };
    pill.onclick       = () => runExport();
    pill.oncontextmenu = e  => { e.preventDefault(); showDebug(); };

    document.body.appendChild(pill);
  }

  // ══════════════════════════════════════════════════════════════════
  //  TOKEN COUNTER PILL — bottom-left
  // ══════════════════════════════════════════════════════════════════
  function injectTokenPill() {
    if (document.getElementById('__hoff_tok_pill')) return;

    const pill = document.createElement('div');
    pill.id = '__hoff_tok_pill';
    Object.assign(pill.style, {
      position:    'fixed',
      bottom:      '16px',
      left:        '16px',
      zIndex:      '2147483647',
      display:     'flex',
      alignItems:  'center',
      gap:         '7px',
      padding:     '7px 13px',
      borderRadius:'99px',
      background:  '#0f0f1acc',
      border:      `1px solid ${platform.color}44`,
      color:       '#e2e8f0',
      fontFamily:  'system-ui,-apple-system,sans-serif',
      fontSize:    '12px',
      fontWeight:  '500',
      boxShadow:   '0 2px 12px rgba(0,0,0,0.35)',
      userSelect:  'none',
      cursor:      'default',
      backdropFilter: 'blur(6px)',
      transition:  'opacity .3s',
      opacity:     '0.88',
    });

    pill.innerHTML = `
      <span id="__hoff_dot" style="width:7px;height:7px;border-radius:50%;
        background:${platform.color};flex-shrink:0;display:inline-block"></span>
      <span style="color:${platform.color};font-weight:700">${platform.name}</span>
      <span style="color:#4b5563">|</span>
      <span id="__hoff_used" style="color:#a78bfa">—</span>
      <span style="color:#374151;font-size:11px">used</span>
      <span style="color:#4b5563">·</span>
      <span id="__hoff_left" style="color:#4ade80">—</span>
      <span style="color:#374151;font-size:11px">left</span>
      <span id="__hoff_pct" style="background:#1f2937;border-radius:4px;
        padding:1px 6px;font-size:11px;color:#9ca3af;margin-left:1px">—%</span>
    `;

    pill.onmouseenter = () => pill.style.opacity = '1';
    pill.onmouseleave = () => pill.style.opacity = '0.88';
    document.body.appendChild(pill);
    updateTokenPill();
  }

  function updateTokenPill() {
    const usedEl = document.getElementById('__hoff_used');
    const leftEl = document.getElementById('__hoff_left');
    const pctEl  = document.getElementById('__hoff_pct');
    const dotEl  = document.getElementById('__hoff_dot');
    if (!usedEl) return;

    const main  = document.querySelector('main,[role="main"],#main') || document.body;
    const chars = (main.innerText||'').length;
    const used  = Math.round(chars / 3.8);
    const left  = Math.max(0, platform.ctx - used);
    const pct   = Math.min(100, Math.round(used / platform.ctx * 100));

    usedEl.textContent = fmt(used);
    leftEl.textContent = fmt(left);
    pctEl.textContent  = `${pct}%`;

    if (pct > 80) {
      leftEl.style.color='#f87171'; dotEl.style.background='#f87171';
      pctEl.style.background='#450a0a'; pctEl.style.color='#fca5a5';
    } else if (pct > 60) {
      leftEl.style.color='#fbbf24'; dotEl.style.background='#fbbf24';
      pctEl.style.background='#451a03'; pctEl.style.color='#fcd34d';
    } else {
      leftEl.style.color='#4ade80'; dotEl.style.background=platform.color;
      pctEl.style.background='#1f2937'; pctEl.style.color='#9ca3af';
    }
  }

  function fmt(n) { return n>=1000000?`${(n/1000000).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(1)}k`:String(n); }

  // ══════════════════════════════════════════════════════════════════
  //  EXTRACTION — 6 strategies, pick best (same engine as content.js)
  // ══════════════════════════════════════════════════════════════════
  function cleanEl(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('button,svg,[aria-hidden],style,script,noscript').forEach(n=>n.remove());
    return c.innerText.replace(/\n{3,}/g,'\n\n').trim();
  }

  function yPos(el) { let y=0,n=el; while(n&&n!==document.body){y+=n.offsetTop||0;n=n.offsetParent;} return y; }

  function dedup(arr) {
    const s = new Set();
    return arr.filter(t => { const k=t.text.slice(0,80); if(s.has(k)||t.text.length<5)return false; s.add(k); return true; });
  }

  // S1: Claude data-testid
  function _s1() { const t=[]; document.querySelectorAll('[data-testid="human-turn"]').forEach(e=>t.push({role:'USER',text:cleanEl(e),y:yPos(e)})); document.querySelectorAll('[data-testid="ai-turn"]').forEach(e=>t.push({role:'AI',text:cleanEl(e),y:yPos(e)})); return t; }
  // S2: data-message-author-role (ChatGPT, Claude)
  function _s2() { return Array.from(document.querySelectorAll('[data-message-author-role]')).map(e=>({role:e.getAttribute('data-message-author-role')==='human'||e.getAttribute('data-message-author-role')==='user'?'USER':'AI',text:cleanEl(e),y:yPos(e)})); }
  // S3: Platform-specific selectors from SELECTORS table
  function _s3() { const t=[],sels=SELECTORS[host]; if(!sels)return t; const[uSels,aSels]=sels; uSels.forEach(sel=>document.querySelectorAll(sel).forEach(e=>t.push({role:'USER',text:cleanEl(e),y:yPos(e)}))); aSels.forEach(sel=>document.querySelectorAll(sel).forEach(e=>t.push({role:'AI',text:cleanEl(e),y:yPos(e)}))); return t; }
  // S4: copy/edit button heuristic
  function _s4() { const t=[]; document.querySelectorAll('article,[class*="group"],[class*="message"],[class*="turn"]').forEach(e=>{ const text=cleanEl(e); if(text.length<8)return; const hasEdit=e.querySelector('[aria-label*="dit"i]'); const hasCopy=e.querySelector('[aria-label*="opy"i]'); if(!hasEdit&&!hasCopy)return; t.push({role:hasEdit?'USER':'AI',text,y:yPos(e)}); }); return t; }
  // S5: font-claude / user-message class heuristic
  function _s5() { const t=[]; document.querySelectorAll('[class*="font-claude"]').forEach(e=>{ const b=e.closest('article')||e.closest('[class*="group"]')||e; const text=cleanEl(b); if(text.length>8)t.push({role:'AI',text,y:yPos(b)}); }); document.querySelectorAll('[class*="user-message"],[class*="UserMessage"],[class*="human"]').forEach(e=>{ const text=cleanEl(e); if(text.length>4)t.push({role:'USER',text,y:yPos(e)}); }); return t; }
  // S6: generic prose block grouping
  function _s6() { const main=document.querySelector('main')||document.body;const g=[],seen=new Set();let cur=null;main.querySelectorAll('p,pre,li,h1,h2,h3,blockquote').forEach(el=>{const text=el.innerText?.trim()||'';if(text.length<10||seen.has(text.slice(0,60)))return;seen.add(text.slice(0,60));const y=yPos(el);if(!cur||y-cur.lastY>200){if(cur)g.push(cur);cur={role:'UNKNOWN',parts:[text],y,lastY:y};}else{cur.parts.push(text);cur.lastY=y;}});if(cur)g.push(cur);return g.map(x=>({role:x.role,text:x.parts.join('\n'),y:x.y})); }

  // Score a result: prefer strategies with BOTH USER+AI roles, penalize UNKNOWN-only
  function scoreResult(turns) {
    if (!turns.length) return -1;
    const hasUser = turns.some(t => t.role === 'USER');
    const hasAI   = turns.some(t => t.role === 'AI');
    const allUnknown = turns.every(t => t.role === 'UNKNOWN');
    // Filter out very short turns (UI snippets, button labels)
    const meaningful = turns.filter(t => t.text.length > 40);
    if (meaningful.length === 0) return -1;
    // Score: both roles = 1000 + count, one role = 100 + count, all unknown = count only
    if (hasUser && hasAI)  return 1000 + meaningful.length;
    if (hasUser || hasAI)  return 100  + meaningful.length;
    if (allUnknown)        return meaningful.length;
    return meaningful.length;
  }

  function extractMessages() {
    const fns = [_s1, _s2, _s3, _s4, _s5, _s6];
    let best = [], bestScore = -1;

    for (let i = 0; i < fns.length; i++) {
      try {
        const r = dedup(fns[i]().sort((a,b) => a.y - b.y));
        const score = scoreResult(r);
        if (score > bestScore) { bestScore = score; best = r; }
      } catch(_) {}
    }

    // Filter out UNKNOWN turns if we have real USER/AI turns
    const hasRealRoles = best.some(t => t.role === 'USER' || t.role === 'AI');
    if (hasRealRoles) best = best.filter(t => t.role !== 'UNKNOWN');

    // Drop turns that are too short to be real messages
    best = best.filter(t => t.text.length > 15);

    return best;
  }

  // ══════════════════════════════════════════════════════════════════
  //  BUILD HANDOFF DOCUMENT — token-efficient format
  // ══════════════════════════════════════════════════════════════════
  function buildDoc(turns) {
    const title = document.title.replace(/\s*[-–|].*$/,'').trim() || `${platform.name} Conversation`;

    // Split: older context vs recent exchanges
    const RECENT_COUNT = 6; // last N turns shown in full
    const older  = turns.length > RECENT_COUNT ? turns.slice(0, -RECENT_COUNT) : [];
    const recent = turns.length > RECENT_COUNT ? turns.slice(-RECENT_COUNT)    : turns;

    // Build older summary — key points only, 1 line each
    let olderSummary = '';
    if (older.length > 0) {
      const points = older.map(t => {
        const who  = t.role === 'USER' ? 'User' : t.role === 'AI' ? platform.name : 'Note';
        const snip = t.text.replace(/\n+/g,' ').trim().slice(0, 160);
        return `• [${who}] ${snip}${t.text.length > 160 ? '…' : ''}`;
      });
      olderSummary = `## EARLIER CONTEXT (${older.length} messages — summarized)\n${points.join('\n')}\n`;
    }

    // Build recent messages in full
    let recentHistory = '';
    recent.forEach(({role, text}) => {
      const who = role === 'USER' ? 'USER' : role === 'AI' ? platform.name.toUpperCase() : 'NOTE';
      recentHistory += `### ${who}\n${text.trim()}\n\n`;
    });

    // Last user message = current task
    const lastUser = [...turns].reverse().find(t => t.role === 'USER');
    const currentTask = lastUser ? lastUser.text.replace(/\n+/g,' ').trim().slice(0, 200) : '(see recent messages)';

    return `# AI HANDOFF — ${title}
**From:** ${platform.name}  |  **Messages:** ${turns.length}  |  **Exported:** ${new Date().toLocaleString('en-US')}

---
## CURRENT TASK
${currentTask}

---
${olderSummary}
## RECENT MESSAGES (last ${recent.length})
${recentHistory}---
**INSTRUCTIONS:** You are continuing this conversation. Do NOT re-introduce yourself or re-explain what was already done. Read the context above, then immediately continue from the current task. Keep your first response brief — confirm the task in 1 sentence, then proceed.

*— AI Handoff · @codingbreaker*
`;
  }

  // ══════════════════════════════════════════════════════════════════
  //  AI LIST (for picker)
  // ══════════════════════════════════════════════════════════════════
  const AI_LIST = [
    { name:'ChatGPT',    url:'https://chatgpt.com',           color:'#10a37f' },
    { name:'Claude',     url:'https://claude.ai/new',         color:'#d97706' },
    { name:'Gemini',     url:'https://gemini.google.com',     color:'#4285f4' },
    { name:'Grok',       url:'https://grok.com',              color:'#1d9bf0' },
    { name:'Perplexity', url:'https://www.perplexity.ai',     color:'#20b2aa' },
    { name:'DeepSeek',   url:'https://chat.deepseek.com',     color:'#4d6bfe' },
    { name:'Mistral',    url:'https://chat.mistral.ai',       color:'#ff6b35' },
    { name:'Copilot',    url:'https://copilot.microsoft.com', color:'#0078d4' },
    { name:'Poe',        url:'https://poe.com',               color:'#9333ea' },
    { name:'You.com',    url:'https://you.com',               color:'#ff4f00' },
    { name:'Meta AI',    url:'https://meta.ai',               color:'#0081fb' },
  ];

  // ══════════════════════════════════════════════════════════════════
  //  RUN EXPORT → show AI picker
  // ══════════════════════════════════════════════════════════════════
  function runExport() {
    const pill = document.getElementById('__hoff_export_pill');
    if (pill) { pill.style.opacity='.5'; pill.style.pointerEvents='none'; }
    const restore = () => { if(pill){pill.style.opacity='1';pill.style.pointerEvents='';} };

    setTimeout(() => {
      const turns = extractMessages();
      if (turns.length === 0) {
        toast('No messages found. Scroll to load full conversation first.', false);
        restore(); return;
      }
      const doc = buildDoc(turns);
      chrome.storage.local.set({ handoff_doc:doc, handoff_ts:Date.now(), handoff_count:turns.length, handoff_from:platform.name });
      restore();
      showAIPicker(doc, turns.length);
    }, 150);
  }

  // ══════════════════════════════════════════════════════════════════
  //  AI PICKER MODAL  (with custom AI add/remove)
  // ══════════════════════════════════════════════════════════════════
  const CUSTOM_COLORS = ['#e879f9','#34d399','#fb923c','#60a5fa','#f472b6','#a78bfa','#2dd4bf','#facc15'];

  function showAIPicker(doc, count) {
    chrome.storage.sync.get(['hoffCustomAIs','hoffHiddenAIs'], ({ hoffCustomAIs, hoffHiddenAIs }) => {
      _renderPicker(doc, count, hoffCustomAIs || [], hoffHiddenAIs || []);
    });
  }

  function _renderPicker(doc, count, customAIs, hiddenAIs) {
    document.getElementById('__hoff_picker')?.remove();

    const ov = document.createElement('div');
    ov.id = '__hoff_picker';
    Object.assign(ov.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,0.72)',
      zIndex:'2147483647', display:'flex', alignItems:'center', justifyContent:'center',
      fontFamily:'system-ui,-apple-system,sans-serif', backdropFilter:'blur(4px)',
    });

    const hiddenSet = new Set(hiddenAIs);

    function makeCard(ai, isCustom) {
      const isCurrent = location.hostname.replace('www.','').includes(
        ai.url.replace('https://','').replace('www.','').split('/')[0]
      );
      return `<div class="__hp_card" data-url="${ai.url}" data-name="${ai.name}" data-custom="${isCustom}" style="
        position:relative;background:#0f0f1a;border:1px solid ${ai.color}44;border-radius:10px;
        color:#e2e8f0;cursor:${isCurrent?'default':'pointer'};padding:10px 6px;display:flex;flex-direction:column;
        align-items:center;gap:5px;transition:all .15s;font-family:inherit;
        ${isCurrent ? 'opacity:.3;' : ''}
      ">
        <span style="width:28px;height:28px;border-radius:50%;background:${ai.color}22;
          border:1px solid ${ai.color}55;display:flex;align-items:center;justify-content:center;
          font-size:13px;font-weight:800;color:${ai.color};flex-shrink:0">${ai.name[0].toUpperCase()}</span>
        <span style="font-size:10px;font-weight:600;color:#c4b5fd;text-align:center;line-height:1.2;
          max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ai.name}</span>
        ${!isCurrent ? `<button class="__hp_del" data-name="${ai.name}" data-custom="${isCustom}" style="
          position:absolute;top:3px;right:3px;background:#1f293788;border:none;color:#6b7280;
          width:15px;height:15px;border-radius:3px;cursor:pointer;font-size:10px;
          display:flex;align-items:center;justify-content:center;padding:0;line-height:1;
          opacity:0;transition:opacity .15s" class="__hp_del">×</button>` : ''}
      </div>`;
    }

    const defaultCards = AI_LIST.filter(ai => !hiddenSet.has(ai.name)).map(ai => makeCard(ai, false)).join('');
    const customCards  = customAIs.map(ai => makeCard(ai, true)).join('');
    const restoreBtn   = hiddenSet.size > 0
      ? `<div id="__hp_restore" style="grid-column:1/-1;text-align:center;padding:4px 0;
          font-size:10px;color:#4b5563;cursor:pointer;text-decoration:underline;
          text-underline-offset:2px">↩ Restore hidden (${hiddenSet.size})</div>` : '';
    const addCard = `<div id="__hp_add_btn" style="
      background:#0f0f1a;border:2px dashed #374151;border-radius:10px;
      color:#4b5563;cursor:pointer;padding:10px 6px;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:4px;transition:all .15s;min-height:68px;
    ">
      <span style="font-size:18px;line-height:1;color:#6b7280">+</span>
      <span style="font-size:9px;font-weight:600;color:#4b5563">Add AI</span>
    </div>`;

    ov.innerHTML = `
      <div id="__hp_box" style="background:#0d0d1a;border:1px solid #1f2937;border-radius:18px;padding:22px;
        width:420px;max-width:96vw;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,0.65)">

        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px">
          <div>
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:3px">
              <span style="font-size:15px;font-weight:800;color:#e2e8f0">🔀 Where to continue?</span>
            </div>
            <div style="font-size:11px;color:#6b7280">
              <span style="color:#a78bfa;font-weight:600">${count} messages</span> from
              <span style="color:${platform.color};font-weight:600">${platform.name}</span>
              <span style="color:#2d2d3a;margin-left:6px">· by</span>
              <span style="color:#7c3aed;font-weight:700;margin-left:3px">@codingbreaker</span>
            </div>
          </div>
          <button id="__hp_x" style="background:#1f2937;border:none;color:#9ca3af;
            width:28px;height:28px;border-radius:8px;cursor:pointer;font-size:14px;
            display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
        </div>

        <div id="__hp_grid" style="display:grid;grid-template-columns:repeat(5,1fr);gap:7px;margin-bottom:14px">
          ${defaultCards}${customCards}${addCard}${restoreBtn}
        </div>

        <!-- Add AI form (hidden by default) -->
        <div id="__hp_addform" style="display:none;background:#0a0a12;border:1px solid #7c3aed55;
          border-radius:10px;padding:12px;margin-bottom:12px">
          <div style="font-size:10px;color:#7c3aed;font-weight:700;text-transform:uppercase;
            letter-spacing:.6px;margin-bottom:8px">Add custom AI</div>
          <div style="display:flex;gap:7px;margin-bottom:7px">
            <input id="__hp_ai_name" placeholder="AI name  e.g. Meta AI" style="
              flex:1;background:#111827;border:1px solid #374151;color:#e2e8f0;
              border-radius:7px;padding:7px 10px;font-size:12px;outline:none;font-family:inherit"/>
            <input id="__hp_ai_url" placeholder="URL  e.g. meta.ai" style="
              flex:1.4;background:#111827;border:1px solid #374151;color:#e2e8f0;
              border-radius:7px;padding:7px 10px;font-size:12px;outline:none;font-family:inherit"/>
          </div>
          <div style="display:flex;gap:7px">
            <button id="__hp_save_ai" style="flex:1;background:#7c3aed;color:#fff;border:none;
              border-radius:7px;padding:8px;font-size:12px;font-weight:700;cursor:pointer">
              Save & Open
            </button>
            <button id="__hp_cancel_add" style="background:#1f2937;border:none;color:#9ca3af;
              border-radius:7px;padding:8px 12px;font-size:12px;cursor:pointer">
              Cancel
            </button>
          </div>
        </div>

        <button id="__hp_copy" style="width:100%;background:#111827;border:1px solid #1f2937;
          color:#9ca3af;border-radius:9px;padding:9px;font-size:12px;font-weight:600;
          cursor:pointer;font-family:inherit">
          📋 Just copy — I'll paste it myself
        </button>
      </div>
    `;
    document.body.appendChild(ov);

    ov.querySelector('#__hp_x').onclick = () => ov.remove();
    ov.onclick = e => { if (e.target === ov) ov.remove(); };

    // AI card clicks
    ov.querySelectorAll('.__hp_card').forEach(card => {
      if (card.style.cursor === 'default') return;
      card.onclick = e => {
        if (e.target.classList.contains('__hp_del')) return;
        ov.remove();
        window.open(card.dataset.url, '_blank');
      };
    });

    // Show × on hover for each card
    ov.querySelectorAll('.__hp_card').forEach(card => {
      const delBtn = card.querySelector('.__hp_del');
      if (!delBtn) return;
      card.onmouseenter = (e) => {
        const color = (AI_LIST.find(a=>a.url===card.dataset.url) || customAIs.find(a=>a.url===card.dataset.url))?.color||'#7c3aed';
        card.style.borderColor = color+'88'; card.style.background = color+'0d'; card.style.transform='translateY(-2px)';
        delBtn.style.opacity = '1';
      };
      card.onmouseleave = () => {
        const color = (AI_LIST.find(a=>a.url===card.dataset.url) || customAIs.find(a=>a.url===card.dataset.url))?.color||'#7c3aed';
        card.style.borderColor = color+'44'; card.style.background = '#0f0f1a'; card.style.transform='';
        delBtn.style.opacity = '0';
      };
    });

    // Delete / hide AI
    ov.querySelectorAll('.__hp_del').forEach(btn => {
      btn.onclick = e => {
        e.stopPropagation();
        const name    = btn.dataset.name;
        const isCustom = btn.dataset.custom === 'true';
        if (isCustom) {
          const updated = customAIs.filter(a => a.name !== name);
          chrome.storage.sync.set({ hoffCustomAIs: updated }, () => {
            _renderPicker(doc, count, updated, hiddenAIs);
          });
        } else {
          const updated = [...hiddenAIs, name];
          chrome.storage.sync.set({ hoffHiddenAIs: updated }, () => {
            _renderPicker(doc, count, customAIs, updated);
          });
        }
      };
    });

    // Restore hidden built-in AIs
    ov.querySelector('#__hp_restore')?.addEventListener('click', () => {
      chrome.storage.sync.set({ hoffHiddenAIs: [] }, () => {
        _renderPicker(doc, count, customAIs, []);
      });
    });

    // "+" Add AI card
    ov.querySelector('#__hp_add_btn').onclick = () => {
      ov.querySelector('#__hp_addform').style.display = 'block';
      ov.querySelector('#__hp_add_btn').style.display = 'none';
      ov.querySelector('#__hp_ai_name').focus();
    };
    ov.querySelector('#__hp_cancel_add').onclick = () => {
      ov.querySelector('#__hp_addform').style.display = 'none';
      ov.querySelector('#__hp_add_btn').style.display = '';
    };

    // Save + open new AI
    ov.querySelector('#__hp_save_ai').onclick = () => {
      let name = ov.querySelector('#__hp_ai_name').value.trim();
      let url  = ov.querySelector('#__hp_ai_url').value.trim();
      if (!name || !url) {
        ov.querySelector('#__hp_ai_name').style.borderColor = !name ? '#f87171' : '#374151';
        ov.querySelector('#__hp_ai_url').style.borderColor  = !url  ? '#f87171' : '#374151';
        return;
      }
      if (!url.startsWith('http')) url = 'https://' + url;
      const color = CUSTOM_COLORS[customAIs.length % CUSTOM_COLORS.length];
      const updated = [...customAIs, { name, url, color }];
      chrome.storage.sync.set({ hoffCustomAIs: updated }, () => {
        ov.remove();
        window.open(url, '_blank');
      });
    };

    // Enter key in form
    ['__hp_ai_name','__hp_ai_url'].forEach(id => {
      ov.querySelector(`#${id}`).onkeydown = e => { if (e.key === 'Enter') ov.querySelector('#__hp_save_ai').click(); };
    });

    // "+" hover
    const addBtn = ov.querySelector('#__hp_add_btn');
    addBtn.onmouseenter = () => { addBtn.style.borderColor = '#7c3aed'; addBtn.style.color = '#7c3aed'; addBtn.querySelector('span').style.color = '#7c3aed'; };
    addBtn.onmouseleave = () => { addBtn.style.borderColor = '#374151'; addBtn.style.color = '#4b5563'; addBtn.querySelector('span').style.color = '#6b7280'; };

    // Copy fallback
    ov.querySelector('#__hp_copy').onclick = () => {
      navigator.clipboard.writeText(doc)
        .then(() => { ov.querySelector('#__hp_copy').textContent = '✅ Copied! Paste it in any AI chat.'; setTimeout(() => ov.remove(), 1800); })
        .catch(() => { showModal(doc, `Handoff — ${count} messages`); ov.remove(); });
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  HANDOFF BANNER (arriving on destination AI)
  // ══════════════════════════════════════════════════════════════════
  function waitAndShowBanner(doc, count) {
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      const inp = findInput();
      if (inp) { clearInterval(iv); showBanner(inp, doc, count); }
      if (tries > 40) { clearInterval(iv); showBanner(null, doc, count); }
    }, 500);
  }

  function findInput() {
    const sels = [
      '#prompt-textarea',
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][data-virtualkeyboard-exclusion]',
      'div[contenteditable="true"][spellcheck]',
      'div[contenteditable="true"]',
      'textarea[data-id]',
      'textarea[placeholder*="message" i]',
      'textarea[placeholder*="Ask" i]',
      'textarea[placeholder*="Type" i]',
      'textarea:not([readonly]):not([style*="display: none"])',
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled) return el;
    }
    return null;
  }

  function showBanner(inputEl, doc, count) {
    document.getElementById('__hoff_banner')?.remove();

    chrome.storage.local.get('handoff_from', ({ handoff_from }) => {
      const fromName = handoff_from || 'AI';
      const banner = document.createElement('div');
      banner.id = '__hoff_banner';
      Object.assign(banner.style, {
        position:'fixed', bottom:'80px', right:'16px',
        zIndex:'2147483647', background:'#0d0d1aee',
        border:`1px solid ${platform.color}55`,
        backdropFilter:'blur(12px)', color:'#e2e8f0',
        borderRadius:'16px', padding:'16px 18px',
        fontFamily:'system-ui,-apple-system,sans-serif',
        fontSize:'13px', boxShadow:`0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${platform.color}22`,
        width:'260px',
      });

      banner.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:7px">
            <span style="font-size:18px">🔀</span>
            <div>
              <div style="font-size:12px;font-weight:800;color:#e2e8f0">Context ready!</div>
              <div style="font-size:10px;color:#6b7280;margin-top:1px">from <span style="color:#a78bfa">${fromName}</span> · <span style="color:#a78bfa;font-weight:600">${count} msgs</span></div>
            </div>
          </div>
          <button id="__hb_x" style="background:#1f2937;border:none;color:#6b7280;
            width:22px;height:22px;border-radius:6px;cursor:pointer;font-size:12px;
            display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
        </div>
        <button id="__hb_inject" style="width:100%;background:linear-gradient(135deg,${platform.color},${platform.color}99);
          color:#fff;border:none;border-radius:10px;padding:10px;font-size:13px;font-weight:700;
          cursor:pointer;font-family:inherit;margin-bottom:6px;display:flex;align-items:center;
          justify-content:center;gap:6px">
          ⚡ Inject Context
        </button>
        <button id="__hb_copy" style="width:100%;background:#111827;border:1px solid #1f2937;
          color:#9ca3af;border-radius:8px;padding:7px;font-size:11px;font-weight:600;
          cursor:pointer;font-family:inherit">
          📋 Copy instead
        </button>
      `;
      document.body.appendChild(banner);

      // Keep banner alive — SPA re-renders can remove body children
      let _alive = true;
      const _keepAlive = setInterval(() => {
        if (!_alive) return;
        if (!document.body.contains(banner)) document.body.appendChild(banner);
      }, 800);

      // clearStorage: remove handoff data so banner won't re-trigger elsewhere
      const clearStorage = () => chrome.storage.local.remove(['handoff_doc','handoff_ts','handoff_count','handoff_from']);

      // dismiss: stop keepAlive + remove banner from DOM
      const dismiss = (andClearStorage = true) => {
        _alive = false;
        clearInterval(_keepAlive);
        banner.remove();
        if (andClearStorage) clearStorage();
      };

      banner.querySelector('#__hb_x').onclick = () => dismiss();

      banner.querySelector('#__hb_inject').onclick = () => {
        const btn = banner.querySelector('#__hb_inject');
        btn.innerHTML = '⏳ Injecting…'; btn.disabled = true;

        const inp = findInput();
        clearStorage();

        if (!inp) {
          navigator.clipboard.writeText(doc).then(() => {
            btn.innerHTML = '📋 Copied — press Ctrl+V';
            setTimeout(() => dismiss(false), 2500);
          }).catch(() => { btn.innerHTML = '❌ Paste manually'; setTimeout(() => dismiss(false), 2500); });
          return;
        }

        const ok = injectText(inp, doc);

        if (ok) {
          btn.innerHTML = '✅ Done! Press Enter ↵';
          btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
          setTimeout(() => dismiss(false), 2000);
        } else {
          navigator.clipboard.writeText(doc).then(() => {
            btn.innerHTML = '📋 Copied — press Ctrl+V';
            setTimeout(() => dismiss(false), 2500);
          }).catch(() => { btn.innerHTML = '❌ Paste manually'; setTimeout(() => dismiss(false), 2500); });
        }
      };

      banner.querySelector('#__hb_copy').onclick = () => {
        navigator.clipboard.writeText(doc).then(() => {
          banner.querySelector('#__hb_copy').textContent = '✅ Copied!';
          clearStorage();
          setTimeout(() => dismiss(false), 1800);
        });
      };
    });
  }

  // ══════════════════════════════════════════════════════════════════
  //  INJECT TEXT (no clipboard = no file conversion)
  // ══════════════════════════════════════════════════════════════════
  function injectText(el, text) {
    try {
      el.focus();

      if (el.tagName === 'TEXTAREA') {
        // React textarea — use native setter so React state updates
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
        if (setter) setter.call(el, text); else el.value = text;
        el.dispatchEvent(new Event('input',  { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return el.value.length > 20;
      }

      if (el.contentEditable === 'true') {
        // 1. Clear existing content safely
        while (el.firstChild) el.removeChild(el.firstChild);

        // 2. Try execCommand (works in most contenteditable)
        const ok = document.execCommand('insertText', false, text);
        if (ok && (el.innerText || '').trim().length > 20) return true;

        // 3. Fallback: set textContent + fire InputEvent (React/Lexical/ProseMirror)
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
        el.dispatchEvent(new Event('change', { bubbles: true }));

        // 4. If still empty (Gemini / some ProseMirror) — try inserting a text node
        if ((el.innerText || '').trim().length < 20) {
          el.innerHTML = '';
          const node = document.createTextNode(text);
          el.appendChild(node);
          el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
        }

        return (el.innerText || '').trim().length > 20;
      }

      return false;
    } catch(e) { return false; }
  }

  // ══════════════════════════════════════════════════════════════════
  //  DEBUG
  // ══════════════════════════════════════════════════════════════════
  function showDebug() {
    const turns = extractMessages();
    const report = `=== AI HANDOFF DEBUG ===\nPlatform: ${platform.name} (${host})\nMessages found: ${turns.length}\n\n`+
      turns.slice(0,4).map((t,i)=>`[${i}] ${t.role}: ${t.text.slice(0,100)}…`).join('\n\n');
    showModal(report, 'Debug Report');
  }

  // ══════════════════════════════════════════════════════════════════
  //  MODAL
  // ══════════════════════════════════════════════════════════════════
  function showModal(text, title) {
    document.getElementById('__hoff_modal')?.remove();
    const ov=document.createElement('div'); ov.id='__hoff_modal';
    Object.assign(ov.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.65)',zIndex:'2147483646',display:'flex',alignItems:'center',justifyContent:'center'});
    ov.innerHTML=`<div style="background:#1e1e2e;color:#cdd6f4;border-radius:14px;padding:22px;width:700px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;gap:10px;font-family:system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
      <div style="display:flex;justify-content:space-between;align-items:center"><strong style="font-size:14px">${title}</strong><button id="__hm_x" style="background:#313244;border:none;color:#cdd6f4;padding:4px 11px;border-radius:6px;cursor:pointer">✕</button></div>
      <textarea id="__hm_ta" style="flex:1;min-height:360px;background:#11111b;color:#cdd6f4;border:1px solid #45475a;border-radius:8px;padding:10px;font-size:12px;font-family:monospace;resize:vertical" readonly></textarea>
      <button id="__hm_cp" style="background:#7c3aed;color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">📋 Copy</button>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#__hm_ta').value = text;
    ov.querySelector('#__hm_x').onclick=()=>ov.remove();
    ov.onclick=e=>{if(e.target===ov)ov.remove();};
    ov.querySelector('#__hm_ta').onfocus=function(){this.select();};
    ov.querySelector('#__hm_cp').onclick=()=>{
      navigator.clipboard.writeText(text).then(()=>ov.querySelector('#__hm_cp').textContent='✅ Copied!')
        .catch(()=>{ov.querySelector('#__hm_ta').select();document.execCommand('copy');ov.querySelector('#__hm_cp').textContent='✅ Copied!';});
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  TOAST
  // ══════════════════════════════════════════════════════════════════
  function toast(text, ok=true) {
    document.querySelectorAll('.__hoff_toast').forEach(t=>t.remove());
    const t=document.createElement('div'); t.className='__hoff_toast';
    t.textContent=text;
    Object.assign(t.style,{position:'fixed',bottom:'70px',left:'50%',transform:'translateX(-50%)',
      zIndex:'2147483647',background:ok?'#14532d':'#7f1d1d',color:'#fff',
      padding:'10px 20px',borderRadius:'10px',fontSize:'13px',fontWeight:'500',
      boxShadow:'0 4px 20px rgba(0,0,0,0.4)',fontFamily:'system-ui,sans-serif',
      whiteSpace:'nowrap',transition:'opacity .4s',
    });
    document.body.appendChild(t);
    setTimeout(()=>{t.style.opacity='0';setTimeout(()=>t.remove(),400);},3500);
  }

})();
