// AI Handoff — content.js (Claude.ai only)
// Handles: conversation extraction + popup messaging
// Export pill is handled by universal_inject.js
// @codingbreaker | github.com/codingbreaker

(function () {
  'use strict';

  // ── Message listener (from popup + universal_inject) ──────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === 'export')   { runHandoff(false); sendResponse({ ok: true }); }
    if (msg.action === 'debug')    { runHandoff(true);  sendResponse({ ok: true }); }
    return true;
  });

  // ══════════════════════════════════════════════════════════════════
  //  TOAST
  // ══════════════════════════════════════════════════════════════════
  function toast(text, ok = true) {
    document.querySelectorAll('.__hoff_toast').forEach(t => t.remove());
    const t = document.createElement('div');
    t.className = '__hoff_toast';
    t.textContent = text;
    Object.assign(t.style, {
      position: 'fixed', bottom: '80px', left: '50%',
      transform: 'translateX(-50%)', zIndex: '2147483647',
      background: ok ? '#14532d' : '#7f1d1d', color: '#fff',
      padding: '10px 20px', borderRadius: '10px', fontSize: '13px',
      fontWeight: '500', boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
      fontFamily: 'system-ui,sans-serif', whiteSpace: 'nowrap',
      transition: 'opacity .4s',
    });
    document.body.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 400); }, 3500);
  }

  // ══════════════════════════════════════════════════════════════════
  //  EXTRACTION
  // ══════════════════════════════════════════════════════════════════
  function yPos(el) { let y=0,n=el; while(n&&n!==document.body){y+=n.offsetTop||0;n=n.offsetParent;} return y; }

  function cleanEl(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('button,svg,[aria-hidden],style,script,noscript').forEach(n => n.remove());
    return c.innerText.replace(/\n{3,}/g, '\n\n').trim();
  }

  function dedup(arr) {
    const s = new Set();
    return arr.filter(t => { const k=t.text.slice(0,80); if(s.has(k)||t.text.length<5)return false; s.add(k); return true; });
  }

  function s1() { const t=[]; document.querySelectorAll('[data-testid="human-turn"]').forEach(e=>t.push({role:'USER',text:cleanEl(e),y:yPos(e)})); document.querySelectorAll('[data-testid="ai-turn"]').forEach(e=>t.push({role:'CLAUDE',text:cleanEl(e),y:yPos(e)})); return t; }
  function s2() { return Array.from(document.querySelectorAll('[data-message-author-role]')).map(e=>({role:e.getAttribute('data-message-author-role')==='human'?'USER':'CLAUDE',text:cleanEl(e),y:yPos(e)})); }
  function s3() { const t=[]; document.querySelectorAll('article,[class*="group"],[class*="message"],[class*="turn"]').forEach(e=>{ const text=cleanEl(e); if(text.length<8)return; const hasEdit=e.querySelector('[aria-label*="dit"i]'); const hasCopy=e.querySelector('[aria-label*="opy"i]'); if(!hasEdit&&!hasCopy)return; t.push({role:hasEdit?'USER':'CLAUDE',text,y:yPos(e)}); }); return t; }
  function s4() { const t=[]; document.querySelectorAll('[class*="font-claude"]').forEach(e=>{ const b=e.closest('article')||e.closest('[class*="group"]')||e; const text=cleanEl(b); if(text.length>8)t.push({role:'CLAUDE',text,y:yPos(b)}); }); document.querySelectorAll('[class*="user-message"],[class*="UserMessage"],[class*="human"]').forEach(e=>{ const text=cleanEl(e); if(text.length>4)t.push({role:'USER',text,y:yPos(e)}); }); return t; }
  function s5() { const main=document.querySelector('main')||document.body; const t=[],seen=new Set(); const w=document.createTreeWalker(main,NodeFilter.SHOW_ELEMENT,{acceptNode(n){return['SCRIPT','STYLE','BUTTON','SVG','INPUT','TEXTAREA'].includes(n.tagName)?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT;}}); while(w.nextNode()){const el=w.currentNode;const text=el.innerText?.trim()||'';if(text.length<30)continue;const bc=el.querySelector('p,pre,ul,ol');if(bc&&(bc.innerText?.trim().length||0)>text.length*.8)continue;if(seen.has(text.slice(0,100)))continue;seen.add(text.slice(0,100));const s=window.getComputedStyle(el);t.push({role:s.textAlign==='right'||el.className?.match?.(/\buser\b|\bhuman\b/i)?'USER':'CLAUDE',text,y:yPos(el)});} return t; }
  function s6() { const main=document.querySelector('main')||document.body;const g=[],seen=new Set();let cur=null;main.querySelectorAll('p,pre,li,h1,h2,h3,blockquote').forEach(el=>{const text=el.innerText?.trim()||'';if(text.length<10||seen.has(text.slice(0,60)))return;seen.add(text.slice(0,60));const y=yPos(el);if(!cur||y-cur.lastY>200){if(cur)g.push(cur);cur={role:'UNKNOWN',parts:[text],y,lastY:y};}else{cur.parts.push(text);cur.lastY=y;}});if(cur)g.push(cur);return g.map(x=>({role:x.role,text:x.parts.join('\n'),y:x.y})); }

  function extractAll() {
    const fns = [s1, s2, s3, s4, s5, s6];
    let best = [], strat = 0;
    // Run ALL strategies, pick the one that found the MOST messages
    for (let i = 0; i < fns.length; i++) {
      try {
        const r = dedup(fns[i]().sort((a, b) => a.y - b.y));
        if (r.length > best.length) { best = r; strat = i + 1; }
      } catch (_) {}
    }
    // If still empty, merge all results
    if (best.length === 0) {
      let m = [];
      fns.forEach(fn => { try { m = m.concat(fn()); } catch (_) {} });
      best = dedup(m.sort((a, b) => a.y - b.y));
      strat = 99;
    }
    return { turns: best, strategy: strat };
  }

  // ══════════════════════════════════════════════════════════════════
  //  COMPRESSION
  // ══════════════════════════════════════════════════════════════════
  function compress(turns) {
    const rawLen = turns.reduce((s,t)=>s+t.text.length,0);
    if(rawLen<=14000||turns.length<=12) return {turns,compressed:false};
    const first=turns.slice(0,2), mid=turns.slice(2,-10), last=turns.slice(-10);
    const summary={role:'SUMMARY',y:mid[0]?.y||0,text:`[${mid.length} EARLIER MESSAGES SUMMARIZED]\n`+mid.map((t,i)=>`  [${i+3}] ${t.role==='USER'?'User':'AI'}: ${t.text.slice(0,120).replace(/\n/g,' ')}…`).join('\n')+'\n[END SUMMARY]'};
    return {turns:[...first,summary,...last],compressed:true,original:turns.length};
  }

  // ══════════════════════════════════════════════════════════════════
  //  BUILD DOC
  // ══════════════════════════════════════════════════════════════════
  function buildDoc(turns,strategy) {
    const {turns:final,compressed,original}=compress(turns);
    const title=document.title.replace(/\s*[-–|].*$/,'').trim()||'Claude Conversation';
    const sep='─'.repeat(58);
    let history='';
    final.forEach(({role,text},i)=>{
      const label=role==='USER'?'👤 USER':role==='CLAUDE'?'🤖 CLAUDE':role==='SUMMARY'?'📝 SUMMARY':`TURN ${i+1}`;
      history+=`### ${label}\n\n${text}\n\n${sep}\n\n`;
    });
    return `═══════════════════════════════════════════════════════════
  AI HANDOFF DOCUMENT
  Source   : Claude.ai
  Topic    : ${title}
  Exported : ${new Date().toLocaleString('en-US')}
  Messages : ${turns.length} total${compressed?` (${original-final.length+1} mid summarized)`:''}
═══════════════════════════════════════════════════════════

┌─ INSTRUCTIONS ─────────────────────────────────────────┐
│  Continuing from Claude AI. Read everything below:     │
│  1. Confirm task/project (1-2 lines).                  │
│  2. State the EXACT next step.                         │
│  3. Continue — don't re-explain done work.            │
└────────────────────────────────────────────────────────┘

${sep}

${history}${sep}

— AI Handoff | @codingbreaker | github.com/codingbreaker
`;
  }

  // ══════════════════════════════════════════════════════════════════
  //  DEBUG
  // ══════════════════════════════════════════════════════════════════
  function debugReport() {
    const checks=[['[data-testid="human-turn"]',document.querySelectorAll('[data-testid="human-turn"]').length],['[data-testid="ai-turn"]',document.querySelectorAll('[data-testid="ai-turn"]').length],['[data-message-author-role]',document.querySelectorAll('[data-message-author-role]').length],['[class*="font-claude"]',document.querySelectorAll('[class*="font-claude"]').length],['article',document.querySelectorAll('article').length]];
    const {turns,strategy}=extractAll();
    return `=== DEBUG ===\nPlatform: Claude.ai\nStrategy: ${strategy}\nFound: ${turns.length} messages\n\nSelectors:\n`+checks.map(([k,v])=>`${v>0?'✅':'❌'} ${k}: ${v}`).join('\n')+`\n\nSamples:\n`+turns.slice(0,3).map((t,i)=>`[${i}] ${t.role}: ${t.text.slice(0,120)}…`).join('\n\n');
  }

  // ══════════════════════════════════════════════════════════════════
  //  MODAL
  // ══════════════════════════════════════════════════════════════════
  function showModal(text, title) {
    document.getElementById('__hoff_modal')?.remove();
    const ov=document.createElement('div');ov.id='__hoff_modal';
    Object.assign(ov.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,0.65)',zIndex:'2147483646',display:'flex',alignItems:'center',justifyContent:'center'});
    ov.innerHTML=`<div style="background:#1e1e2e;color:#cdd6f4;border-radius:14px;padding:22px;width:700px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;gap:10px;font-family:system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,0.5)"><div style="display:flex;justify-content:space-between;align-items:center"><strong>${title}</strong><button id="__hm_x" style="background:#313244;border:none;color:#cdd6f4;padding:4px 11px;border-radius:6px;cursor:pointer">✕</button></div><textarea id="__hm_ta" style="flex:1;min-height:360px;background:#11111b;color:#cdd6f4;border:1px solid #45475a;border-radius:8px;padding:10px;font-size:12px;font-family:monospace;resize:vertical" readonly></textarea><button id="__hm_cp" style="background:#7c3aed;color:#fff;border:none;padding:10px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:700">📋 Copy</button></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#__hm_ta').value=text;
    ov.querySelector('#__hm_x').onclick=()=>ov.remove();
    ov.onclick=e=>{if(e.target===ov)ov.remove();};
    ov.querySelector('#__hm_ta').onfocus=function(){this.select();};
    ov.querySelector('#__hm_cp').onclick=()=>{ navigator.clipboard.writeText(text).then(()=>ov.querySelector('#__hm_cp').textContent='✅ Copied!').catch(()=>{ov.querySelector('#__hm_ta').select();document.execCommand('copy');ov.querySelector('#__hm_cp').textContent='✅ Copied!';});};
  }

  // ══════════════════════════════════════════════════════════════════
  //  MAIN
  // ══════════════════════════════════════════════════════════════════
  function runHandoff(debugMode) {
    if (debugMode) { showModal(debugReport(), 'Debug Report'); return; }
    const {turns,strategy}=extractAll();
    if(turns.length===0){toast('No messages found — scroll to load full conversation first',false);return;}
    const doc=buildDoc(turns,strategy);
    chrome.storage.local.set({handoff_doc:doc,handoff_ts:Date.now(),handoff_count:turns.length});
    navigator.clipboard.writeText(doc)
      .then(()=>toast(`✅ ${turns.length} messages exported! Switch to any AI.`))
      .catch(()=>showModal(doc,`Handoff Ready — ${turns.length} messages`));
  }

})();
