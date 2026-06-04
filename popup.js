// popup.js — @codingbreaker

const PLATFORMS = {
  'claude.ai':             { name:'Claude',     ctx:200000,   color:'#d97706' },
  'chatgpt.com':           { name:'ChatGPT',    ctx:128000,   color:'#10a37f' },
  'chat.openai.com':       { name:'ChatGPT',    ctx:128000,   color:'#10a37f' },
  'gemini.google.com':     { name:'Gemini',     ctx:1000000,  color:'#4285f4' },
  'grok.com':              { name:'Grok',       ctx:131072,   color:'#1d9bf0' },
  'x.com':                 { name:'Grok',       ctx:131072,   color:'#1d9bf0' },
  'perplexity.ai':         { name:'Perplexity', ctx:200000,   color:'#20b2aa' },
  'copilot.microsoft.com': { name:'Copilot',    ctx:128000,   color:'#0078d4' },
  'chat.deepseek.com':     { name:'DeepSeek',   ctx:128000,   color:'#4d6bfe' },
  'chat.mistral.ai':       { name:'Mistral',    ctx:128000,   color:'#ff6b35' },
  'poe.com':               { name:'Poe',        ctx:200000,   color:'#9333ea' },
  'you.com':               { name:'You.com',    ctx:200000,   color:'#ff4f00' },
};

function fmt(n) { return n>=1000000?`${(n/1000000).toFixed(1)}M`:n>=1000?`${(n/1000).toFixed(1)}k`:String(n); }
function setStatus(t,c='#6b7280'){document.getElementById('status-msg').style.color=c;document.getElementById('status-msg').textContent=t;}

// ── Tabs ──────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ── Current tab detection ─────────────────────────────────────────────────
chrome.tabs.query({ active:true, currentWindow:true }, ([tab]) => {
  if (!tab) return;
  const hostname = (() => { try { return new URL(tab.url).hostname.replace('www.',''); } catch{ return ''; } })();
  const P = PLATFORMS[hostname];

  const badge = document.getElementById('site-badge');
  if (P) {
    badge.textContent = `${P.name} ✓`;
    badge.className   = 'badge green';
    badge.style.borderColor = P.color + '66';
    badge.style.color = P.color;
    loadTokenStats(tab.id, hostname, P);
  } else if (tab.url?.startsWith('http')) {
    badge.textContent = hostname || 'Unknown';
    badge.className   = 'badge gray';
  }

  // Enable export only on supported AI sites
  const exportBtn = document.getElementById('export-btn');
  if (!P) { exportBtn.disabled=true; exportBtn.style.opacity='.4'; }
});

// ── Token stats ───────────────────────────────────────────────────────────
function loadTokenStats(tabId, hostname, P) {
  // Get live data from token_counter.js state via executeScript
  chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Read from token counter's injected pill
      const pill = document.getElementById('__hoff_counter');
      if (!pill) return null;

      // Parse from rendered content (hacky but works without a messaging layer)
      const usedEl = pill.querySelector('[style*="#a78bfa"]');
      const leftEl = pill.querySelector('[style*="#4ade80"],[style*="#fbbf24"],[style*="#f87171"]');

      // Also get window badges
      const winEls = pill.querySelectorAll('.tc-win,[style*="5h"],[style*="7d"]');
      const wins   = Array.from(winEls).map(e => e.textContent.trim()).filter(Boolean);

      return {
        usedText: usedEl?.textContent?.trim() || null,
        leftText: leftEl?.textContent?.trim() || null,
        wins,
      };
    }
  }, (results) => {
    const data = results?.[0]?.result;
    if (!data?.usedText) {
      // Fallback: char estimate from page
      chrome.scripting.executeScript({
        target: { tabId },
        func: (ctx) => {
          const main  = document.querySelector('main,[role="main"]') || document.body;
          const chars = (main.innerText||'').length;
          const used  = Math.round(chars / 3.8);
          const left  = Math.max(0, ctx - used);
          const pct   = Math.min(100, Math.round(used/ctx*100));
          return { used, left, pct, isReal:false };
        },
        args: [P.ctx],
      }, (r) => { if (r?.[0]?.result) showTokenCard(r[0].result, P, []); });
      return;
    }

    // Parse "12.4k" → number
    function parseK(s) {
      if (!s) return 0;
      const m = s.match(/([\d.]+)([kMm]?)/);
      if (!m) return 0;
      let n = parseFloat(m[1]);
      if (m[2]==='k'||m[2]==='K') n*=1000;
      if (m[2]==='M'||m[2]==='m') n*=1000000;
      return Math.round(n);
    }

    const used = parseK(data.usedText);
    const left = parseK(data.leftText);
    const pct  = Math.min(100, Math.round(used/P.ctx*100));
    showTokenCard({ used, left, pct, isReal:true }, P, data.wins);
  });
}

