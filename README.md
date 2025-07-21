# LLMs.Txt Generator

LLMsTxt Generator is a Chrome Extension. It scans your `sitemap.xml`, convert pages & live sites to LLM-optimized Markdown files, and export them in a single zip file. It generates an overall `llms.txt` file which includes all the links and additionally generates one `llms-full.txt` per page. If you want to be precise, you can remove unrelated links from the generated `txt` file.

---

## Key Features

- **Recursive Sitemap Scanning**

  - Parses your `sitemap.xml` and any nested sitemaps, following only valid `http(s)` URLs.
  - Filters out non-HTTP links for focused scanning.

- **Markdown Export (LLMsTxt Format)**

  - Converts HTML pages into clean **ATX-style headings** (`#`, `##`, …), fenced code blocks, and absolute URLs.
  - Removes `<script>`, `<style>`, and `<button>` tags; preserves **JSON-LD** (`application/ld+json` & `application/json+ld`) as formatted code snippets.
  - Resolves relative links and images to **full URLs** for seamless static `llms.txt` content generation.

- **Current Page Converter**

  - One-click “Convert Current Page” grabs the **rendered DOM** (supports SPA/React/Vue content).
  - Prepends `<title>` as `# Heading` and `<meta name="description">` as `> Blockquote`.
  - Ideal for ad-hoc page audits, AI training data extraction, and quick Markdown previews.

- **Embed & SEO Metadata Guidance**

  - Built-in **Embed** tab with snippets:

    ```html
    <link
      rel="alternate"
      type="text/llmtxt"
      href="https://example.com/llms-full.txt"
      title="LLMsTxt version"
    />
    <meta name="llmtxt" content="https://example.com/llms-full.txt" />
    ```

  - Publish `llms-full.txt` files alongside your pages for easy LLM ingestion and SEO signals.

- **Intuitive Modern UI**

  - Four tabs: **Generator**, **Current Page**, **Embed**, **About**.
  - Real-time **progress bar** & **auto-scrolling log**.
  - ⚠️ User warning prevents accidental closure during scanning.
  - **Copy to Clipboard** for instant Markdown transfer.

- **Privacy-First & Offline-Capable**

  - 100% local conversion—no external servers, no tracking.
  - Uses Chrome MV3 Offscreen API (or MV2 tab scripting fallback) for accurate DOM parsing.

---

## How It Works

1. **Auto-Detect** your sitemap URL (`https://your-site.com/sitemap.xml`) on secure pages.
2. **Offscreen Rendering** fetches pages in a hidden DOM, executing scripts for dynamic content.
3. **Clean & Normalize** HTML: strip unwanted nodes, normalize whitespace per text node.
4. **Convert to Markdown** with Turndown:

   - Headings → `#`–`######`
   - Code → `lang …`
   - Links → `[text](absolute-url)`
   - Images → `![alt](absolute-url)`
   - JSON-LD → `application/ld+json …`

5. **Download or Copy** your domain’s ZIP or current-page Markdown.

---

## Why Choose LLMsTxt Generator?

- **SEO & Content Marketing**: Ideal for content audits, static migrations, UTM tracking, and structured data extraction.
- **AI & LLM Workflows**: Prep training data, generate knowledge bases, accelerate AI-driven insights.
- **Developer Productivity**: Integrates with CI pipelines, GitHub Actions, and static site generators.
- **Flexibility & Extensibility**: Open-source under Apache 2.0

## License

Apache 2.0
