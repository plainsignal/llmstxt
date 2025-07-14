chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'fetchAndParse') {
    (async () => {
      try {
        const res = await fetch(message.url);
        const text = await res.text();
        // Parse into a DOM
        const doc = new DOMParser().parseFromString(text, 'text/html');
        // Optionally strip out <script> tags so JS isn't in your Markdown:
        doc.querySelectorAll('script').forEach(s => s.remove());
        // Return the rendered HTML string
        sendResponse({ html: doc.documentElement.outerHTML });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // keep the message channel open for async sendResponse
  }
});