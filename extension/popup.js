// popup.js
document.addEventListener('DOMContentLoaded', () => {
  const ICONS = {
    info: `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 9v2m0 4h.01" />
      <circle cx="12" cy="12" r="9" />
    </svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>`,
    error: `<svg xmlns="http://www.w3.org/2000/svg" class="icon" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M10.29 3.86L1.82 18a1 1 0 0 0 .86 1.5h18.64a1 1 0 0 0 .86-1.5L13.71 3.86a1 1 0 0 0-1.72 0z" />
      <path d="M12 9v4m0 4h.01" />
    </svg>`
  };

  const warningEl = document.getElementById('warning');
  const spinnerEl = document.getElementById('spinner');
  const logEl = document.getElementById('log');
  const startBtn = document.getElementById('start-btn');
  const sitemapIn = document.getElementById('sitemap-url');
  const convertBtn = document.getElementById('convert-current-btn');
  const urlMdEl = document.getElementById('url-md');
  const urlSpinner = document.getElementById('url-spinner');
  const copyBtn = document.getElementById('copy-current-btn');
  const labelSpan = copyBtn.querySelector('.btn-label');

  const zip = new JSZip();
  let totalCount = 0;
  let completedCount = 0;

  // 1) Ask the service worker to boot the offscreen page if needed
  function ensureOffscreenInBackground() {
    return new Promise(resolve =>
      chrome.runtime.sendMessage({ action: 'ensureOffscreen' }, resolve)
    );
  }

  // 2) Fetch & parse a URL in offscreen, returning its rendered HTML
  function fetchAndParse(url) {
    return new Promise((resolve, reject) =>
      chrome.runtime.sendMessage({ action: 'fetchAndParse', url }, response => {
        if (response.error) reject(new Error(response.error));
        else resolve(response.html);
      })
    );
  }

  // 3) In your sitemap‐scan routine, replace fetchWithRetry / fetch(url).text() with:
  async function fetchPageContent(url) {
    try {
      // ensure we have an offscreen context
      await ensureOffscreenInBackground();
      // fetch + DOMParser in that hidden context
      return await fetchAndParse(url);
    } catch (e) {
      // fallback to raw fetch if offscreen fails
      const res = await fetch(url);
      return await res.text();
    }
  }

  async function startScan(url) {
    totalCount = 0;
    completedCount = 0;
    zip.folder('pages');
    log('info', 'Fetching sitemap...');
    const urls = await collectUrls(url);
    totalCount = urls.length;
    updateProgress();
    for (const pageUrl of urls) {
      log('info', `Fetching page: ${pageUrl}`);
      try {
        log('info', `Rendering page via offscreen DOM: ${pageUrl}`);
        let html;
        try {
          html = await fetchPageContent(pageUrl);
        } catch (err) {
          log('error', `Error processing ${pageUrl}: ${err.message}`);
          continue;
        }
        // const res = await fetchWithRetry(pageUrl);
        // const html = await res.text();
        log('info', 'Converting to Markdown');
        let doc = new DOMParser().parseFromString(html, 'text/html');
        doc = pruneDoc(doc)
        const titleEl = doc.querySelector('title');
        const metaDescEl = doc.querySelector('meta[name="description"]');
        const titleText = titleEl?.textContent.trim() || '';
        const descText = metaDescEl?.getAttribute('content')?.trim() || '';

        const slug = slugify(new URL(pageUrl).pathname);
        const md = generateMD(doc, pageUrl)

        const markdown = [
          titleText ? `# ${titleText}` : '',
          descText ? `> ${descText}` : '',
          md
        ].filter(Boolean).join('\n\n');

        zip.file(`${slug}-llms.txt`, markdown);
      } catch (err) {
        log('error', `Error processing ${pageUrl}: ${err.message}`);
      }
      completedCount++;
      updateProgress();
    }
    log('info', 'Generating ZIP...');
    const blob = await zip.generateAsync({ type: 'blob' });
    const domain = new URL(url).hostname;
    const filename = `${domain}.zip`;
    const blobUrl = URL.createObjectURL(blob);
    chrome.downloads.download({ url: blobUrl, filename });
    log('info', 'Download started');
  }

  function generateMD(doc, pageUrl) {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      fence: '```'     // this is the default, so you can omit it if you want
    });
    turndownService.addRule('jsonLd', {
      filter: node => {
        const name = node.nodeName.toLowerCase();
        const type = node.getAttribute('type') || '';
        return name === 'script' &&
          (type === 'application/ld+json' ||
            type === 'application/json+ld');
      },
      replacement: (content, node) => {
        const type = node.getAttribute('type');
        const json = node.textContent.trim();
        return `\n\`\`\`${type}\n${json}\n\`\`\`\n`;
      }
    });
    turndownService.addRule('fencedCodeBlock', {
      filter: 'pre',
      replacement: (content, node) => {
        const codeNode = node.querySelector('code');
        const codeText = codeNode ? codeNode.textContent : content;
        const langMatch = codeNode
          ? (codeNode.getAttribute('class') || '').match(/language-(\w+)/)
          : null;
        const lang = langMatch ? langMatch[1] : '';
        return `\`\`\`${lang}\n${codeText}\n\`\`\``;
      }
    });
    turndownService.addRule('absoluteLinks', {
      filter: 'a',
      replacement: (content, node) => {
        const href = node.getAttribute('href') || '';
        const full = new URL(href, pageUrl).href;
        return `[${content}](${full})`;
      }
    });
    turndownService.addRule('absoluteImages', {
      filter: 'img',
      replacement: (content, node) => {
        const src = node.getAttribute('src') || ''
        const full = new URL(src, pageUrl).href
        const alt = node.getAttribute('alt') || ''
        return `![${alt}](${full})`
      }
    })
    const md = turndownService.turndown(doc.body) + `\n\nHuman readable version: ${pageUrl}`;
    return md
  }

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab, .tab-content').forEach(x => x.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab).classList.add('active');
    });
  });

  chrome.tabs.query({ active: true, currentWindow: true }, async tabs => {
    currentUrl = tabs[0].url;
    let sitemapValue = '';

    try {
      const urlObj = new URL(currentUrl);
      // only auto-fill if it's an HTTP(S) page
      if (urlObj.protocol === 'http:' || urlObj.protocol === 'https:') {
        sitemapValue = `${urlObj.origin}/sitemap.xml`;
      }
    } catch (e) {
      // malformed URL? leave sitemapValue ''
    }
    sitemapIn.value = sitemapValue;
  });

  // scan handler
  startBtn.addEventListener('click', () => {
    const url = sitemapIn.value.trim();
    if (!url) return alert('Enter a sitemap URL.');
    logEl.innerHTML = '';
    show(warningEl, 'flex');
    show(spinnerEl, 'inline-block');
    log('info', 'Starting scan...');
    startScan(url).finally(() => show(spinnerEl, 'none'));
  });

  convertBtn.addEventListener('click', async () => {
    urlSpinner.style.display = 'block';
    urlMdEl.textContent = '';
    copyBtn.style.display = 'flex';   // show the button when ready

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const pageUrl = tab.url;
      // grab the full HTML from the page
      const html = await runInPage(tab.id, () => document.documentElement.outerHTML);
      let doc = new DOMParser().parseFromString(html, 'text/html');
      doc = pruneDoc(doc)

      const titleEl = doc.querySelector('title');
      const metaDescEl = doc.querySelector('meta[name="description"]');
      const titleText = titleEl?.textContent.trim() || '';
      const descText = metaDescEl?.getAttribute('content')?.trim() || '';

      const md = generateMD(doc, pageUrl)

      const markdown = [
        titleText ? `# ${titleText}` : '',
        descText ? `> ${descText}` : '',
        md
      ].filter(Boolean).join('\n\n');
      urlMdEl.textContent = markdown;
    }
    catch (err) {
      urlMdEl.textContent = `Error: ${err.message}`;
    }
    finally {
      urlSpinner.style.display = 'none';
    }
  });

  copyBtn.addEventListener('click', () => {
    const text = urlMdEl.textContent || '';
    navigator.clipboard.writeText(text)
      .then(() => {
        // only update the label text
        labelSpan.textContent = 'Copied!';
        // revert after 2s
        setTimeout(() => {
          labelSpan.textContent = 'Copy Markdown';
        }, 2000);
      })
      .catch(err => {
        console.error('Copy failed', err);
        labelSpan.textContent = 'Failed to copy';
        setTimeout(() => {
          labelSpan.textContent = 'Copy Markdown';
        }, 2000);
      });
  });


  function pruneDoc(doc) {
    doc.querySelectorAll('style, script:not([type="application/ld+json"])')
      .forEach(el => el.remove());

    const walker = doc.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    while (node = walker.nextNode()) {
      node.nodeValue = node.nodeValue
        .trim()               // remove leading/trailing
        .replace(/\t/g, ' ')  // tabs → spaces
        .replace(/ {2,}/g, ' '); // collapse multi-spaces
    }
    return doc
  }

  async function runInPage(tabId, func) {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId },
      func
    });
    return result;
  }

  async function collectUrls(sitemapUrl, seen = new Set()) {
    if (seen.has(sitemapUrl)) return [];
    seen.add(sitemapUrl);

    const res = await fetchWithRetry(sitemapUrl);
    const xml = await res.text();

    // grab all <loc>…</loc> entries
    const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), m => m[1].trim());
    const pageUrls = [];

    for (const loc of locs) {
      // resolve relative or absolute URL against the sitemap’s URL
      const resolvedUrl = new URL(loc, sitemapUrl).href;

      if (resolvedUrl.endsWith('.xml')) {
        // recurse into nested sitemap
        pageUrls.push(...await collectUrls(resolvedUrl, seen));
      } else {
        pageUrls.push(resolvedUrl);
      }
    }

    return pageUrls;
  }

  async function fetchWithRetry(url, attempt = 1) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        const ra = parseInt(res.headers.get('Retry-After'));
        const wait = (!isNaN(ra) ? ra * 1000 : Math.min(2 ** attempt * 1000, 30000));
        log('error', `429 received, waiting ${wait}ms`);
        await delay(wait);
        if (attempt < 5) return fetchWithRetry(url, attempt + 1);
        throw new Error('Max retries reached');
      }
      if (!res.ok) throw new Error(res.statusText);
      return res;
    } catch (err) {
      if (attempt < 5) {
        const wait = Math.min(2 ** attempt * 1000, 30000);
        log('error', `Error: ${err.message}, retrying in ${wait}ms`);
        await delay(wait);
        return fetchWithRetry(url, attempt + 1);
      }
      throw err;
    }
  }

  function slugify(path) {
    return path.replace(/\/+$|^\//g, '')
      .split('/')
      .map(s => s || 'home')
      .join('-')
      .replace(/[^\w\-]/g, '-')
      .toLowerCase();
  }

  function updateProgress() {
    const bar = document.getElementById('progress-bar');
    if (!bar) return;                     // ← gracefully do nothing
    const pct = totalCount
      ? Math.round((completedCount / totalCount) * 100)
      : 0;
    bar.style.width = pct + '%';
  }

  function log(type, msg) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = (ICONS[type] || ICONS.info) + `<span>${msg}</span>`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function show(el, v = 'block') { if (el) el.style.display = v; }

  function normalizeWhitespace(str) {
    return str
      .trim()                   // remove leading/trailing
      .replace(/\t/g, ' ')      // tabs → single space
      .replace(/ {2,}/g, ' ');  // collapse 2+ spaces to one
  }
});
