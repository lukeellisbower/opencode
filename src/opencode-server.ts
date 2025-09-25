import { createOpencodeServer } from "@opencode-ai/sdk";

export async function startOpencodeServer() {
  try {
    const server = await createOpencodeServer({
      hostname: "0.0.0.0",
      port: 3001,
    });

    console.log(`🔧 OpenCode server running at ${server.url}`);
    console.log(`📖 OpenAPI docs available at ${server.url}/doc`);

    return server;
  } catch (error) {
    console.error("Failed to start OpenCode server:", error);
    throw error;
  }
}
