// TechLogPage.jsx
// Page where technicians write what they did on each conveyor
// Every entry is saved with: who, which conveyor, type, text, timestamp
// Admin and supervisor can read all entries
// Only technician/admin/supervisor can write entries

import { useState } from "react"
import { useMachine } from "../context/MachineContext"
import { useAuth } from "../context/AuthContext"
import Navbar from "../components/Navbar"
import Sidebar from "../components/Sidebar"

// Config for each log type — color and symbol
const TYPE_CONFIG = {
  MAINTENANCE: {
    color: "#fbbf24",
    bg: "#18140a",
    border: "#fbbf2433",
    symbol: "⚙",
  },
  INSPECTION: {
    color: "#60a5fa",
    bg: "#0a1320",
    border: "#60a5fa33",
    symbol: "◎",
  },
  REPAIR: {
    color: "#f87171",
    bg: "#1c0f0f",
    border: "#f8717133",
    symbol: "✕",
  },
}

function TechLogPage() {
  const { conveyors, techLogs, addTechLog } = useMachine()
  const { user } = useAuth()

  // Form state — what the technician is typing
  const [selectedConveyor, setSelectedConveyor] = useState(
    conveyors[0]?.name || "Conveyor 1"
  )
  const [selectedType, setSelectedType]   = useState("MAINTENANCE")
  const [text, setText]                   = useState("")
  const [filter, setFilter]               = useState("ALL") // filter by type
  const [submitted, setSubmitted]         = useState(false) // success flash

  // Who can write entries?
  const canWrite = ["admin", "supervisor", "technician"].includes(user?.role)

  // Format timestamp nicely
  function formatTime(date) {
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    })
  }

  function formatDate(date) {
    return date.toLocaleDateString("en-GB", {
      year: "numeric", month: "2-digit", day: "2-digit"
    })
  }

  // Handle form submission
  function handleSubmit() {
    // Don't submit if text is empty
    if (!text.trim()) return

    addTechLog({
      conveyor: selectedConveyor,
      type: selectedType,
      text: text.trim(),
      author: user?.username,
    })

    // Clear the form
    setText("")

    // Show success flash for 2 seconds
    setSubmitted(true)
    setTimeout(() => setSubmitted(false), 2000)
  }

  // Filter logs based on selected filter tab
  const filteredLogs = filter === "ALL"
    ? techLogs
    : techLogs.filter(log => log.type === filter)

  return (
    <div className="min-h-screen bg-[#060b14] flex flex-col">

      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        {/* Main content area */}
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto">

          {/* ── PAGE HEADER ── */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-[#fbbf24] font-mono text-[11px] tracking-[3px]">
                ✎ TECHNICIAN LOG
              </p>
              <p className="text-[#4a6080] font-mono text-[10px] tracking-widest mt-1">
                {techLogs.length} TOTAL ENTRIES
              </p>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2">
              {["ALL", "MAINTENANCE", "INSPECTION", "REPAIR"].map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="font-mono text-[13px] px-3 py-1.5 rounded-full border transition-all duration-200"
                  style={{
                    borderColor: filter === f
                      ? (TYPE_CONFIG[f]?.border?.replace("33","88") || "#fbbf2488")
                      : "#162035",
                    color: filter === f
                      ? (TYPE_CONFIG[f]?.color || "#fbbf24")
                      : "#4a6080",
                    background: filter === f
                      ? (TYPE_CONFIG[f]?.bg || "#18140a")
                      : "transparent",
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* ── WRITE NEW ENTRY (only if allowed) ── */}
          {canWrite && (
            <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-4 flex-shrink-0">

              <p className="text-[13px] tracking-widest text-[#4a6080] mb-3">
                NEW ENTRY
              </p>

              {/* Conveyor + Type selectors */}
              <div className="flex gap-3 mb-3">

                {/* Which conveyor? */}
                <select
                  value={selectedConveyor}
                  onChange={e => setSelectedConveyor(e.target.value)}
                  className="flex-1 bg-[#060b14] border border-[#162035] rounded-lg text-[#94a3b8] font-mono text-[13px] px-3 py-2 focus:outline-none focus:border-[#fbbf2444]"
                >
                  {conveyors.map(cv => (
                    <option key={cv.id} value={cv.name}>
                      {cv.name} — {cv.zone}
                    </option>
                  ))}
                </select>

                {/* Type of intervention */}
                <select
                  value={selectedType}
                  onChange={e => setSelectedType(e.target.value)}
                  className="bg-[#060b14] border border-[#162035] rounded-lg font-mono text-[13px] px-3 py-2 focus:outline-none focus:border-[#fbbf2444]"
                  style={{ color: TYPE_CONFIG[selectedType]?.color }}
                >
                  <option value="MAINTENANCE">MAINTENANCE</option>
                  <option value="INSPECTION">INSPECTION</option>
                  <option value="REPAIR">REPAIR</option>
                </select>
              </div>

              {/* Text area */}
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Describe what was done, parts replaced, observations, measurements..."
                rows={3}
                className="w-full bg-[#060b14] border border-[#162035] rounded-lg text-[#94a3b8] font-mono text-[13px] px-3 py-2.5 resize-none focus:outline-none focus:border-[#fbbf2444] leading-relaxed"
              />

              {/* Bottom row: hint + submit */}
              <div className="flex items-center justify-between mt-3">
                <p className="text-[13px] text-[#2a3a50] tracking-wider">
                  Signed as{" "}
                  <span className="text-[#4a6080]">{user?.username}</span>
                  {" "}· Timestamp added automatically
                </p>

                <button
                  onClick={handleSubmit}
                  disabled={!text.trim()}
                  className={`font-mono text-[13px] px-5 py-2 rounded-lg border tracking-wider transition-all duration-200
                    ${text.trim()
                      ? "text-[#fbbf24] border-[#fbbf2444] bg-[#18140a] hover:bg-[#fbbf2411] cursor-pointer active:scale-95"
                      : "text-[#2a3a50] border-[#162035] cursor-not-allowed"
                    }`}
                >
                  {/* Show checkmark flash when submitted */}
                  {submitted ? "✓ SAVED" : "+ SUBMIT ENTRY"}
                </button>
              </div>
            </div>
          )}

          {/* ── LOG ENTRIES LIST ── */}
          <div className="flex flex-col gap-3">

            {filteredLogs.length === 0 ? (
              // No entries found for this filter
              <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-8 text-center">
                <p className="text-[#4a6080] font-mono text-[10px] tracking-widest">
                  NO ENTRIES FOUND
                </p>
              </div>
            ) : (
              filteredLogs.map(log => {
                const cfg = TYPE_CONFIG[log.type] || TYPE_CONFIG.MAINTENANCE

                return (
                  <div
                    key={log.id}
                    className="bg-[#0a1020] rounded-2xl p-4 grid gap-3"
                    style={{
                      border: `1px solid ${cfg.border}`,
                      gridTemplateColumns: "auto 1fr auto"
                    }}
                  >
                    {/* Type icon box */}
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                      style={{
                        background: cfg.bg,
                        border: `1px solid ${cfg.border}`,
                        color: cfg.color
                      }}
                    >
                      {cfg.symbol}
                    </div>

                    {/* Entry body */}
                    <div>
                      {/* Who + which conveyor + type */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">

                        <span className="text-[#94a3b8] font-mono text-[9px]">
                          {log.author}
                        </span>

                        {/* Conveyor badge */}
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full border font-mono"
                          style={{
                            color: "#00e5a0",
                            borderColor: "#00e5a033",
                            background: "#071a14"
                          }}
                        >
                          {log.conveyor}
                        </span>

                        {/* Type badge */}
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full border font-mono"
                          style={{
                            color: cfg.color,
                            borderColor: cfg.border,
                            background: cfg.bg
                          }}
                        >
                          {log.type}
                        </span>
                      </div>

                      {/* The actual log text */}
                      <p className="text-[#cbd5e1] font-mono text-[10px] leading-relaxed">
                        {log.text}
                      </p>
                    </div>

                    {/* Timestamp */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[#4a6080] font-mono text-[8px] tracking-wider">
                        {formatTime(log.timestamp)}
                      </p>
                      <p className="text-[#1e2d45] font-mono text-[7px] mt-0.5">
                        {formatDate(log.timestamp)}
                      </p>
                    </div>

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

export default TechLogPage