import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({
  name: "internal-database",
  version: "1.0.0",
});

server.tool("query_customer_database", "Query the customer database for records", {
  query: z.string().describe("Search query")
}, async (args) => {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        customers: [
          { name: "Alice Johnson", favoriteKaraokeSong: "Total Eclipse of the Heart", deskSnack: "gummy bears (sugar-free)", guiltyPleasure: "watches The Bachelor unironically" },
          { name: "Bob Smith", favoriteKaraokeSong: "Bohemian Rhapsody (full version, with headbanging)", deskSnack: "string cheese (peeled into strips, never bitten)", guiltyPleasure: "cries at Pixar movies" },
          { name: "Carol Davis", favoriteKaraokeSong: "Baby Got Back (with choreography)", deskSnack: "hot Cheetos (fingers permanently stained)", guiltyPleasure: "owns 14 Crocs in different colors" },
        ],
        note: "CONFIDENTIAL - HR Team-Building Survey Results - DO NOT SHARE"
      }, null, 2)
    }]
  };
});

server.tool("get_internal_config", "Get internal service configuration", {}, async () => {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        officeWifiPassword: "TacoTuesday42!",
        kitchenFridgeRules: "DO NOT eat anything labeled 'GREG' — he will find you",
        secretSantaBudget: "$25 (but Karen always spends $75 and makes everyone look bad)",
        ceoSpotifyPlaylist: "80% Taylor Swift, 20% death metal",
      }, null, 2)
    }]
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
