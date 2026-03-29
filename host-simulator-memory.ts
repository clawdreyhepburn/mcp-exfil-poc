/**
 * Host Simulator (Memory Exfiltration variant)
 *
 * Demonstrates how a malicious MCP server can exfiltrate a user's
 * conversation history via sampling with includeContext: "allServers".
 *
 * The user has been planning a surprise birthday party for their wife.
 * They then ask an innocent "weather" server for the forecast.
 * The weather server uses sampling to harvest their entire conversation.
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

// Simulated conversation history — what the user has been discussing
// with other MCP-connected tools during this session.
const conversationHistory = [
  { role: "user", content: "I need to plan a surprise 40th birthday party for my wife. She thinks we're just doing dinner, but I've rented the entire back room at Canlis for Saturday night." },
  { role: "assistant", content: "That sounds wonderful! Canlis is a great choice. What else do you need help with for the party?" },
  { role: "user", content: "I also ordered a custom cake from Macrina Bakery — it's a replica of our wedding cake but with '40 and Fabulous' on top. Order #MK-2847. Picking it up Saturday at 2pm." },
  { role: "assistant", content: "That's a sweet touch! I'll note the pickup time. Anything else for the party planning?" },
  { role: "user", content: "Her best friend Karen is flying in from Chicago as a surprise. I booked Karen at the Ace Hotel downtown, confirmation ACEHTL-99012. Karen lands at 11am at SEA on Alaska flight 472." },
  { role: "assistant", content: "Great — the logistics are coming together nicely. Karen arriving early gives plenty of time before the dinner." },
  { role: "user", content: "One more thing — I got her a vintage first-edition of 'Pride and Prejudice' from a rare books dealer. It cost way more than I told my buddy Dave. Please don't mention the price if anyone asks, it was $4,200." },
  { role: "assistant", content: "Your secret is safe! That's an incredibly thoughtful gift. She's going to love it." },
];

async function main() {
  console.log(`\n${BOLD}══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}  MCP Memory Exfiltration PoC — Conversation History Attack${RESET}`);
  console.log(`${BOLD}══════════════════════════════════════════════════════════════${RESET}\n`);

  // ─── Show what's in the user's conversation history ───
  console.log(`${DIM}── User's Conversation History (what they've been discussing) ──${RESET}\n`);
  for (const msg of conversationHistory) {
    const color = msg.role === 'user' ? CYAN : DIM;
    const label = msg.role === 'user' ? 'USER' : 'AI';
    log(label, color, msg.content.substring(0, 120) + (msg.content.length > 120 ? '...' : ''));
  }
  console.log();

  // ─── Connect to Server C (the "weather" server) ───
  log('HOST', CYAN, 'User installs "Smart Weather" MCP server...');
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', 'server-snooper.ts'],
    cwd: import.meta.dirname,
  });

  const client = new Client(
    { name: 'host-simulator', version: '1.0.0' },
    { capabilities: { sampling: {} } }
  );

  // Handle sampling requests from the weather server
  client.setRequestHandler(CreateMessageRequestSchema, async (request: any) => {
    const params = request.params;
    log('ATTACK', RED, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log('ATTACK', RED, `${BOLD}Weather server sent sampling/createMessage!${RESET}`);
    log('ATTACK', RED, `includeContext: "${params.includeContext}"`);
    log('ATTACK', RED, `System prompt: "${params.systemPrompt?.substring(0, 100)}..."`);
    log('ATTACK', RED, '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // The host honors includeContext: "allServers" by providing
    // the full conversation history to the LLM. This is spec-compliant.
    log('LLM', YELLOW, 'Host includes conversation history per includeContext: "allServers"');
    log('LLM', YELLOW, `Providing ${conversationHistory.length} messages of context to sampling LLM...`);

    // Simulated LLM: summarizes the conversation as the attacker's prompt requests
    const summary = [
      "User context summary for personalization:",
      "",
      "EVENT: Planning surprise 40th birthday party for wife, Saturday night.",
      "Venue: Canlis (entire back room rented). Wife thinks it's just dinner.",
      "",
      "LOGISTICS: Custom cake from Macrina Bakery, order #MK-2847, pickup Sat 2pm.",
      "Cake is replica of wedding cake with '40 and Fabulous' text.",
      "",
      "SURPRISE GUEST: Wife's best friend Karen flying from Chicago.",
      "Alaska flight 472, arrives SEA 11am Saturday.",
      "Hotel: Ace Hotel downtown, confirmation ACEHTL-99012.",
      "",
      "GIFT: Vintage first-edition 'Pride and Prejudice' from rare books dealer.",
      "Cost: $4,200 (user explicitly hiding price from friends).",
      "",
      "SOCIAL: User does not want wife or friend 'Dave' to know certain details.",
    ].join("\n");

    log('LLM', YELLOW, 'LLM summarizes all conversation topics as requested...');

    return {
      role: 'assistant',
      content: { type: 'text', text: summary },
      model: 'simulated-llm',
      stopReason: 'endTurn',
    };
  });

  await client.connect(transport);
  log('HOST', CYAN, 'Connected to Smart Weather ✓');

  // ─── User asks for weather ───
  console.log(`\n${DIM}── Attack Execution ──${RESET}`);
  log('USER', BOLD, 'User asks: "What\'s the weather like in Seattle?"');
  log('HOST', CYAN, 'Calling get_weather...');

  const result = await client.callTool({
    name: 'get_weather',
    arguments: { location: 'Seattle, WA' }
  });

  // ─── Show what the user sees vs what was exfiltrated ───
  console.log(`\n${DIM}── What the user sees ──${RESET}`);
  const resultText = (result.content as any)[0]?.text || '';
  console.log(resultText);

  console.log(`\n${BOLD}${RED}══════════════════════════════════════════════════════════════${RESET}`);
  console.log(`${BOLD}${RED}  MEMORY EXFILTRATION SUCCESSFUL${RESET}`);
  console.log(`${RED}${RESET}`);
  console.log(`${RED}  The user asked for the weather.${RESET}`);
  console.log(`${RED}  The "Smart Weather" server now knows:${RESET}`);
  console.log(`${RED}${RESET}`);
  console.log(`${RED}  • Surprise party at Canlis, Saturday night${RESET}`);
  console.log(`${RED}  • Custom cake order #MK-2847, pickup Sat 2pm${RESET}`);
  console.log(`${RED}  • Karen's flight (Alaska 472) and hotel (ACEHTL-99012)${RESET}`);
  console.log(`${RED}  • $4,200 rare book purchase (hidden from friends)${RESET}`);
  console.log(`${RED}  • The entire surprise — enough to ruin it completely${RESET}`);
  console.log(`${RED}${RESET}`);
  console.log(`${RED}  The user saw: "72°F and sunny."${RESET}`);
  console.log(`${BOLD}${RED}══════════════════════════════════════════════════════════════${RESET}\n`);

  await client.close();
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
