// AlertsPage.jsx
// Shows the full history of all alerts across all conveyors
// Can filter by: ALL, CRITICAL, WARNING, RESOLVED
// Admin/supervisor can mark alerts as resolved

import { useState } from "react"
import { useMachine } from "../context/MachineContext"
import { useAuth } from "../context/AuthContext"
import Navbar from "../components/Navbar"
import Sidebar from "../components/Sidebar"

// Style config per alert level
const LEVEL_CONFIG = {
  critical: {
    color: "#f87171",
    bg: "#1c0f0f",
    border: "#f8717144",
    dot: "#f87171",
    label: "CRITICAL",
  },
  warning: {
    color: "#fbbf24",
    bg: "#18140a",
    border: "#fbbf2444",
    dot: "#fbbf24",
    label: "WARNING",
  },
  resolved: {
    color: "#00e5a0",
    bg: "#071a14",
    border: "#00e5a033",
    dot: "#00e5a0",
    label: "RESOLVED",
  },
}

function AlertsPage() {
  const { alertsHistory, resolveAlert } = useMachine()
  const { user } = useAuth()

  // Active filter tab
  const [filter, setFilter] = useState("ALL")

  // Can this user resolve alerts?
  const canResolve = ["admin", "supervisor"].includes(user?.role)

  // Format time and date from a Date object
  function formatTime(date) {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
  }
  function formatDate(date) {
    return date.toLocaleDateString("en-GB", {
      year: "numeric", month: "2-digit", day: "2-digit",
    })
  }

  // Count stats for the 4 cards at the top
  const totalCount    = alertsHistory.length
  const criticalCount = alertsHistory.filter(a => a.level === "critical" && !a.resolved).length
  const warningCount  = alertsHistory.filter(a => a.level === "warning"  && !a.resolved).length
  const resolvedCount = alertsHistory.filter(a => a.resolved).length

  // Filter the list based on active tab
  const filtered = alertsHistory.filter(a => {
    if (filter === "ALL")      return true
    if (filter === "CRITICAL") return a.level === "critical" && !a.resolved
    if (filter === "WARNING")  return a.level === "warning"  && !a.resolved
    if (filter === "RESOLVED") return a.resolved
    return true
  })

  // Get the right config for an alert
  // If it's resolved we override its level style with "resolved" style
  function getConfig(alert) {
    if (alert.resolved) return LEVEL_CONFIG.resolved
    return LEVEL_CONFIG[alert.level] || LEVEL_CONFIG.warning
  }

  return (
    <div className="min-h-screen bg-[#060b14] flex flex-col">

      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto">

          {/* ── PAGE HEADER ── */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-[#f87171] font-mono text-[11px] tracking-[3px]">
                ◎ ALERTS LOG
              </p>
              <p className="text-[#4a6080] font-mono text-[9px] tracking-widest mt-1">
                ALL CONVEYORS · ALL TIME
              </p>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
              {["ALL", "CRITICAL", "WARNING", "RESOLVED"].map(f => {
                const isActive = filter === f
                const cfg = LEVEL_CONFIG[f.toLowerCase()]
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className="font-mono text-[13px] px-3 py-1.5 rounded-full border transition-all duration-200"
                    style={{
                      borderColor: isActive ? (cfg?.border || "#f8717144") : "#162035",
                      color:       isActive ? (cfg?.color || "#f87171")    : "#4a6080",
                      background:  isActive ? (cfg?.bg    || "#1c0f0f")    : "transparent",
                    }}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── STATS CARDS ── */}
          <div className="grid grid-cols-4 gap-3 flex-shrink-0">
            {[
              { label: "TOTAL ALERTS", value: totalCount,    color: "#94a3b8" },
              { label: "CRITICAL",     value: criticalCount, color: "#f87171" },
              { label: "WARNINGS",     value: warningCount,  color: "#fbbf24" },
              { label: "RESOLVED",     value: resolvedCount, color: "#00e5a0" },
            ].map(stat => (
              <div
                key={stat.label}
                className="bg-[#0a1020] border border-[#162035] rounded-2xl p-4"
              >
                <p className="text-[12px] tracking-widest text-[#4a6080] mb-2">
                  {stat.label}
                </p>
                <p
                  className="text-4xl font-bold font-mono"
                  style={{ color: stat.color }}
                >
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* ── ALERTS LIST ── */}
          <div className="flex flex-col gap-2">

            {filtered.length === 0 ? (
              <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-8 text-center">
                <p className="text-[#4a6080] font-mono text-[15px] tracking-widest">
                  NO ALERTS FOUND
                </p>
              </div>
            ) : (
              filtered.map(alert => {
                const cfg = getConfig(alert)

                return (
                  <div
                    key={alert.id}
                    className="bg-[#0a1020] rounded-2xl px-4 py-3 flex items-center gap-3"
                    style={{
                      border: `1px solid ${cfg.border}`,
                      opacity: alert.resolved ? 0.7 : 1,
                    }}
                  >
                    {/* Colored dot */}
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: cfg.dot }}
                    />

                    {/* Conveyor badge */}
                    <span
                      className="font-mono text-[12px] px-2 py-0.5 rounded-full border flex-shrink-0"
                      style={{
                        color: "#00e5a0",
                        borderColor: "#00e5a033",
                        background: "#071a14",
                      }}
                    >
                      {alert.conveyor}
                    </span>

                    {/* Alert message */}
                    <span className="flex-1 font-mono text-[12px] text-[#cbd5e1]">
                      {alert.message}
                    </span>

                    {/* Level badge */}
                    <span
                      className="font-mono text-[8px] px-2 py-0.5 rounded-full border flex-shrink-0"
                      style={{
                        color: cfg.color,
                        borderColor: cfg.border,
                        background: cfg.bg,
                      }}
                    >
                      {cfg.label}
                    </span>

                    {/* Timestamp */}
                    <div className="text-right flex-shrink-0 min-w-[70px]">
                      <p className="text-[#4a6080] font-mono text-[10px]">
                        {formatTime(alert.timestamp)}
                      </p>
                      <p className="text-[#1e2d45] font-mono text-[10px] mt-0.5">
                        {formatDate(alert.timestamp)}
                      </p>
                    </div>

                    {/* Resolve button — only admin/supervisor, only if not resolved */}
                    {canResolve && !alert.resolved && (
                      <button
                        onClick={() => resolveAlert(alert.id)}
                        className="font-mono text-[12px] px-2 py-1 rounded-lg border border-[#162035] text-[#4a6080] hover:border-[#00e5a033] hover:text-[#00e5a0] transition-colors duration-200 flex-shrink-0"
                      >
                        ✓ RESOLVE
                      </button>
                    )}

                  </div>
                )
              })
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

export default AlertsPage