// token_counter.js — Token counter for ALL AI platforms
// @codingbreaker

(function () {
  'use strict';

  const PLATFORMS = {
    'claude.ai':             { name: 'Claude',     ctx: 200000,   color: '#d97706' },
    'chatgpt.com':           { name: 'ChatGPT',    ctx: 128000,   color: '#10a37f' },
    'chat.openai.com':       { name: 'ChatGPT',    ctx: 128000,   color: '#10a37f' },
    'gemini.google.com':     { name: 'Gemini',     ctx: 1000000,  color: '#4285f4' },
    'grok.com':              { name: 'Grok',       ctx: 131072,   color: '#1d9bf0' },
    'x.com':                 { name: 'Grok',       ctx: 131072,   color: '#1d9bf0' },
    'perplexity.ai':         { name: 'Perplexity', ctx: 200000,   color: '#20b2aa' },
    'copilot.microsoft.com': { name: 'Copilot',    ctx: 128000,   color: '#0078d4' },
    'chat.deepseek.com':     { name: 'DeepSeek',   ctx: 128000,   color: '#4d6bfe' },
    'chat.mistral.ai':       { name: 'Mistral',    ctx: 128000,   color: '#ff6b35' },
    'poe.com':               { name: 'Poe',        ctx: 200000,   color: '#9333ea' },
    'you.com':               { name: 'You.com',    ctx: 200000,   color: '#ff4f00' },
    'meta.ai':               { name: 'Meta AI',    ctx: 128000,   color: '#0081fb' },
  };

  const host = location.hostname.replace('www.', '');
  const P    = PLATFORMS[host] || { name: host, ctx: 128000, color: '#7c3aed' };

  // ── State ──────────────────────────────────────────────────────────────────
  const S = {
    used: 0, isReal: false,
    pct5h: null, pct7d: null,
    reset5h: null, reset7d: null,
    cachedUntil: null,
  };

  const CFG_DEFAULTS = {
    showTokenCounter: true,
    showWindowBadges: true,
    showCacheTimer: true,
    showResetTime: true,
    showEstLabel: true,
    opacity: 88,
  };
  let CFG = { ...CFG_DEFAULTS };

  chrome.storage.sync.get('hoffSettings', ({ hoffSettings }) => {
    CFG = { ...CFG_DEFAULTS, ...(hoffSettings || {}) };
    if (CFG.showTokenCounter) boot();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync' || !changes.hoffSettings) return;
    const prev = CFG.showTokenCounter;
    CFG = { ...CFG_DEFAULTS, ...(changes.hoffSettings.newValue || {}) };
    if (!CFG.showTokenCounter) { removePill(); }
    else if (!prev) { boot(); }
    else { renderPill(); }
  });

  // ══════════════════════════════════════════════════════════════════
  //  BOOT
  // ══════════════════════════════════════════════════════════════════
  function boot() {
    injectBridge();
    listenBridge();
    placePill();
    watchDOM();

    // Re-inject pill if SPA removes it; tick countdown timers every 60s
    setInterval(() => {
      if (!CFG.showTokenCounter) return;
      if (!document.getElementById('__hoff_counter')) placePill();
    }, 1500);
    setInterval(() => {
      if (S.reset5h || S.reset7d || S.cachedUntil) renderPill();
    }, 60000);
  }

  // ── MutationObserver: re-estimate when messages change ─────────────────────
  let _renderTimer = null;
  function watchDOM() {
    const target = document.querySelector('main,[role="main"]') || document.body;
    const obs = new MutationObserver(() => {
      if (S.isReal) return;
      clearTimeout(_renderTimer);
      _renderTimer = setTimeout(renderPill, 300);
    });
    obs.observe(target, { childList: true, subtree: true, characterData: true });
  }


  // ══════════════════════════════════════════════════════════════════
  //  BRIDGE
  // ══════════════════════════════════════════════════════════════════
  function injectBridge() {
    if (document.getElementById('__hoff_bridge')) return;
    const s = document.createElement('script');
    s.id  = '__hoff_bridge';
    s.src = chrome.runtime.getURL('token_bridge.js');
    s.onload = () => s.remove();
    (document.head || document.documentElement).prepend(s);
  }

  function listenBridge() {
    window.addEventListener('__hoff_data', ({ detail: { type, data } = {} }) => {
      if (!type) return;
      if (type === 'hoff:claude_usage') {
        const w5 = data?.five_hour, w7 = data?.seven_day;
        if (w5?.utilization != null) { S.pct5h = Math.round(w5.utilization);  S.reset5h = w5.resets_at ? Date.parse(w5.resets_at) : null; }
        if (w7?.utilization != null) { S.pct7d = Math.round(w7.utilization);  S.reset7d = w7.resets_at ? Date.parse(w7.resets_at) : null; }
      } else if (type === 'hoff:claude_message_limit') {
        const wds = data?.windows || {};
        if (wds['5h']) { S.pct5h = Math.round((wds['5h'].utilization||0)*100); S.reset5h = wds['5h'].resets_at ? new Date(wds['5h'].resets_at*1000).getTime() : null; }
        if (wds['7d']) { S.pct7d = Math.round((wds['7d'].utilization||0)*100); S.reset7d = wds['7d'].resets_at ? new Date(wds['7d'].resets_at*1000).getTime() : null; }
      } else if (type === 'hoff:claude_conversation') {
        computeClaudeTokens(data?.data).then(r => { S.used = r.tokens; S.isReal = (r.tokens > 0); S.cachedUntil = r.cachedUntil; renderPill(); });
        return;
      } else if (type === 'hoff:chatgpt_usage') {
        const t = data?.total_tokens || (data?.prompt_tokens ? data.prompt_tokens + (data.completion_tokens||0) : 0);
        if (t) { S.used = t; S.isReal = true; }
      } else if (type === 'hoff:gemini_usage') {
        const t = data?.totalTokenCount || (data?.promptTokenCount ? data.promptTokenCount + (data.candidatesTokenCount||0) : 0);
        if (t) { S.used = t; S.isReal = true; }
      } else if (type === 'hoff:deepseek_usage') {
        const t = data?.prompt_tokens ? data.prompt_tokens + (data.completion_tokens||0) : 0;
        if (t) { S.used = t; S.isReal = true; }
      } else if (type === 'hoff:perplexity_usage') {
        if (data?.remaining_tokens != null) { S.used = Math.max(0, P.ctx - data.remaining_tokens); S.isReal = true; }
      } else if (type === 'hoff:urlchange') {
        S.used = 0; S.isReal = false; S.cachedUntil = null;
      } else { return; }
      renderPill(); // immediate re-render on every bridge event
    });
  }

  // ══════════════════════════════════════════════════════════════════
  //  CLAUDE TOKENIZER
  // ══════════════════════════════════════════════════════════════════
  let tokReady = false;
  function ensureTok() {
    if (tokReady) return Promise.resolve();
    return new Promise(res => {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('o200k_base.js');
      s.onload = () => { tokReady = true; res(); };
      (document.head || document.documentElement).appendChild(s);
    });
  }

  async function computeClaudeTokens(conv) {
    if (!conv?.chat_messages) return { tokens: 0, cachedUntil: null };
    await ensureTok();
    const tok = window.GPTTokenizer_o200k_base;
    const byId = new Map((conv.chat_messages || []).map(m => [m.uuid, m]));
    const trunk = [];
    let cur = conv.current_leaf_message_uuid;
    const ROOT = '00000000-0000-4000-8000-000000000000';
    while (cur && cur !== ROOT) { const m = byId.get(cur); if (!m) break; trunk.unshift(m); cur = m.parent_message_uuid; }
    let total = 0, lastMs = null;
    for (const msg of trunk) {
      const parts = [];
      for (const item of (msg.content || [])) {
        if (item.type === 'text') parts.push(item.text || '');
        else if (item.type === 'tool_use')    parts.push(JSON.stringify({ id: item.id, name: item.name, input: item.input }));
        else if (item.type === 'tool_result') parts.push(JSON.stringify({ tool_use_id: item.tool_use_id, content: item.content }));
      }
      for (const a of (msg.attachments || [])) if (a.extracted_content) parts.push(a.extracted_content);
      const txt = parts.join('\n');
      total += tok?.countTokens ? tok.countTokens(txt) : Math.round(txt.length / 3.8);
      if (msg.sender === 'assistant' && msg.created_at) {
        const ms = Date.parse(msg.created_at);
        if (!lastMs || ms > lastMs) lastMs = ms;
      }
    }
    return { tokens: total, cachedUntil: lastMs ? lastMs + 5 * 60 * 1000 : null };
  }

  // ══════════════════════════════════════════════════════════════════
  //  ESTIMATE (fallback — only message nodes, not whole page)
  // ══════════════════════════════════════════════════════════════════
  function estimateFromMessages() {
    const sels = [
      '[data-testid="human-turn"],[data-testid="ai-turn"]',
      '[data-message-author-role]',
      'article',
      '[class*="message-content"],[class*="MessageContent"]',
    ];
    for (const sel of sels) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        let chars = 0;
        els.forEach(el => { chars += (el.innerText || '').length; });
        return Math.round(chars / 3.8);
      }
    }
    // last resort: main area * 0.5 heuristic
    const main = document.querySelector('main,[role="main"]') || document.body;
    return Math.round((main.innerText || '').length * 0.5 / 3.8);
  }

  function removePill() {
    document.getElementById('__hoff_counter')?.remove();
  }

  function placePill() {
    if (!CFG.showTokenCounter) return;
    let pill = document.getElementById('__hoff_counter');
    if (!pill) pill = makePill();
    if (pill.parentElement !== document.body) document.body.appendChild(pill);
    pill.style.opacity = `${CFG.opacity / 100}`;
    renderPill();
  }

  function makePill() {
    const pill = document.createElement('div');
    pill.id = '__hoff_counter';
    Object.assign(pill.style, {
      position:       'fixed',
      bottom:         '62px',
      right:          '14px',
      zIndex:         '2147483646',
      background:     '#0d0d1aee',
      border:         `1px solid ${P.color}33`,
      color:          '#e2e8f0',
      fontFamily:     'system-ui,-apple-system,sans-serif',
      padding:        '7px 11px',
      borderRadius:   '10px',
      boxShadow:      '0 2px 12px rgba(0,0,0,0.35)',
      backdropFilter: 'blur(8px)',
      userSelect:     'none',
      cursor:         'default',
      transition:     'opacity .2s',
      minWidth:       '160px',
      maxWidth:       '220px',
    });
    pill.onmouseenter = () => { pill.style.opacity = '1'; };
    pill.onmouseleave = () => { pill.style.opacity = `${CFG.opacity / 100}`; };
    return pill;
  }

  // ══════════════════════════════════════════════════════════════════
  //  RENDER
  // ══════════════════════════════════════════════════════════════════
  function fmt(n) { return n >= 1000000 ? `${(n/1000000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n); }
  function barColor(pct) { return pct > 85 ? '#f87171' : pct > 65 ? '#fbbf24' : P.color; }
  function countdown(ms) {
    if (!ms) return null;
    const d = ms - Date.now(); if (d <= 0) return 'now';
    const m = Math.floor(d / 60000); if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60), rm = m % 60; if (h < 24) return `${h}h${rm ? ` ${rm}m` : ''}`;
    const dy = Math.floor(h / 24), rh = h % 24; return `${dy}d${rh ? ` ${rh}h` : ''}`;
  }

  function renderPill() {
    const pill = document.getElementById('__hoff_counter');
    if (!pill) return;

    const used  = S.isReal ? S.used : estimateFromMessages();
    const left  = Math.max(0, P.ctx - used);
    const pct   = Math.min(100, Math.round(used / P.ctx * 100));
    const bc    = barColor(pct);

    // Window badges (Claude 5h / 7d)
    let badges = '';
    if (CFG.showWindowBadges) {
      if (S.pct5h != null) {
        const c  = barColor(S.pct5h);
        const cd = CFG.showResetTime ? countdown(S.reset5h) : null;
        badges += `<span style="background:#1a1a2e;border:1px solid ${c}55;border-radius:5px;padding:2px 7px;font-size:10px;color:${c};font-weight:600">5h ${S.pct5h}%${cd ? ` ↺${cd}` : ''}</span>`;
      }
      if (S.pct7d != null) {
        const c  = barColor(S.pct7d);
        const cd = CFG.showResetTime ? countdown(S.reset7d) : null;
        badges += `<span style="background:#1a1a2e;border:1px solid ${c}55;border-radius:5px;padding:2px 7px;font-size:10px;color:${c};font-weight:600;margin-left:4px">7d ${S.pct7d}%${cd ? ` ↺${cd}` : ''}</span>`;
      }
    }

    // Cache timer
    let cacheHtml = '';
    if (CFG.showCacheTimer && S.cachedUntil && host === 'claude.ai') {
      const cd = countdown(S.cachedUntil);
      if (cd && cd !== 'now') cacheHtml = `<span style="color:#818cf8;font-size:10px;margin-left:5px">⚡${cd}</span>`;
    }

    const estLabel = (!S.isReal && CFG.showEstLabel)
      ? `<span style="color:#374151;font-size:9px;margin-left:3px">~est</span>` : '';

    pill.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
        <span style="width:7px;height:7px;border-radius:50%;background:${bc};flex-shrink:0;transition:background .3s"></span>
        <span style="font-size:12px;font-weight:700;color:${P.color}">${P.name}</span>
        <span style="color:#374151;font-size:11px">|</span>
        <span style="font-size:12px">
          <span style="color:#a78bfa;font-weight:600">${fmt(used)}</span><span style="color:#4b5563;font-size:10px"> used</span>
          <span style="color:#374151;font-size:10px"> · </span>
          <span style="color:${pct>85?'#f87171':pct>65?'#fbbf24':'#4ade80'};font-weight:600">${fmt(left)}</span><span style="color:#4b5563;font-size:10px"> left</span>
        </span>
        <span style="background:#1a1a2e;border:1px solid ${bc}55;border-radius:5px;padding:2px 7px;font-size:10px;color:${bc};font-weight:700">${pct}%</span>
        ${estLabel}${badges}${cacheHtml}
      </div>
      <div style="height:3px;background:#1a1a2e;border-radius:99px;margin-top:6px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${bc};border-radius:99px;transition:width .6s,background .3s"></div>
      </div>
    `;
  }

})();
