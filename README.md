# AI Handoff Extension — by @codingbreaker

> **Export any AI conversation with one click → continue seamlessly on any other AI.**

Built by [@codingbreaker](https://github.com/codingbreaker)

---

## The Problem

You're deep in a session on Claude, ChatGPT, or Gemini — tokens run out or you want a second opinion.  
You switch to another AI but it has **zero context** about what you were doing.

## The Solution

This extension adds a **Handoff** button to every AI platform.  
One click → AI picker opens → choose destination → context auto-injects → the new AI picks up **exactly** where you left off.

---

## Supported Platforms (13+)

| Platform | Export | Inject | Token Counter |
|----------|--------|--------|---------------|
| Claude.ai | ✅ | ✅ | ✅ Real tokens |
| ChatGPT | ✅ | ✅ | ✅ Real tokens |
| Gemini | ✅ | ✅ | ✅ Real tokens |
| Grok | ✅ | ✅ | ✅ Estimated |
| Perplexity | ✅ | ✅ | ✅ Real tokens |
| DeepSeek | ✅ | ✅ | ✅ Real tokens |
| Mistral | ✅ | ✅ | ✅ Estimated |
| Copilot | ✅ | ✅ | ✅ Estimated |
| Poe | ✅ | ✅ | ✅ Estimated |
| You.com | ✅ | ✅ | ✅ Estimated |
| Meta AI | ✅ | ✅ | ✅ Estimated |
| + Custom | ✅ | ✅ | — |

---

## Features

- ✅ **Universal export** — works on 13+ AI platforms
- ✅ **AI Picker** — click Handoff → choose where to go → context auto-injects
- ✅ **Add custom AI** — save any AI with URL, appears in picker forever
- ✅ **Real token counter** — live count with progress bar (right side, all platforms)
- ✅ **Claude windows** — 5h / 7d usage badges with reset countdown
- ✅ **Prompt cache timer** — shows when Claude's cache expires
- ✅ **Smart compression** — long conversations auto-summarized (first 2 + last 10 kept full)
- ✅ **6 extraction strategies** — works across all UI versions and redesigns
- ✅ **Real-time updates** — MutationObserver for instant token refresh
- ✅ **Full settings** — show/hide any element, opacity control
- ✅ **Debug mode** — right-click export pill to inspect detection

---

## Install (Chrome / Edge / Brave)

1. Download or clone this repo
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select the `claude-handoff-extension` folder
6. Done — open any AI and look for the **Handoff** pill (bottom-right)

---

## How to Use

| Step | What to do |
|------|-----------|
| 1 | Work normally on any AI |
| 2 | Tokens running low? Click **Handoff** pill |
| 3 | AI picker opens — choose destination |
| 4 | New tab opens on the chosen AI |
| 5 | Banner appears → click **⚡ Inject Context** |
| 6 | The new AI reads everything and continues |

> **Tip:** Right-click the Handoff pill for a Debug Report — useful if messages aren't detected.

---

## Settings

Open the extension popup → ⚙️ tab:

- **Show counter** — toggle token counter on/off
- **Claude windows** — show 5h/7d usage badges
- **Reset countdown** — show time until window resets
- **Cache timer** — show prompt cache expiry
- **~est label** — show when count is estimated
- **Opacity** — adjust pill transparency
- **Show export button** — toggle Handoff pill

---

## License

MIT © [@codingbreaker](https://github.com/codingbreaker)
