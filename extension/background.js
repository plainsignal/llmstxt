// No-op background service worker:

async function ensureOffscreen() {
  // if the API isn’t there, just bail
  if (
    !chrome.offscreen ||
    typeof chrome.offscreen.hasDocument !== 'function' ||
    typeof chrome.offscreen.createDocument !== 'function'
  ) {
    console.warn('Offscreen API unavailable—falling back to raw fetch');
    return;
  }

  // only create it if it doesn’t already exist
  const hasDoc = await chrome.offscreen.hasDocument();
  if (!hasDoc) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL('offscreen.html'),
      reasons: ['DOM_PARSER'],
      justification: 'Need to render pages for Markdown conversion'
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ensureOffscreen') {
    ensureOffscreen().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (message.action === 'fetchAndParse') {
    ensureOffscreen().then(() => {
      chrome.runtime.sendMessage(message, sendResponse);
    });
    return true;
  }
});
