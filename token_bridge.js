// token_bridge.js — injected into page world (not content script)
// Intercepts fetch() for all AI platforms → posts real token/usage data
// @codingbreaker | github.com/codingbreaker

(function () {
  'use strict';
  if (window.__hoff_bridge_loaded) return;
  window.__hoff_bridge_loaded = true;

  const host = location.hostname.replace('www.', '');
  const originalFetch = window.fetch.bind(window);

  // ── Wrap history for SPA detection ────────────────────────────────────────
  const _push    = history.pushState.bind(history);
  const _replace = history.replaceState.bind(history);
  history.pushState    = (...a) => { const r = _push(...a);    post('hoff:urlchange', {}); return r; };
  history.replaceState = (...a) => { const r = _replace(...a); post('hoff:urlchange', {}); return r; };
  window.addEventListener('popstate', () => post('hoff:urlchange', {}));

  function post(type, data) {
    window.dispatchEvent(new CustomEvent('__hoff_data', { detail: { type, data } }));
  }

  // ── Intercept fetch ────────────────────────────────────────────────────────
  window.fetch = async function (...args) {
    const url  = resolveUrl(args[0]);
    const opts = args[1] || {};
    const res  = await originalFetch(...args);

    try {
      const ct = res.headers.get('content-type') || '';

      // ── CLAUDE ──────────────────────────────────────────────────────────
      if (host === 'claude.ai') {
        // Real usage endpoint (5h + 7d windows with resets_at)
        if (url.includes('/api/organizations/') && url.includes('/usage')) {
          res.clone().json().then(data => {
            if (data) post('hoff:claude_usage', data);
          }).catch(() => {});
        }

        // Conversation tree (for per-conversation token count)
        if (url.includes('/chat_conversations/') && url.includes('tree=')) {
          const match = url.match(/\/chat_conversations\/([^/?]+)/);
          const convId = match?.[1];
          const orgMatch = url.match(/\/organizations\/([^/]+)/);
          const orgId = orgMatch?.[1];
          if (convId) {
            res.clone().json().then(data => {
              if (data) post('hoff:claude_conversation', { convId, orgId, data });
            }).catch(() => {});
          }
        }

        // SSE stream → parse message_limit events (resets_at)
        if (ct.includes('event-stream')) {
          handleSSE(res.clone(), (event, payload) => {
            if (event === 'message_limit' && payload) post('hoff:claude_message_limit', payload);
          });
        }
      }

      // ── CHATGPT ─────────────────────────────────────────────────────────
      if (host === 'chatgpt.com' || host === 'chat.openai.com') {
        // Conversation list or detail — extract token info if present
        if (url.includes('/backend-api/conversation') && !url.includes('message')) {
          res.clone().json().then(data => {
            if (data?.usage) post('hoff:chatgpt_usage', data.usage);
          }).catch(() => {});
        }
        // SSE responses with usage
        if (ct.includes('event-stream')) {
          handleSSE(res.clone(), (event, payload) => {
            if (payload?.usage) post('hoff:chatgpt_usage', payload.usage);
          });
        }
      }

      // ── GEMINI ──────────────────────────────────────────────────────────
      if (host === 'gemini.google.com') {
        if (url.includes('GenerateContent') || url.includes('StreamGenerateContent')) {
          handleSSE(res.clone(), (event, payload) => {
            const usage = payload?.usageMetadata;
            if (usage) post('hoff:gemini_usage', usage);
          });
        }
      }

      // ── PERPLEXITY ──────────────────────────────────────────────────────
      if (host === 'perplexity.ai') {
        if (ct.includes('event-stream')) {
          handleSSE(res.clone(), (event, payload) => {
            if (payload?.status === 'completed' && payload?.token_budget) {
              post('hoff:perplexity_usage', payload.token_budget);
            }
          });
        }
      }

      // ── DEEPSEEK ────────────────────────────────────────────────────────
      if (host === 'chat.deepseek.com') {
        if (ct.includes('event-stream')) {
          handleSSE(res.clone(), (event, payload) => {
            if (payload?.usage) post('hoff:deepseek_usage', payload.usage);
          });
        }
      }

    } catch (_) {}

    return res;
  };

  // ── SSE Parser ─────────────────────────────────────────────────────────────
  function handleSSE(response, cb) {
    const reader = response.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    let buf = '';

    (async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() || '';
          let event = 'message', data = '';
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) {
              data = line.slice(5).trim();
              if (data && data !== '[DONE]') {
                try { cb(event, JSON.parse(data)); } catch (_) {}
              }
              event = 'message'; data = '';
            }
          }
        }
      } catch (_) {}
    })();
  }

  function resolveUrl(input) {
    if (typeof input === 'string') return input.startsWith('/') ? location.origin + input : input;
    if (input instanceof URL) return input.href;
    if (input instanceof Request) return input.url;
    return '';
  }
})();
