// settings.js — shared settings module (loaded by all content scripts)
// @codingbreaker

window.__hoffSettings = window.__hoffSettings || (() => {
  const DEFAULTS = {
    showExportBtn:     true,
    showTokenCounter:  true,
    counterPosition:   'chatbar',   // 'chatbar' | 'floating'
    showWindowBadges:  true,        // Claude 5h/7d badges
    showCacheTimer:    true,        // Claude cache countdown
    showResetTime:     true,        // Reset countdown
    showEstLabel:      true,        // ~est label when not real data
    theme:             'dark',      // 'dark' | 'minimal' | 'light'
    opacity:           88,          // 0-100
  };

  let _cache = null;

  function get() {
    return new Promise(resolve => {
      if (_cache) { resolve(_cache); return; }
      chrome.storage.sync.get('hoffSettings', ({ hoffSettings }) => {
        _cache = { ...DEFAULTS, ...(hoffSettings || {}) };
        resolve(_cache);
      });
    });
  }

  function save(partial) {
    return new Promise(resolve => {
      get().then(current => {
        const updated = { ...current, ...partial };
        _cache = updated;
        chrome.storage.sync.set({ hoffSettings: updated }, resolve);
        // Notify all content scripts
        chrome.storage.onChanged.addListener?.(() => {});
      });
    });
  }

  // Invalidate cache when settings change
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.hoffSettings) _cache = null;
  });

  return { get, save, DEFAULTS };
})();
