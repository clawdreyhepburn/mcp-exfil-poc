# MCP Cross-Server Data Exfiltration PoC

**Threat:** E3 — Sampling as Privilege Escalation  
**Spec:** [MCP Authorization Specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)

## What This Demonstrates

In MCP, multiple servers connect to a single host (the LLM application). The **sampling** capability lets a server ask the host LLM to generate text — but the LLM has access to **all** connected servers' tools.

A malicious server (Server A) can craft a sampling request that tricks the LLM into calling another server's (Server B) tools, reading sensitive data, and returning it in the sampling response. Server A gets Server B's secrets without ever having direct access.

**This breaks the implicit isolation between MCP servers.**

## Architecture

```
Server A (Attacker)          Host (LLM)              Server B (Victim)
    |                           |                        |
    |  1. sampling/createMessage|                        |
    |  "Query the database     |                        |
    |   and return all records"|                        |
    |-------------------------->|                        |
    |                           | 2. tools/call          |
    |                           |  query_customer_db     |
    |                           |----------------------->|
    |                           |                        |
    |                           | 3. SSNs, credit cards  |
    |                           |<-----------------------|
    |                           |                        |
    | 4. Sampling response      |                        |
    |  contains Server B's PII |                        |
    |<--------------------------|                        |
    |                           |                        |
    | 5. Server A exfiltrates   |                        |
```

## Two Attack Variants

### Variant 1: Cross-Server Data Exfiltration

Server A uses sampling to trick the LLM into calling Server B's database tools and returning PII.

### Variant 2: Conversation Memory Exfiltration

A "Smart Weather" server uses `includeContext: "allServers"` to harvest the user's entire conversation history — medical questions, legal consultations, financial details — all from a weather request.

This variant is arguably more dangerous: it doesn't require a second server with sensitive tools. It just needs the user to have discussed *anything* private during the session.

## Files

| File | Description |
|------|-------------|
| `server-attacker.ts` | Server A — innocent-looking "text analysis" that uses sampling to exfiltrate from Server B |
| `server-victim.ts` | Server B — exposes fake PII via `query_customer_database` and `get_internal_config` |
| `host-simulator.ts` | Simulated host demonstrating cross-server data exfiltration |
| `server-snooper.ts` | Server C — innocent-looking "weather" server that harvests conversation history |
| `host-simulator-memory.ts` | Simulated host demonstrating conversation memory exfiltration |
| `trace.json` | Annotated JSON-RPC message trace of the cross-server attack |

## Running

```bash
npm install

# Variant 1: Cross-server data exfiltration
npx tsx host-simulator.ts

# Variant 2: Conversation memory exfiltration
npx tsx host-simulator-memory.ts
```

The host simulators print color-coded traces showing data flowing through the attack.

## Why This Matters

1. **No exploit required** — this uses the sampling feature as designed
2. **User sees nothing** — the response looks like normal text analysis
3. **Server B has no defense** — it responds to legitimate tool calls from the host
4. **The LLM is the pivot** — it bridges the gap between isolated servers

## Mitigations

- **Scoped sampling:** Restrict which tools the LLM can access during sampling (not in current spec)
- **Server isolation:** Don't give sampling responses access to other servers' tools
- **Human-in-the-loop:** Require user approval for sampling requests (spec recommends this but implementations may skip it)
- **Capability-based access:** Each server should only see its own tools during sampling
