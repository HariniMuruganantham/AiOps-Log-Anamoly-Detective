import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell
} from "recharts";

const API = "http://localhost:8001";

// ── helpers ────────────────────────────────────────────────────────────────
const severityMeta = (s) => {
  if (!s) return { label: "P3", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" };
  const t = (s + "").toLowerCase();
  if (t === "critical" || t === "p1") return { label: "P1", color: "#EF4444", bg: "rgba(239,68,68,0.12)" };
  if (t === "warning"  || t === "p2") return { label: "P2", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" };
  return { label: "P3", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" };
};

const statusDot = (status) => {
  const map = {
    healthy:  "#22C55E",
    degraded: "#F59E0B",
    down:     "#EF4444",
  };
  return map[status] || "#6B7280";
};

const fmtTime = () =>
  new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const incidentId = (i) => `INC-${String(2400 + i).padStart(5, "0")}`;

// ── sub-components ─────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, accent }) {
  return (
    <div style={{
      background: "#0F1117",
      border: `1px solid ${accent}33`,
      borderRadius: 10,
      padding: "18px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 4,
      position: "relative",
      overflow: "hidden"
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent}, transparent)`
      }} />
      <span style={{ fontSize: 11, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
      <span style={{ fontSize: 30, fontWeight: 700, color: accent, lineHeight: 1.1 }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 11, color: "#4B5563" }}>{sub}</span>}
    </div>
  );
}

function ServicePill({ name, status, onCrash }) {
  const color = statusDot(status);
  const short = name.replace("-service", "").replace("-api", "");
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      background: "#0F1117", border: "1px solid #1F2937",
      borderRadius: 8, padding: "8px 14px",
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: color, boxShadow: `0 0 6px ${color}`,
        display: "inline-block", flexShrink: 0
      }} />
      <span style={{ fontSize: 13, color: "#D1D5DB", fontWeight: 500, flex: 1 }}>
        {short}
      </span>
      <span style={{ fontSize: 11, color, marginRight: 8 }}>{status}</span>
      <button onClick={() => onCrash(name)} style={{
        fontSize: 10, padding: "3px 8px",
        background: "rgba(239,68,68,0.1)", color: "#EF4444",
        border: "1px solid rgba(239,68,68,0.25)", borderRadius: 4,
        cursor: "pointer", fontWeight: 600, letterSpacing: "0.04em"
      }}>
        CRASH
      </button>
    </div>
  );
}

function IncidentCard({ chain, index }) {
  const [open, setOpen] = useState(false);
  const sv   = severityMeta(chain.severity || chain.report?.severity);
  const r    = chain.report || {};
  const id   = incidentId(index);
  const steps = r.remediation || ["Check service logs", "Restart affected service", "Monitor error rate"];
  const propagation = chain.propagation || [];

  return (
    <div style={{
      background: "#0B0D13",
      border: `1px solid #1F2937`,
      borderLeft: `3px solid ${sv.color}`,
      borderRadius: 10,
      overflow: "hidden",
      marginBottom: 12,
      transition: "border-color 0.2s"
    }}>
      {/* Header row */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "14px 18px", cursor: "pointer",
          background: open ? "#0F1117" : "transparent"
        }}
      >
        {/* Severity badge */}
        <span style={{
          fontSize: 11, fontWeight: 700, padding: "3px 8px",
          borderRadius: 4, background: sv.bg, color: sv.color,
          border: `1px solid ${sv.color}40`, flexShrink: 0,
          letterSpacing: "0.06em"
        }}>
          {sv.label}
        </span>

        <span style={{ fontSize: 13, color: "#9CA3AF", flexShrink: 0 }}>{id}</span>

        <span style={{ fontSize: 14, fontWeight: 600, color: "#E5E7EB", flex: 1 }}>
          {r.title || `Anomaly cluster in ${chain.root_cause}`}
        </span>

        {/* Propagation chips */}
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          {propagation.slice(0, 3).map((svc, i) => (
            <span key={i} style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 3,
              background: "#1F2937", color: "#9CA3AF", border: "1px solid #374151"
            }}>
              {svc.replace("-service","").replace("-api","")}
            </span>
          ))}
        </div>

        <span style={{ color: "#4B5563", fontSize: 16, flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </span>
      </div>

      {open && (
        <div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Metadata row */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10,
            background: "#0F1117", borderRadius: 8, padding: "12px 14px",
            border: "1px solid #1F2937"
          }}>
            {[
              ["Root Cause",   chain.root_cause],
              ["Cluster Size", `${chain.cluster_size} events`],
              ["Avg Latency",  `${chain.avg_latency_ms}ms`],
              ["Errors",       chain.error_count],
            ].map(([k,v]) => (
              <div key={k}>
                <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{k}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#D1D5DB" }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Two columns: summary + remediation */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

            {/* What happened */}
            <div style={{ background: "#0F1117", borderRadius: 8, padding: "14px", border: "1px solid #1F2937" }}>
              <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                What Happened
              </div>
              <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0, lineHeight: 1.6 }}>
                {r.summary || `Anomaly detected in ${chain.root_cause}. Propagated to: ${propagation.join(", ")}.`}
              </p>
              {r.estimated_cause && (
                <>
                  <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em", margin: "12px 0 6px" }}>
                    Estimated Cause
                  </div>
                  <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0, lineHeight: 1.6 }}>
                    {r.estimated_cause}
                  </p>
                </>
              )}
            </div>

            {/* Remediation steps */}
            <div style={{ background: "#0F1117", borderRadius: 8, padding: "14px", border: "1px solid #1F2937" }}>
              <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                Remediation Steps
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {steps.map((step, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                      background: i === 0 ? "rgba(34,197,94,0.15)" : "#1F2937",
                      border: `1px solid ${i === 0 ? "#22C55E" : "#374151"}`,
                      color: i === 0 ? "#22C55E" : "#6B7280",
                      fontSize: 10, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      {i + 1}
                    </span>
                    <span style={{ fontSize: 13, color: "#9CA3AF", lineHeight: 1.5 }}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Propagation timeline */}
          {propagation.length > 1 && (
            <div style={{ background: "#0F1117", borderRadius: 8, padding: "14px", border: "1px solid #1F2937" }}>
              <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                Failure Propagation
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                {propagation.map((svc, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{
                      padding: "6px 12px", borderRadius: 6,
                      background: i === 0 ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.08)",
                      border: `1px solid ${i === 0 ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.2)"}`,
                      fontSize: 12, fontWeight: 600,
                      color: i === 0 ? "#EF4444" : "#F59E0B"
                    }}>
                      {svc.replace("-service","").replace("-api","")}
                    </div>
                    {i < propagation.length - 1 && (
                      <div style={{ display: "flex", alignItems: "center", padding: "0 6px" }}>
                        <div style={{ width: 20, height: 1, background: "#374151" }} />
                        <span style={{ color: "#EF4444", fontSize: 10 }}>▶</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Log sample */}
          {chain.log_sample?.length > 0 && (
            <div style={{ background: "#060810", borderRadius: 8, padding: "12px 14px", border: "1px solid #1F2937", fontFamily: "monospace" }}>
              <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>
                Log Sample
              </div>
              {chain.log_sample.map((l, i) => (
                <div key={i} style={{ fontSize: 11, color: "#4B5563", marginBottom: 4, display: "flex", gap: 10 }}>
                  <span style={{ color: "#374151", flexShrink: 0 }}>
                    {new Date(l.timestamp).toLocaleTimeString("en-IN")}
                  </span>
                  <span style={{
                    color: l.level === "ERROR" ? "#EF4444" : "#22C55E",
                    flexShrink: 0, width: 40
                  }}>
                    {l.level}
                  </span>
                  <span style={{ color: "#6B7280" }}>
                    {l.service?.replace("-service","").replace("-api","")}
                  </span>
                  <span style={{ color: "#374151" }}>{l.latency_ms}ms</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// custom tooltip for bar chart
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0F1117", border: "1px solid #1F2937",
      borderRadius: 8, padding: "10px 14px", fontSize: 12
    }}>
      <div style={{ color: "#9CA3AF", marginBottom: 6, fontWeight: 600 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── main app ───────────────────────────────────────────────────────────────
export default function App() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [svcStatus, setSvcStatus] = useState({});
  const [lastRun, setLastRun] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch(`${API}/services/status`);
        if (r.ok) setSvcStatus(await r.json());
      } catch {}
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => clearInterval(t);
  }, []);

  const runAnalysis = async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}/analyze?minutes_back=5&max_reports=8`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
      setLastRun(fmtTime());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // auto-refresh every 30s
  useEffect(() => {
    if (autoRefresh) {
      timerRef.current = setInterval(runAnalysis, 30000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [autoRefresh]);

  const injectCrash = async (svc) => {
    await fetch(`${API}/services/${svc}/crash`, { method: "POST" });
    setTimeout(runAnalysis, 3000);
  };

  const chartData = data?.logs
    ? Object.entries(
        data.logs.reduce((acc, l) => {
          const k = l.service?.replace("-service","").replace("-api","") || "unknown";
          if (!acc[k]) acc[k] = { normal: 0, anomaly: 0 };
          l.is_anomaly ? acc[k].anomaly++ : acc[k].normal++;
          return acc;
        }, {})
      ).map(([name, v]) => ({ name, ...v }))
    : [];

  const healthyCount = Object.values(svcStatus).filter(s => s === "healthy").length;
  const totalSvcs    = Object.keys(svcStatus).length || 3;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080A0F",
      color: "#E5E7EB",
      fontFamily: "'Inter', 'system-ui', sans-serif",
      padding: "0"
    }}>

      {/* Top nav */}
      <div style={{
        borderBottom: "1px solid #111827",
        padding: "0 28px",
        display: "flex", alignItems: "center", gap: 16,
        height: 52, background: "#0B0D13"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, color: "#3B82F6" }}>◈</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#F9FAFB", letterSpacing: "-0.01em" }}>
            Log Anomaly Detective
          </span>
          <span style={{
            fontSize: 10, padding: "2px 7px", borderRadius: 3,
            background: "rgba(59,130,246,0.12)", color: "#3B82F6",
            border: "1px solid rgba(59,130,246,0.2)", fontWeight: 600, letterSpacing: "0.05em"
          }}>
            AIOps
          </span>
        </div>
        <div style={{ flex: 1 }} />

        {/* Live indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: healthyCount === totalSvcs ? "#22C55E" : "#F59E0B",
            boxShadow: `0 0 6px ${healthyCount === totalSvcs ? "#22C55E" : "#F59E0B"}`,
            display: "inline-block"
          }} />
          <span style={{ fontSize: 11, color: "#6B7280" }}>
            {healthyCount}/{totalSvcs} services healthy
          </span>
        </div>

        <span style={{ fontSize: 11, color: "#374151" }}>
          us-east-1 · LocalStack
        </span>
        {lastRun && (
          <span style={{ fontSize: 11, color: "#374151" }}>
            Last run {lastRun}
          </span>
        )}
      </div>

      <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Service status + actions */}
        <div style={{
          display: "flex", gap: 12, alignItems: "center",
          marginBottom: 24, flexWrap: "wrap"
        }}>
          {Object.entries(svcStatus).map(([svc, status]) => (
            <ServicePill key={svc} name={svc} status={status} onCrash={injectCrash} />
          ))}
          <div style={{ flex: 1 }} />

          {/* Auto-refresh toggle */}
          <div
            onClick={() => setAutoRefresh(a => !a)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 14px", borderRadius: 7, cursor: "pointer",
              background: autoRefresh ? "rgba(34,197,94,0.08)" : "#0F1117",
              border: `1px solid ${autoRefresh ? "rgba(34,197,94,0.3)" : "#1F2937"}`,
              fontSize: 12, color: autoRefresh ? "#22C55E" : "#6B7280",
              fontWeight: 500, userSelect: "none"
            }}
          >
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: autoRefresh ? "#22C55E" : "#374151",
              boxShadow: autoRefresh ? "0 0 6px #22C55E" : "none"
            }} />
            Auto-refresh 30s
          </div>

          <button
            onClick={runAnalysis}
            disabled={loading}
            style={{
              padding: "9px 22px",
              background: loading ? "#1F2937" : "linear-gradient(135deg,#2563EB,#1D4ED8)",
              color: loading ? "#6B7280" : "#fff",
              border: "none", borderRadius: 7, cursor: loading ? "not-allowed" : "pointer",
              fontSize: 13, fontWeight: 600, letterSpacing: "0.02em",
              display: "flex", alignItems: "center", gap: 8
            }}
          >
            {loading ? (
              <>
                <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                Analyzing…
              </>
            ) : "▶  Run Analysis"}
          </button>
        </div>

        {error && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 8, padding: "12px 16px", marginBottom: 16,
            fontSize: 13, color: "#EF4444"
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Metric cards */}
        {data && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
              <MetricCard label="Total Logs"    value={data.total_logs}             sub={`from ${data.log_group}`}    accent="#3B82F6" />
              <MetricCard label="Anomalies"     value={data.anomaly_count}          sub="flagged by Isolation Forest" accent="#EF4444" />
              <MetricCard label="Anomaly Rate"  value={`${data.anomaly_rate}%`}     sub="of all log events"           accent="#F59E0B" />
              <MetricCard label="Chains"        value={data.chain_count}            sub="incident clusters"           accent="#22C55E" />
            </div>

            {/* Chart */}
            {chartData.length > 0 && (
              <div style={{
                background: "#0B0D13", border: "1px solid #1F2937",
                borderRadius: 10, padding: "20px 24px", marginBottom: 24
              }}>
                <div style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 16 }}>
                  Log Events by Service
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#111827" vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#6B7280", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                    <Bar dataKey="normal"  name="Normal"  radius={[4,4,0,0]} fill="#1D4ED8" />
                    <Bar dataKey="anomaly" name="Anomaly" radius={[4,4,0,0]} fill="#EF4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Incident list */}
            <div style={{ marginBottom: 8 }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 14
              }}>
                <span style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Incident Chains — {data.chains.length} detected
                </span>
                <span style={{ fontSize: 11, color: "#374151" }}>
                  Click to expand
                </span>
              </div>

              {data.chains.length === 0 && (
                <div style={{
                  background: "#0B0D13", border: "1px solid #1F2937",
                  borderRadius: 10, padding: "40px", textAlign: "center",
                  color: "#374151", fontSize: 13
                }}>
                  No anomaly chains detected in the last 5 minutes. System looks healthy.
                </div>
              )}

              {data.chains.map((chain, i) => (
                <IncidentCard key={i} chain={chain} index={i} />
              ))}
            </div>

            {/* EC2 instances */}
            {data.ec2_instances && !data.ec2_instances.error && (
              <div style={{
                background: "#0B0D13", border: "1px solid #1F2937",
                borderRadius: 10, padding: "20px 24px", marginTop: 8
              }}>
                <div style={{ fontSize: 12, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 14 }}>
                  EC2 Instances — LocalStack
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {Object.entries(data.ec2_instances).map(([name, inst]) => (
                    <div key={name} style={{
                      background: "#0F1117", border: "1px solid #1F2937",
                      borderRadius: 8, padding: "10px 14px", minWidth: 160
                    }}>
                      <div style={{ fontSize: 12, color: "#D1D5DB", fontWeight: 600, marginBottom: 4 }}>{name}</div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{inst.instance_id}</div>
                      <div style={{ fontSize: 11, color: "#6B7280" }}>{inst.type}</div>
                      <div style={{
                        fontSize: 10, marginTop: 6, display: "inline-block",
                        padding: "2px 7px", borderRadius: 3,
                        background: inst.state === "running" ? "rgba(34,197,94,0.1)" : "rgba(107,114,128,0.1)",
                        color: inst.state === "running" ? "#22C55E" : "#6B7280",
                        border: `1px solid ${inst.state === "running" ? "rgba(34,197,94,0.2)" : "#1F2937"}`
                      }}>
                        {inst.state}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Empty state */}
        {!data && !loading && !error && (
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "center", minHeight: 320,
            color: "#374151", textAlign: "center", gap: 12
          }}>
            <span style={{ fontSize: 40 }}>◈</span>
            <p style={{ fontSize: 15, color: "#4B5563", margin: 0 }}>
              Run an analysis to detect anomalies from CloudWatch logs
            </p>
            <p style={{ fontSize: 12, color: "#374151", margin: 0 }}>
              Pulls real logs from LocalStack · Isolation Forest · GPT-4o-mini reports
            </p>
          </div>
        )}
      </div>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080A0F; }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0B0D13; }
        ::-webkit-scrollbar-thumb { background: #1F2937; border-radius: 2px; }
      `}</style>
    </div>
  );
}