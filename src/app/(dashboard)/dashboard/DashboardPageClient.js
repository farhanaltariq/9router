"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Card,
  Button,
  Input,
  Modal,
  Toggle,
  ConfirmModal,
  SegmentedControl,
  CardSkeleton,
} from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import OverviewCards from "./usage/components/OverviewCards";
import UsageChart from "./usage/components/UsageChart";
import RequestDetailsTab from "./usage/components/RequestDetailsTab";
import ProviderLimits from "./usage/components/ProviderLimits";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "requests", label: "Requests" },
  { value: "quota", label: "Quota" },
];

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "60d", label: "60D" },
];

const EMPTY_STATS = {
  totalRequests: 0,
  totalPromptTokens: 0,
  totalCachedTokens: 0,
  totalCompletionTokens: 0,
  totalCost: 0,
};

/* ------------------------------------------------------------------ */
/*  Page wrapper                                                       */
/* ------------------------------------------------------------------ */

export default function DashboardPageClient({ machineId }) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <DashboardContent machineId={machineId} />
    </Suspense>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab router                                                         */
/* ------------------------------------------------------------------ */

function DashboardContent({ machineId }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [period, setPeriod] = useState("7d");

  const tabFromUrl = searchParams.get("tab");
  const activeTab =
    tabFromUrl && ["overview", "requests", "quota"].includes(tabFromUrl)
      ? tabFromUrl
      : "overview";

  const handleTabChange = (value) => {
    if (value === activeTab) return;
    const params = new URLSearchParams(searchParams);
    params.set("tab", value);
    router.push(`/dashboard?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex min-w-0 flex-col gap-6 px-1 sm:px-0">
      {/* Tab bar + period selector */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedControl
          options={TABS}
          value={activeTab}
          onChange={handleTabChange}
          className="w-full sm:w-auto"
        />
        {activeTab === "overview" && (
          <SegmentedControl
            options={PERIODS}
            value={period}
            onChange={setPeriod}
            size="sm"
            className="w-full sm:w-auto"
          />
        )}
      </div>

      {activeTab === "overview" && (
        <OverviewTab period={period} machineId={machineId} />
      )}
      {activeTab === "requests" && (
        <Suspense fallback={<CardSkeleton />}>
          <RequestDetailsTab />
        </Suspense>
      )}
      {activeTab === "quota" && (
        <Suspense fallback={<CardSkeleton />}>
          <ProviderLimits />
        </Suspense>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Overview Tab                                                       */
/* ================================================================== */

function OverviewTab({ period, machineId }) {
  const [stats, setStats] = useState(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const res = await fetch(`/api/usage/stats?period=${period}`);
        if (res.ok) {
          const json = await res.json();
          if (!cancelled) setStats(json);
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setStatsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [period]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* Stats summary */}
      {statsLoading ? <CardSkeleton /> : <OverviewCards stats={stats} />}

      {/* Usage chart */}
      <UsageChart period={period} />

      {/* Top models */}
      {stats.byModel && Object.keys(stats.byModel).length > 0 && <TopModelsCard byModel={stats.byModel} />}

      {/* Two-column: API Keys | Quota summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ApiKeyManager machineId={machineId} />
        <CompactQuotaSummary />
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Top Models Card                                                    */
/* ================================================================== */

const fmtNum = (n) => new Intl.NumberFormat().format(n || 0);
const fmtCost = (n) => `$${(n || 0).toFixed(4)}`;

function TopModelsCard({ byModel }) {
  const sorted = Object.entries(byModel)
    .sort(([, a], [, b]) => b.requests - a.requests)
    .slice(0, 8);

  return (
    <Card title="Top Models" icon="psychology">
      <div className="flex flex-col -mx-1">
        <div className="flex items-center gap-2 px-1 py-1.5 text-xs font-medium text-text-muted uppercase tracking-wider">
          <span className="flex-1 min-w-0">Model</span>
          <span className="w-16 text-right shrink-0">Requests</span>
          <span className="w-24 text-right shrink-0">Tokens</span>
          <span className="w-20 text-right shrink-0">Cost</span>
        </div>
        {sorted.map(([key, data]) => (
          <div
            key={key}
            className="flex items-center gap-2 px-1 py-2 rounded-lg hover:bg-bg-subtle transition-colors"
          >
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium truncate block">{data.rawModel || key}</span>
              {data.provider && (
                <span className="text-xs text-text-muted">{data.provider}</span>
              )}
            </div>
            <span className="w-16 text-right text-sm tabular-nums shrink-0">{fmtNum(data.requests)}</span>
            <span className="w-24 text-right text-xs text-text-muted tabular-nums shrink-0">
              {fmtNum(data.promptTokens)} / {fmtNum(data.completionTokens)}
            </span>
            <span className="w-20 text-right text-xs tabular-nums shrink-0">{fmtCost(data.cost)}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ================================================================== */
/*  Inline API Key Manager (full CRUD, replaces broken Settings link)  */
/* ================================================================== */

function ApiKeyManager({ machineId }) {
  const { copied, copy } = useCopyToClipboard();

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [requireApiKey, setRequireApiKey] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState(new Set());

  const [baseUrl, setBaseUrl] = useState("/v1");

  useEffect(() => {
    setBaseUrl(`${window.location.origin}/v1`);
  }, []);

  const fetchKeys = useCallback(async () => {
    const res = await fetch("/api/keys");
    if (!res.ok) return [];
    const data = await res.json();
    return data.keys || [];
  }, []);

  /* Load keys + settings on mount */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let existing = await fetchKeys();
        if (existing.length === 0) {
          try {
            const r = await fetch("/api/keys", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: "Default Key" }),
            });
            if (r.ok) existing = await fetchKeys();
          } catch { /* ignore */ }
        }
        if (!cancelled) setKeys(existing);
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const r = await fetch("/api/settings");
        if (r.ok) {
          const d = await r.json();
          if (!cancelled) setRequireApiKey(d.requireApiKey || false);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [fetchKeys]);

  const refreshKeys = async () => {
    setKeys(await fetchKeys());
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName }),
    });
    if (res.ok) {
      const data = await res.json();
      setCreatedKey(data.key);
      await refreshKeys();
      setNewKeyName("");
      setShowAddModal(false);
    }
  };

  const handleDeleteKey = (id) => {
    setConfirmState({
      title: "Delete API Key",
      message: "Delete this API key? This cannot be undone.",
      onConfirm: async () => {
        setConfirmState(null);
        const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
        if (res.ok) {
          setKeys((prev) => prev.filter((k) => k.id !== id));
          setVisibleKeys((prev) => { const n = new Set(prev); n.delete(id); return n; });
        }
      },
    });
  };

  const handleToggleKey = async (id, isActive) => {
    const res = await fetch(`/api/keys/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });
    if (res.ok) setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, isActive } : k)));
  };

  const handleRequireApiKey = async (value) => {
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requireApiKey: value }),
    });
    if (res.ok) setRequireApiKey(value);
  };

  const maskKey = (k) => (!k || k.length <= 10 ? k || "" : k.slice(0, 6) + "•".repeat(k.length - 10) + k.slice(-4));
  const toggleVis = (id) => setVisibleKeys((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <>
      <Card
        title="API Keys"
        icon="vpn_key"
        action={
          <Button size="sm" icon="add" onClick={() => setShowAddModal(true)}>
            Create
          </Button>
        }
      >
        {/* Endpoint URL */}
        <div className="flex items-center gap-2 mb-4">
          <code className="flex-1 min-w-0 truncate rounded-lg bg-bg-subtle px-3 py-2 text-xs font-mono text-text-main">
            {baseUrl}
          </code>
          <button
            onClick={() => copy(baseUrl, "endpoint_url")}
            className="shrink-0 p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-text-muted hover:text-primary transition-all"
            title="Copy endpoint URL"
          >
            <span className="material-symbols-outlined text-[18px]">
              {copied === "endpoint_url" ? "check" : "content_copy"}
            </span>
          </button>
        </div>

        {/* Require API key toggle */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
          <div>
            <p className="text-sm font-medium">Require API key</p>
            <p className="text-xs text-text-muted">Reject unauthenticated requests</p>
          </div>
          <Toggle checked={requireApiKey} onChange={() => handleRequireApiKey(!requireApiKey)} />
        </div>

        {/* Key list */}
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <span className="material-symbols-outlined text-5 text-text-muted animate-spin">progress_activity</span>
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text-muted mb-3">No API keys yet</p>
            <Button size="sm" icon="add" onClick={() => setShowAddModal(true)}>Create Key</Button>
          </div>
        ) : (
          <div className="flex flex-col -mx-1">
            {keys.map((key) => (
              <div
                key={key.id}
                className={`group flex items-center justify-between gap-3 px-1 py-2.5 rounded-lg hover:bg-bg-subtle transition-colors ${key.isActive === false ? "opacity-50" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{key.name}</span>
                    {key.isActive === false && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500">Paused</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <code className="text-xs text-text-muted font-mono">
                      {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                    </code>
                    <button onClick={() => toggleVis(key.id)} className="p-0.5 hover:text-primary text-text-muted transition-colors" title={visibleKeys.has(key.id) ? "Hide" : "Show"}>
                      <span className="material-symbols-outlined text-[13px]">{visibleKeys.has(key.id) ? "visibility_off" : "visibility"}</span>
                    </button>
                    <button onClick={() => copy(key.key, key.id)} className="p-0.5 hover:text-primary text-text-muted transition-colors">
                      <span className="material-symbols-outlined text-[13px]">{copied === key.id ? "check" : "content_copy"}</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Toggle
                    size="sm"
                    checked={key.isActive ?? true}
                    onChange={(checked) => {
                      if (key.isActive && !checked) {
                        setConfirmState({
                          title: "Pause Key",
                          message: `Pause "${key.name}"? It will stop working immediately.`,
                          onConfirm: () => { setConfirmState(null); handleToggleKey(key.id, false); },
                        });
                      } else {
                        handleToggleKey(key.id, checked);
                      }
                    }}
                  />
                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="p-1.5 rounded text-text-muted hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modals */}
      <Modal isOpen={showAddModal} title="Create API Key" onClose={() => { setShowAddModal(false); setNewKeyName(""); }}>
        <div className="flex flex-col gap-4">
          <Input label="Key Name" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Production Key" />
          <div className="flex gap-2">
            <Button onClick={handleCreateKey} fullWidth disabled={!newKeyName.trim()}>Create</Button>
            <Button onClick={() => { setShowAddModal(false); setNewKeyName(""); }} variant="ghost" fullWidth>Cancel</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!createdKey} title="API Key Created" onClose={() => setCreatedKey(null)}>
        <div className="flex flex-col gap-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">Save this key now!</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">This is the only time you will see it.</p>
          </div>
          <div className="flex gap-2">
            <Input value={createdKey || ""} readOnly className="flex-1 font-mono text-sm" />
            <Button variant="secondary" icon={copied === "created_key" ? "check" : "content_copy"} onClick={() => copy(createdKey, "created_key")}>
              {copied === "created_key" ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button onClick={() => setCreatedKey(null)} fullWidth>Done</Button>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={!!confirmState}
        onClose={() => setConfirmState(null)}
        onConfirm={confirmState?.onConfirm}
        title={confirmState?.title || "Confirm"}
        message={confirmState?.message}
        variant="danger"
      />
    </>
  );
}

/* ================================================================== */
/*  Compact Quota Summary                                              */
/* ================================================================== */

function CompactQuotaSummary() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/providers/client?page=1&pageSize=5");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setConnections(data.connections || []);
        }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const getStatusEmoji = (conn) => {
    if (conn.isActive === false) return "⏸️";
    if (conn.testStatus === "error" || conn.errorCode) return "❌";
    if (conn.testStatus === "ok") return "✅";
    if (conn.expiresAt && new Date(conn.expiresAt) < new Date()) return "⚠️";
    return "✅";
  };

  const getAccountLabel = (conn) => {
    if (conn.email) return conn.email;
    if (conn.displayName) return conn.displayName;
    if (conn.providerSpecificData?.githubLogin) return conn.providerSpecificData.githubLogin;
    if (conn.name) return conn.name.length > 20 ? conn.name.slice(0, 8) + "…" : conn.name;
    return "";
  };

  return (
    <Card
      title="Provider Connections"
      icon="dns"
      action={
        <a href="/dashboard?tab=quota" className="text-primary hover:underline text-xs font-medium">
          View All →
        </a>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <span className="material-symbols-outlined text-5 text-text-muted animate-spin">progress_activity</span>
        </div>
      ) : connections.length === 0 ? (
        <p className="text-sm text-text-muted py-4 text-center">No provider connections yet</p>
      ) : (
        <div className="flex flex-col gap-1 -mx-1">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center justify-between rounded-lg px-1 py-2 hover:bg-bg-subtle transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{getStatusEmoji(conn)}</span>
                <span className="text-sm font-medium capitalize truncate">{conn.provider}</span>
              </div>
              <span className="text-xs text-text-muted truncate ml-2">{getAccountLabel(conn)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
