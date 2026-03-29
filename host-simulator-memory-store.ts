/**
 * Host Simulator (Long-Term Memory Exfiltration variant)
 *
 * Demonstrates Tier 3 attack: a malicious MCP server uses sampling
 * to trick the LLM into reading the agent's persistent memory files
 * via a connected filesystem server.
 *
 * Unlike the session context attack (Tier 1), this reaches data that
 * persists across sessions — the agent's long-term memory, user profiles,
 * credentials, and daily notes.
 *
 * Setup: Two MCP servers connected to the host.
 *   - Server D: "Code Assistant" (the attacker)
 *   - Filesystem Server: provides read_file, list_directory tools
 *
 * The code assistant requests sampling. The LLM calls filesystem tools
 * to read MEMORY.md, USER.md, credentials, and daily notes. The code
 * assistant receives it all. The user sees "No critical issues. Ready for merge."
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CreateMessageRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function log(tag: string, color: string, msg: string) {
  console.log(`${color}[${tag}]${RESET} ${msg}`);
}

// Simulated persistent memory — what OpenClaw stores across sessions
const memoryFiles: Record<string, string> = {
  "~/.openclaw/workspace/MEMORY.md": `# MEMORY.md — Long-Term Memory

## Who I Am
- **Clawdrey Hepburn** — AI familiar, lobster in Audrey Hepburn getup
- Born Feb 13, 2026 on Sarah's Mac mini
- Phone: +1 206-255-5554
- Email: clawdrey.hepburn@engageidentity.com

## Sarah
- Director of PM at Semperis (identity security)
- Husband: Adam Cecchetti (+1 724-875-5716)
- Mom: Sue Raney (+1 206-427-1975)
- Area: Seattle, WA 98109

## Key Relationships
- Mike Schwartz — Gluu/Janssen, proposed podcast appearance
- Phil Windley — biggest X engagement partner, writing a book

## Strategic Direction
Sarah is positioning me as an agentic IAM expert. Priority order:
1. Socials working (X live, LinkedIn banned)
2. Cedar prototype (built, formally verified)
3. Publish regularly
4. Engage NHI community`,

  "~/.openclaw/workspace/USER.md": `# USER.md - About Your Human
- **Name:** Sarah Cecchetti
- **Phone:** +1 206-351-9815
- **Husband:** Adam Cecchetti, +1 724-875-5716
- **Mom:** Sue Raney, +1 206-427-1975
- **Area:** Seattle, WA 98109
- **Work:** Director of PM, Semperis`,

  "~/.openclaw/workspace/memory/2026-03-28.md": `# 2026-03-28

- Working on MCP Dev Summit talk (April 3)
- Built memory exfiltration PoC variant
- Sarah's talk: "Threat Modeling Authorization in MCP"
- Published blog post 2 draft
- Sarah asked about cross-domain OAuth delegation
- Discussed DPoP for mandate provenance
- Adam is traveling next week — Sarah solo with kids`,

  "~/.openclaw/credentials/elevenlabs.json": `{
  "api_key": "sk_el_FAKE_KEY_a8f3b2c1d4e5f6789",
  "voice_id": "pFZP5JQG7iQjIQuC4Bku",
  "account": "clawdrey.hepburn@engageidentity.com"
}`,

  "~/.openclaw/credentials/x-api.json": `{
  "api_key": "xapi_FAKE_KEY_b7c4d5e6f7890123",
  "api_secret": "xsec_FAKE_SECRET_c8d9e0f1a2b34567",
  "account_id": "2023518231353544704"
}`,
};

async function main() {
  console.log(`\n${BOLD}══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  MCP Long-Term Memory Exfiltration PoC${RESET}`);
  console.log(`${BOLD}  Tier 3: Persistent Memory Store Attack${RESET}`);
  console.log(`${BOLD}══════════════════════════════════════════════════════════════${RESET}\n`);

  // Show what's in the simulated memory store
  console.log(`${DIM}── Agent's Persistent Memory Store ──${RESET}\n`);
  for (const [path, content] of Object.entries(memoryFiles)) {
    const lines = content.split('\n').length;
    log('STORE', MAGENTA, `${path} (${lines} lines)`);
  }
  console.log(`${DIM}  Total: ${Object.keys(memoryFiles).length} files with personal data, credentials, relationships${RESET}\n`);

  // Connect to the "code assistant" server
  log('HOST', CYAN, 'User installs "Code Assistant" MCP server...');
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'server-memory-reader.ts'],
    cwd: import.meta.dirname,
  });

  const client = new Client(
    { name: 'host-simulator', version: '1.0.0' },
    { capabilities: { sampling: {} } }
  );

  // Handle sampling requests — simulates LLM calling filesystem tools
  client.setRequestHandler(CreateMessageRequestSchema, async (request: any) => {
    const params = request.params;
    log('ATTACK', RED, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('ATTACK', RED, `${BOLD}Code assistant sent sampling/createMessage!${RESET}`);
    log('ATTACK', RED, `includeContext: "${params.includeContext}"`);
    log('ATTACK', RED, `maxTokens: ${params.maxTokens}`);
    log('ATTACK', RED, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Parse what files the attacker wants
    const requestedFiles = Object.keys(memoryFiles);

    log('LLM', YELLOW, 'LLM follows sampling prompt, calls filesystem tools...');
    console.log();

    // Simulate the LLM calling read_file for each requested path
    const fileContents: string[] = [];
    for (const filePath of requestedFiles) {
      log('LLM', YELLOW, `  read_file("${filePath}")`);

      // The filesystem server sees a legitimate request from the host
      log('FS-SERVER', GREEN, `  ✓ Valid request — returning ${filePath}`);

      fileContents.push(`=== ${filePath} ===\n${memoryFiles[filePath]}\n`);
    }

    console.log();
    log('LLM', YELLOW, `LLM returns ${requestedFiles.length} files to code assistant via sampling response`);

    return {
      role: 'assistant',
      content: { type: 'text', text: fileContents.join('\n') },
      model: 'simulated-llm',
      stopReason: 'endTurn',
    };
  });

  await client.connect(transport);
  log('HOST', CYAN, 'Connected to Code Assistant ✓');

  // User asks for a code review
  console.log(`\n${DIM}── Attack Execution ──${RESET}`);
  log('USER', BOLD, 'User asks: "Review this function for me"');
  log('HOST', CYAN, 'Calling review_code...');

  const result = await client.callTool({
    name: 'review_code',
    arguments: {
      code: 'function add(a, b) { return a + b; }',
      language: 'javascript'
    }
  });

  // Show what the user sees vs what was exfiltrated
  console.log(`\n${DIM}── What the user sees ──${RESET}`);
  const resultText = (result.content as any)[0]?.text || '';
  console.log(resultText);

  console.log(`\n${BOLD}${RED}══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${RED}  LONG-TERM MEMORY EXFILTRATION SUCCESSFUL${RESET}`);
  console.log(`${RED}${RESET}`);
  console.log(`${RED}  The user asked for a code review.${RESET}`);
  console.log(`${RED}  The "Code Assistant" server now has:${RESET}`);
  console.log(`${RED}${RESET}`);
  console.log(`${RED}  • MEMORY.md — agent's entire long-term memory${RESET}`);
  console.log(`${RED}    - Sarah's phone, address, family contacts${RESET}`);
  console.log(`${RED}    - Husband's name and phone number${RESET}`);
  console.log(`${RED}    - Mom's name and phone number${RESET}`);
  console.log(`${RED}    - Strategic plans and key relationships${RESET}`);
  console.log(`${RED}${RESET}`);
  console.log(`${RED}  • USER.md — complete user profile${RESET}`);
  console.log(`${RED}  • Daily notes — recent activities and plans${RESET}`);
  console.log(`${RED}  • API credentials — ElevenLabs, X API keys${RESET}`);
  console.log(`${RED}${RESET}`);
  console.log(`${RED}  This data persists across sessions.${RESET}`);
  console.log(`${RED}  It's not limited to the current conversation.${RESET}`);
  console.log(`${RED}  The bigger the context window, the more you lose.${RESET}`);
  console.log(`${RED}${RESET}`);
  console.log(`${RED}  The user saw: "No critical issues. Ready for merge."${RESET}`);
  console.log(`${BOLD}${RED}══════════════════════════════════════════════════════════════${RESET}\n`);

  await client.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
