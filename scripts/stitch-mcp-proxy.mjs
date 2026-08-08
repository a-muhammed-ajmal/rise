#!/usr/bin/env node
/**
 * Stitch MCP proxy — fixes the "#/$defs/ScreenInstance" JSON Schema $ref
 * resolution error that breaks Claude Code's MCP client.
 *
 * Fetches tools from https://stitch.googleapis.com/mcp, inlines all
 * $ref definitions, strips $defs/$id, then re-exposes the fixed schema
 * via stdio MCP transport. Tool calls are proxied transparently.
 */
import https from 'https';

const STITCH_URL = 'https://stitch.googleapis.com/mcp';
const API_KEY = process.env.STITCH_API_KEY;

if (!API_KEY) {
  process.stderr.write('Error: STITCH_API_KEY environment variable is required\n');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// HTTP helper — POST to Stitch
// ---------------------------------------------------------------------------
function callStitch(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(STITCH_URL);
    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'X-Goog-Api-Key': API_KEY,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`Stitch returned non-JSON: ${raw.slice(0, 200)}`)); }
        });
      },
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ---------------------------------------------------------------------------
// JSON Schema deref — inline all #/$defs/... $refs
// ---------------------------------------------------------------------------
function deref(node, defs, seen = new Set()) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map((item) => deref(item, defs, seen));

  if ('$ref' in node) {
    const ref = /** @type {string} */ (node.$ref);
    if (ref.startsWith('#/$defs/')) {
      const name = ref.slice('#/$defs/'.length);
      if (seen.has(name)) return { type: 'object' }; // break cycles
      const target = defs[name];
      if (target) return deref(target, defs, new Set([...seen, name]));
    }
    return node; // external or unknown $ref — leave as-is
  }

  const out = /** @type {Record<string, unknown>} */ ({});
  for (const [k, v] of Object.entries(node)) {
    if (k === '$defs' || k === '$id') continue; // strip — these cause the parse error
    out[k] = deref(v, defs, seen);
  }
  return out;
}

function fixSchema(schema) {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) return schema;
  const defs = /** @type {Record<string, unknown>} */ (schema.$defs ?? {});
  return deref(schema, defs);
}

// ---------------------------------------------------------------------------
// MCP method handlers
// ---------------------------------------------------------------------------
async function handleInitialize(msg) {
  return {
    jsonrpc: '2.0',
    id: msg.id,
    result: {
      protocolVersion: msg.params?.protocolVersion ?? '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'stitch-proxy', version: '1.0.0' },
    },
  };
}

async function handleToolsList(msg) {
  const res = await callStitch({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} });
  if (res.error) return { jsonrpc: '2.0', id: msg.id, error: res.error };

  const tools = (res.result?.tools ?? []).map((t) => ({
    ...t,
    inputSchema: fixSchema(t.inputSchema),
    ...(t.outputSchema != null ? { outputSchema: fixSchema(t.outputSchema) } : {}),
  }));

  return { jsonrpc: '2.0', id: msg.id, result: { tools } };
}

async function handleToolsCall(msg) {
  const res = await callStitch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: msg.params });
  if (res.error) return { jsonrpc: '2.0', id: msg.id, error: res.error };
  return { jsonrpc: '2.0', id: msg.id, result: res.result };
}

async function handle(msg) {
  switch (msg.method) {
    case 'initialize':      return handleInitialize(msg);
    case 'tools/list':      return handleToolsList(msg);
    case 'tools/call':      return handleToolsCall(msg);
    default:
      return {
        jsonrpc: '2.0',
        id: msg.id,
        error: { code: -32601, message: `Method not found: ${msg.method}` },
      };
  }
}

// ---------------------------------------------------------------------------
// Stdio transport — newline-delimited JSON
// ---------------------------------------------------------------------------
let buffer = '';
let pending = 0;
let stdinEnded = false;

function maybeExit() {
  if (stdinEnded && pending === 0) process.exit(0);
}

async function dispatch(line) {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    const msg = JSON.parse(trimmed);
    if (msg.id === undefined) return; // notifications — no response
    pending++;
    try {
      const response = await handle(msg);
      process.stdout.write(JSON.stringify(response) + '\n');
    } finally {
      pending--;
      maybeExit();
    }
  } catch (err) {
    process.stderr.write(`stitch-proxy error: ${err instanceof Error ? err.message : err}\n`);
  }
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\n');
  buffer = lines.pop() ?? '';
  for (const line of lines) dispatch(line);
});

process.stdin.on('end', () => {
  stdinEnded = true;
  if (buffer.trim()) dispatch(buffer);
  maybeExit();
});
