// background.js — service worker
// Injects handoff banner into custom AI tabs (not covered by content_scripts)
// @codingbreaker

const BUILTIN_HOSTS = new Set([
  'claude.ai','chatgpt.com','chat.openai.com','gemini.google.com',
  'grok.com','x.com','perplexity.ai','www.perplexity.ai',
  'copilot.microsoft.com','chat.deepseek.com','chat.mistral.ai',
  'poe.com','you.com','meta.ai',
]);

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.url?.startsWith('http')) return;

  let tabHost;
  try { tabHost = new URL(tab.url).hostname.replace('www.',''); } catch { return; }
  if (!tabHost || BUILTIN_HOSTS.has(tabHost)) return; // built-ins handle themselves

  const [local, sync] = await Promise.all([
    chrome.storage.local.get(['handoff_doc','handoff_ts','handoff_count','handoff_from']),
    chrome.storage.sync.get('hoffCustomAIs'),
  ]);

  if (!local.handoff_doc) return;
  if (Date.now() - (local.handoff_ts||0) > 30*60*1000) {
    chrome.storage.local.remove(['handoff_doc','handoff_ts','handoff_count','handoff_from']);
    return;
  }

  const customAIs = sync.hoffCustomAIs || [];
  const matched = customAIs.find(ai => {
    try {
      const h = new URL(ai.url.startsWith('http') ? ai.url : 'https://'+ai.url).hostname.replace('www.','');
      return tabHost === h;
    } catch { return false; }
  });

  if (!matched) return;
  if (local.handoff_from === matched.name) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: _injectBanner,
      args: [local.handoff_doc, String(local.handoff_count||'?'), String(local.handoff_from||'AI'), matched.color||'#7c3aed'],
    });
  } catch(_) {}
});

// This function runs inside the target page (isolated world = content script context)
function _injectBanner(doc, count, fromName, color) {
  if (document.getElementById('__hoff_banner')) return;

  function findInput() {
    const sels = [
      '#prompt-textarea','div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][spellcheck]','div[contenteditable="true"]',
      'textarea[placeholder*="message" i]','textarea[placeholder*="Ask" i]',
      'textarea[placeholder*="Type" i]','textarea:not([readonly])',
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled) return el;
    }
    return null;
  }

  function injectText(el, text) {
    try {
      el.focus();
      if (el.contentEditable === 'true') {
        while (el.firstChild) el.removeChild(el.firstChild);
        const ok = document.execCommand('insertText', false, text);
        if (ok && (el.innerText||'').trim().length > 20) return true;
        el.textContent = text;
        el.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', data:text }));
        return (el.innerText||'').trim().length > 20;
      }
      if (el.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el),'value')?.set;
        if (setter) setter.call(el, text); else el.value = text;
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
        return el.value.length > 20;
      }
    } catch(_) {}
    return false;
  }

  const banner = document.createElement('div');
  banner.id = '__hoff_banner';
  Object.assign(banner.style, {
    position:'fixed', bottom:'80px', right:'16px',
    zIndex:'2147483647', background:'#0d0d1aee',
    border:`1px solid ${color}55`, backdropFilter:'blur(12px)',
    color:'#e2e8f0', borderRadius:'16px', padding:'16px 18px',
    fontFamily:'system-ui,-apple-system,sans-serif', fontSize:'13px',
    boxShadow:`0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px ${color}22`, width:'260px',
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
      <button id="__hb_x" style="background:#1f2937;border:none;color:#6b7280;width:22px;height:22px;
        border-radius:6px;cursor:pointer;font-size:12px;display:flex;align-items:center;
        justify-content:center;flex-shrink:0">✕</button>
    </div>
    <button id="__hb_inject" style="width:100%;background:linear-gradient(135deg,${color},${color}99);
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

  const clear = () => chrome.storage.local.remove(['handoff_doc','handoff_ts','handoff_count','handoff_from']);

  banner.querySelector('#__hb_x').onclick = () => { banner.remove(); clear(); };

  banner.querySelector('#__hb_inject').onclick = () => {
    const btn = banner.querySelector('#__hb_inject');
    btn.textContent = '⏳ Injecting…'; btn.disabled = true;
    const inp = findInput();
    if (!inp) {
      navigator.clipboard.writeText(doc).then(() => {
        btn.textContent = '📋 Copied — press Ctrl+V';
        setTimeout(() => { banner.remove(); clear(); }, 2500);
      }).catch(() => { btn.textContent = '❌ Paste manually'; btn.disabled = false; });
      return;
    }
    const ok = injectText(inp, doc);
    if (ok) {
      btn.textContent = '✅ Done! Context injected';
      btn.style.background = 'linear-gradient(135deg,#16a34a,#15803d)';
      setTimeout(() => { banner.remove(); clear(); }, 2000);
    } else {
      navigator.clipboard.writeText(doc).then(() => {
        btn.textContent = '📋 Copied — press Ctrl+V';
        setTimeout(() => { banner.remove(); clear(); }, 2500);
      });
    }
  };

  banner.querySelector('#__hb_copy').onclick = () => {
    navigator.clipboard.writeText(doc).then(() => {
      banner.querySelector('#__hb_copy').textContent = '✅ Copied!';
      setTimeout(() => { banner.remove(); clear(); }, 1800);
    });
  };

  // Auto retry input find (page may still be loading)
  let tries = 0;
  const iv = setInterval(() => {
    if (++tries > 20 || findInput()) clearInterval(iv);
  }, 500);
}
