"use client";

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Card from "@/shared/components/Card";

const fmtTokens = (n) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n || 0);
};

const fmtCost = (n) => `$${(n || 0).toFixed(4)}`;

export default function UsageChart({ period = "7d" }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("tokens");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/usage/chart?period=${period}`);
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error("Failed to fetch chart data:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [period]);

  const hasData = data.some((d) => d.tokens > 0 || d.cost > 0);

  return (
    <Card
      title="Usage"
      icon="show_chart"
      action={
        <div className="flex items-center gap-0.5 text-xs">
          {["tokens", "cost"].map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-2 py-0.5 rounded font-medium transition-colors ${
                viewMode === mode
                  ? "bg-primary/10 text-primary"
                  : "text-text-muted hover:text-text-main"
              }`}
            >
              {mode === "tokens" ? "Tokens" : "Cost"}
            </button>
          ))}
        </div>
      }
      className="min-w-0"
    >
      {loading ? (
        <div className="h-40 flex items-center justify-center text-text-muted text-sm">
          Loading…
        </div>
      ) : !hasData ? (
        <div className="h-40 flex items-center justify-center text-text-muted text-sm">
          No data for this period
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor={viewMode === "tokens" ? "#6366f1" : "#f59e0b"}
                  stopOpacity={0.2}
                />
                <stop
                  offset="95%"
                  stopColor={viewMode === "tokens" ? "#6366f1" : "#f59e0b"}
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fillOpacity: 0.4 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fillOpacity: 0.4 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={viewMode === "tokens" ? fmtTokens : fmtCost}
              width={44}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value, name) =>
                name === "tokens"
                  ? [fmtTokens(value), "Tokens"]
                  : [fmtCost(value), "Cost"]
              }
            />
            <Area
              type="monotone"
              dataKey={viewMode}
              stroke={viewMode === "tokens" ? "#6366f1" : "#f59e0b"}
              strokeWidth={1.5}
              fill="url(#chartGrad)"
              dot={false}
              activeDot={{ r: 3 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

UsageChart.propTypes = {
  period: PropTypes.string,
};
 