function showTokenCard({ used, left, pct, isReal }, P, wins) {
  const card = document.getElementById('tok-card');
  card.style.display = 'block';

  const color = pct>85?'#f87171':pct>65?'#fbbf24':P.color;

  document.getElementById('tok-name').textContent  = P.name;
  document.getElementById('tok-name').style.color  = P.color;
  document.getElementById('tok-pct').textContent   = `${pct}%`;
  document.getElementById('tok-pct').style.color   = color;
  document.getElementById('tok-fill').style.width  = `${pct}%`;
  document.getElementById('tok-fill').style.background = color;
  document.getElementById('tok-used').textContent  = fmt(used);
  document.getElementById('tok-used').style.color  = '#a78bfa';
  document.getElementById('tok-left').textContent  = fmt(left);
  document.getElementById('tok-left').style.color  = color;
  document.getElementById('tok-total').textContent = fmt(P.ctx);

  const winEl = document.getElementById('tok-windows');
  if (wins?.length) {
    winEl.innerHTML = wins.map(w => `<span style="background:#1a1a2e;border:1px solid ${P.color}44;border-radius:5px;padding:2px 7px;font-size:10px;font-weight:600;color:${P.color}">${w}</span>`).join('');
  }

  if (pct>80) setStatus(`⚠️ ${P.name}: only ~${fmt(left)} tokens left!`, '#f59e0b');
  else if (!isReal) setStatus('Token estimate (real data loading…)', '#4b5563');
}

// ── Export button ─────────────────────────────────────────────────────────
document.getElementById('export-btn').addEventListener('click', () => {
  chrome.tabs.query({ active:true, currentWindow:true }, ([tab]) => {
    setStatus('Extracting messages…', '#a78bfa');
    document.getElementById('export-btn').disabled = true;

    // Try message to content script first
    chrome.tabs.sendMessage(tab.id, { action:'export' }, (resp) => {
      document.getElementById('export-btn').disabled = false;
      if (chrome.runtime.lastError || !resp) {
        // Fallback: click the export pill directly
        chrome.scripting.executeScript({
          target:{tabId:tab.id},
          func:()=>{const b=document.getElementById('__hoff_export_pill');if(b){b.click();return true;}return false;}
        }, (r) => {
          if (r?.[0]?.result) { setStatus('✅ Exported! Choose an AI below.','#4ade80'); document.getElementById('continue-section').style.display='block'; }
          else setStatus('⚠️ Reload page and try again','#f59e0b');
        });
        return;
      }
      setStatus('✅ Exported! Choose an AI below.','#4ade80');
      document.getElementById('continue-section').style.display = 'block';
    });
  });
});

// AI open buttons — show after export, each opens the chosen AI in a new tab
document.querySelectorAll('.ai-open-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    chrome.tabs.create({ url: btn.dataset.url });
  });
});

// ══════════════════════════════════════════════════════════════════
//  SETTINGS
// ══════════════════════════════════════════════════════════════════
const DEFAULTS = {
  showTokenCounter: true,
  showWindowBadges: true,
  showCacheTimer:   true,
  showResetTime:    true,
  showEstLabel:     true,
  opacity:          88,
  showExportBtn:    true,
};

function loadSettings() {
  chrome.storage.sync.get('hoffSettings', ({ hoffSettings }) => {
    const s = { ...DEFAULTS, ...(hoffSettings||{}) };
    document.getElementById('s-showTokenCounter').checked = s.showTokenCounter;
    document.getElementById('s-showWindowBadges').checked = s.showWindowBadges;
    document.getElementById('s-showResetTime').checked    = s.showResetTime;
    document.getElementById('s-showCacheTimer').checked   = s.showCacheTimer;
    document.getElementById('s-showEstLabel').checked     = s.showEstLabel;
    document.getElementById('s-showExportBtn').checked    = s.showExportBtn;
    document.getElementById('s-opacity').value            = s.opacity;
    document.getElementById('opacity-val').textContent    = `${s.opacity}%`;
  });
}

function saveSettings() {
  const s = {
    showTokenCounter: document.getElementById('s-showTokenCounter').checked,
    showWindowBadges: document.getElementById('s-showWindowBadges').checked,
    showResetTime:    document.getElementById('s-showResetTime').checked,
    showCacheTimer:   document.getElementById('s-showCacheTimer').checked,
    showEstLabel:     document.getElementById('s-showEstLabel').checked,
    showExportBtn:    document.getElementById('s-showExportBtn').checked,
    opacity:          parseInt(document.getElementById('s-opacity').value),
  };
  chrome.storage.sync.set({ hoffSettings: s });
}

// Live save on every settings change
document.querySelectorAll('#tab-settings input, #tab-settings select').forEach(el => {
  el.addEventListener('change', saveSettings);
  if (el.type==='range') {
    el.addEventListener('input', () => {
      document.getElementById('opacity-val').textContent = `${el.value}%`;
      saveSettings();
    });
  }
});

loadSettings();
