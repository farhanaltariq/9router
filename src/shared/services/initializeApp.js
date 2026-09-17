import { cleanupProviderConnections, getSettings } from "@/lib/localDb";
import { killAllBridges } from "@/lib/mcp/stdioSseBridge";

process.setMaxListeners(20);

// Defer heavy startup work so the first HTTP request (login → dashboard) isn't
// starved by DB cleanup and OAuth pings.
const STARTUP_DEFER_MS = 3000;

export async function initializeApp() {
  try {
    // Register exit cleanup so MCP bridges are torn down on shutdown.
    const cleanup = () => {
      try { killAllBridges(); } catch { /* best effort */ }
      process.exit();
    };
    process.on("SIGINT", cleanup);
    process.on("SIGTERM", cleanup);

    // Defer the heavy work — nothing here blocks incoming requests.
    setTimeout(() => {
      runHeavyStartup().catch((e) => console.error("[InitApp] deferred startup failed:", e.message));
    }, STARTUP_DEFER_MS);
  } catch (error) {
    console.error("[InitApp] Error:", error);
  }
}

async function runHeavyStartup() {
  await cleanupProviderConnections();
  const settings = await getSettings();

  if (hasQuotaAutoPingEnabled(settings)) {
    import("@/shared/services/quotaAutoPing")
      .then(({ startQuotaAutoPing }) => startQuotaAutoPing())
      .catch((e) => console.log("[AutoPing] scheduler start failed:", e.message));
  }

  // Proactive OAuth token refresh (e.g. grok-cli ~6h TTL). Module is idempotent
  // and also started from custom-server.js when that entry is used.
  import("@/sse/services/backgroundTokenRefresh.js")
    .then(({ startBackgroundTokenRefresh }) => startBackgroundTokenRefresh())
    .catch((e) => console.log("[BackgroundTokenRefresh] scheduler start failed:", e.message));
}

function hasQuotaAutoPingEnabled(settings) {
  return [settings?.claudeAutoPing, settings?.codexAutoPing]
    .some((config) => Object.values(config?.connections || {}).some(Boolean));
}

export default initializeApp;
