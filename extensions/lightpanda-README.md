# Lightpanda Extension for pi

This extension integrates [Lightpanda](https://lightpanda.io) - a headless browser built from scratch in Zig for AI agents and automation.

## What is Lightpanda?

Lightpanda is a new browser engine (not a Chromium fork!) designed specifically for automation:
- **10x faster** than Chrome headless
- **10x less memory** usage
- Full JavaScript execution via V8
- CDP-compatible (works with Puppeteer/Playwright)
- Respects robots.txt

## Installation

### 1. Install Lightpanda

```bash
curl -fsSL https://pkg.lightpanda.io/install.sh | bash
```

Or download from [GitHub releases](https://github.com/lightpanda-io/browser/releases).

### 2. Install the Extension

This extension should be auto-discovered by pi from `~/.pi/agent/extensions/`.

## Available Tools

### lightpanda_fetch

Fetch a URL and return content as HTML or Markdown.

```
Parameters:
- url: string (required) - URL to fetch
- format: "html" | "markdown" (default: "markdown")
```

**Example usage:**
- "Fetch https://example.com and give me the content"
- "Scrape this page as markdown: https://news.ycombinator.com"

### lightpanda_cdp

Control the CDP (Chrome DevTools Protocol) server for browser automation.

```
Parameters:
- action: "start" | "stop" | "status" (required)
- port: number (optional, default: 9222)
```

**Example usage:**
- "Start the CDP server"
- "Stop the browser server"
- "Check if CDP is running"

Once the CDP server is running, you can connect with Puppeteer/Playwright:

```javascript
const browser = await puppeteer.connect({
  browserWSEndpoint: "ws://127.0.0.1:9222"
});
```

## Commands

### /lightpanda

Check Lightpanda installation status.

## Advanced: Puppeteer Integration

For advanced browser automation (clicking, form filling, screenshots), use the `lightpanda-puppeteer.ts` extension:

1. Install dependencies:
```bash
npm install puppeteer-core
```

2. Start the CDP server:
```
Use lightpanda_cdp to start the server
```

3. Use browser automation:
```
Navigate to https://example.com using browser automation
Click the button with selector "#submit"
Extract text from ".article-content"
```

## Comparison with Other Tools

| Feature | Lightpanda | Chrome Headless |
|---------|-----------|-----------------|
| Memory (100 pages) | 123MB | 2GB |
| Execution time | 5s | 46s |
| Startup time | <1s | 3-5s |
| JS execution | ✅ V8 | ✅ V8 |
| CDP support | ✅ | ✅ |
| Built for AI | ✅ | ❌ |

## Links

- [Lightpanda Website](https://lightpanda.io)
- [GitHub Repository](https://github.com/lightpanda-io/browser)
- [Documentation](https://lightpanda.io/docs)
