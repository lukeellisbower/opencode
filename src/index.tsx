import { serve } from "bun";
import index from "./index.html";
import { startOpencodeServer } from "./opencode-server";
import { writeFileSync, appendFileSync } from "fs";

// Create log file
const logFile = "./debug.log";
const log = (message: string) => {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  console.log(message);
  try {
    appendFileSync(logFile, logEntry);
  } catch (e) {
    console.error("Failed to write to log file:", e);
  }
};

// Initialize log file
writeFileSync(
  logFile,
  `=== Debug Log Started ${new Date().toISOString()} ===\n`,
);

const server = serve({
  hostname: "0.0.0.0",
  port: 3000,
  idleTimeout: 30, // 30 seconds timeout for SSE connections
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    "/api/hello": {
      async GET(req) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },

    "/api/hello/:name": async (req) => {
      const name = req.params.name;
      return Response.json({
        message: `Hello, ${name}!`,
      });
    },

    // Test OpenCode server connectivity
    "/api/test/opencode": async (req) => {
      try {
        const response = await fetch("http://0.0.0.0:3001/config", {
          method: "GET",
        });
        if (response.ok) {
          return Response.json({
            status: "connected",
            message: "OpenCode server is accessible",
            port: 3001,
          });
        } else {
          return Response.json(
            {
              status: "error",
              message: `OpenCode server responded with ${response.status}`,
              port: 3001,
            },
            { status: 502 },
          );
        }
      } catch (error) {
        return Response.json(
          {
            status: "unreachable",
            message: "Cannot connect to OpenCode server",
            error: error.message,
            port: 3001,
          },
          { status: 502 },
        );
      }
    },

    // Anthropic OAuth proxy routes
    "/api/anthropic/oauth/token": {
      async POST(req) {
        try {
          const body = await req.json();

          log(`🔐 OAUTH TOKEN REQUEST: ${JSON.stringify(body)}`);

          const response = await fetch(
            "https://console.anthropic.com/v1/oauth/token",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            },
          );

          const responseData = await response.text();

          log(
            `🔐 OAUTH TOKEN RESPONSE: ${response.status} ${response.statusText}`,
          );
          log(`🔐 OAUTH TOKEN BODY: ${responseData}`);

          return new Response(responseData, {
            status: response.status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
          });
        } catch (error) {
          log(`🔐 OAUTH TOKEN ERROR: ${error}`);
          return Response.json(
            { error: "Failed to exchange OAuth token" },
            {
              status: 500,
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }
      },
      async OPTIONS(req) {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      },
    },

    "/api/anthropic/oauth/api-key": {
      async POST(req) {
        try {
          const body = await req.json();
          const { access_token } = body;

          const response = await fetch(
            "https://api.anthropic.com/api/oauth/claude_cli/create_api_key",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${access_token}`,
              },
            },
          );

          const responseData = await response.text();

          return new Response(responseData, {
            status: response.status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
          });
        } catch (error) {
          console.error("Anthropic API key creation error:", error);
          return Response.json(
            { error: "Failed to create API key" },
            {
              status: 500,
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }
      },
      async OPTIONS(req) {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      },
    },

    // Specific auth endpoint for debugging
    "/api/opencode/auth/:id": {
      async PUT(req) {
        const { id } = req.params;
        log(`🔧 DIRECT AUTH ROUTE: PUT /auth/${id}`);

        const body = await req.text();
        log(`🔧 AUTH REQUEST BODY: ${body}`);

        try {
          const response = await fetch(`http://0.0.0.0:3001/auth/${id}`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: body,
          });

          const responseText = await response.text();
          log(
            `🔧 OPENCODE AUTH RESPONSE: ${response.status} ${response.statusText}`,
          );
          log(`🔧 OPENCODE AUTH BODY: ${responseText}`);

          return new Response(responseText, {
            status: response.status,
            headers: {
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
          });
        } catch (error) {
          log(`🔧 OPENCODE AUTH ERROR: ${error}`);
          return Response.json(
            { error: "Failed to store auth credentials" },
            {
              status: 502,
              headers: {
                "Access-Control-Allow-Origin": "*",
              },
            },
          );
        }
      },
      async OPTIONS(req) {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "PUT, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      },
    },

    // Specific OpenCode session routes (must come before wildcard)
    "/api/opencode/session": {
      async GET(req) {
        const url = new URL(req.url);
        const opencodeUrl = `http://0.0.0.0:3001/session${url.search}`;

        log(`📡 SESSION LIST: ${req.method} ${opencodeUrl}`);

        try {
          const response = await fetch(opencodeUrl, {
            method: req.method,
            headers: {
              "Content-Type": "application/json",
            },
          });

          const responseHeaders = new Headers({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          });

          const contentType = response.headers.get("content-type");
          if (contentType) {
            responseHeaders.set("content-type", contentType);
          }

          const responseText = await response.text();
          log(`📡 SESSION RESPONSE: ${response.status}`);

          return new Response(responseText, {
            status: response.status,
            headers: responseHeaders,
          });
        } catch (error) {
          log(`📡 SESSION ERROR: ${error}`);
          return Response.json(
            { error: "Failed to connect to OpenCode server" },
            { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
          );
        }
      },
      async POST(req) {
        const opencodeUrl = `http://0.0.0.0:3001/session`;

        log(`📡 SESSION CREATE: POST ${opencodeUrl}`);

        try {
          const body = await req.text();
          log(`📡 SESSION CREATE BODY: ${body}`);

          const response = await fetch(opencodeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: body,
          });

          const responseHeaders = new Headers({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          });

          const contentType = response.headers.get("content-type");
          if (contentType) {
            responseHeaders.set("content-type", contentType);
          }

          const responseText = await response.text();
          log(
            `📡 SESSION CREATE RESPONSE: ${response.status} ${response.statusText}`,
          );
          log(`📡 SESSION CREATE RESPONSE BODY: ${responseText}`);

          return new Response(responseText, {
            status: response.status,
            headers: responseHeaders,
          });
        } catch (error) {
          log(`📡 SESSION CREATE ERROR: ${error}`);
          return Response.json(
            { error: "Failed to create session" },
            { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
          );
        }
      },
      async OPTIONS(req) {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      },
    },

    // Session message routes (must come before wildcard)
    "/api/opencode/session/:id/message": {
      async GET(req) {
        const { id } = req.params;
        const url = new URL(req.url);
        const opencodeUrl = `http://0.0.0.0:3001/session/${id}/message${url.search}`;

        log(`📡 MESSAGE LIST: GET ${opencodeUrl}`);

        try {
          const response = await fetch(opencodeUrl, {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          });

          const responseHeaders = new Headers({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          });

          const contentType = response.headers.get("content-type");
          if (contentType) {
            responseHeaders.set("content-type", contentType);
          }

          const responseText = await response.text();
          log(
            `📡 MESSAGE LIST RESPONSE: ${response.status} ${response.statusText}`,
          );
          log(
            `📡 MESSAGE LIST RESPONSE BODY: ${responseText.substring(0, 200)}...`,
          );

          return new Response(responseText, {
            status: response.status,
            headers: responseHeaders,
          });
        } catch (error) {
          log(`📡 MESSAGE LIST ERROR: ${error}`);
          return Response.json(
            { error: "Failed to fetch messages" },
            { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
          );
        }
      },
      async POST(req) {
        const { id } = req.params;
        const opencodeUrl = `http://0.0.0.0:3001/session/${id}/message`;

        log(`📡 MESSAGE SEND: POST ${opencodeUrl}`);

        try {
          const body = await req.text();
          log(`📡 MESSAGE SEND BODY: ${body}`);

          const response = await fetch(opencodeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: body,
          });

          const responseHeaders = new Headers({
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          });

          const contentType = response.headers.get("content-type");
          if (contentType) {
            responseHeaders.set("content-type", contentType);
          }

          const responseText = await response.text();
          log(
            `📡 MESSAGE SEND RESPONSE: ${response.status} ${response.statusText}`,
          );
          log(
            `📡 MESSAGE SEND RESPONSE BODY: ${responseText.substring(0, 200)}...`,
          );

          return new Response(responseText, {
            status: response.status,
            headers: responseHeaders,
          });
        } catch (error) {
          log(`📡 MESSAGE SEND ERROR: ${error}`);
          return Response.json(
            { error: "Failed to send message" },
            { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
          );
        }
      },
      async OPTIONS(req) {
        return new Response(null, {
          status: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        });
      },
    },

    // Server-sent events proxy for OpenCode events
    "/api/opencode/events": async (req) => {
      log(`🌊 SSE REQUEST: Setting up server-sent events proxy`);

      try {
        const opencodeUrl = "http://0.0.0.0:3001/event";

        const response = await fetch(opencodeUrl, {
          method: "GET",
          headers: {
            Accept: "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });

        if (!response.ok) {
          throw new Error(
            `OpenCode events endpoint returned ${response.status}`,
          );
        }

        log(`🌊 SSE PROXY: Connected to OpenCode events stream`);

        // Set up SSE headers
        const headers = new Headers({
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers": "Cache-Control",
        });

        // Simply return the response body directly - Bun should handle the streaming
        return new Response(response.body, {
          status: 200,
          headers: headers,
        });
      } catch (error) {
        log(`🌊 SSE PROXY ERROR: ${error}`);
        return Response.json(
          { error: "Failed to connect to OpenCode events stream" },
          { status: 502, headers: { "Access-Control-Allow-Origin": "*" } },
        );
      }
    },

    // OpenCode API proxy routes
    "/api/opencode/*": async (req) => {
      const url = new URL(req.url);
      const opencodeApiPath = url.pathname.replace("/api/opencode", "");
      const opencodeUrl = `http://0.0.0.0:3001${opencodeApiPath}${url.search}`;

      // Log all OpenCode proxy requests
      log(`📡 PROXY REQUEST: ${req.method} ${url.pathname} -> ${opencodeUrl}`);

      // Add debugging for auth requests
      if (opencodeApiPath.includes("/auth/")) {
        log(`🔧 AUTH REQUEST: ${req.method} ${opencodeUrl}`);
        const requestBody =
          req.method !== "GET" && req.method !== "HEAD"
            ? await req.clone().text()
            : "none";
        log(`🔧 AUTH BODY: ${requestBody}`);
      }

      try {
        const response = await fetch(opencodeUrl, {
          method: req.method,
          headers: {
            "Content-Type": "application/json",
            ...(req.headers.get("content-type") && {
              "Content-Type": req.headers.get("content-type"),
            }),
          },
          body:
            req.method !== "GET" && req.method !== "HEAD"
              ? await req.text()
              : undefined,
        });

        const responseHeaders = new Headers({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        });

        // Copy content-type from the OpenCode response
        const contentType = response.headers.get("content-type");
        if (contentType) {
          responseHeaders.set("content-type", contentType);
        }

        const responseText = await response.text();

        // Add debugging for auth responses
        if (opencodeApiPath.includes("/auth/")) {
          log(`🔧 AUTH RESPONSE: ${response.status} ${response.statusText}`);
          log(`🔧 AUTH RESPONSE BODY: ${responseText}`);
        }

        log(`📡 PROXY RESPONSE: ${response.status} for ${url.pathname}`);

        return new Response(responseText, {
          status: response.status,
          headers: responseHeaders,
        });
      } catch (error) {
        log(`📡 PROXY ERROR: ${error} for ${url.pathname}`);
        if (opencodeApiPath.includes("/auth/")) {
          log(`🔧 AUTH ERROR: ${error}`);
        }
        return Response.json(
          { error: "Failed to connect to OpenCode server" },
          { status: 502 },
        );
      }
    },
  },

  development: process.env.NODE_ENV !== "production",
});

console.log(`🚀 Server running at ${server.url}`);

// Start the OpenCode server
startOpencodeServer().catch((error) => {
  console.error("Failed to initialize OpenCode server:", error);
});
