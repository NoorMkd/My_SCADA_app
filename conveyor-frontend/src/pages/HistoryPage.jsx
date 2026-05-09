// HistoryPage.jsx
// History & AI Predictions page
// Sections:
//   - Header: title + date + refresh button
//   - Efficiency score circle
//   - Plain language explanation
//   - Loss predictions (7 days + 30 days)
//   - Recommended actions
//   - Two mini charts (sensor trends + efficiency curve)

import { useState, useEffect } from "react"
import { useMachine } from "../context/MachineContext"
import { useAuth } from "../context/AuthContext"
import Navbar from "../components/Navbar"
import Sidebar from "../components/Sidebar"

// AI data per conveyor — replace with real backend fetch later
const AI_DATA = {
  1: {
    efficiencyScore: 0,
    efficiencyLabel: "AWAITING DATA",
    efficiencyColor: "var(--color-text-dim)",
    explanation:
      "Awaiting historical data sync from backend. No losses or stops recorded.",
    losses: {
      sevenDays:  { pct: "0.0%", DT: "0 DT" },
      thirtyDays: { pct: "0.0%", DT: "0 DT" },
    },
    recommendations: [],
    sensorTrend: [
      { day: "Mon", temp: 0, current: 0, speed: 0 },
      { day: "Tue", temp: 0, current: 0, speed: 0 },
      { day: "Wed", temp: 0, current: 0, speed: 0 },
      { day: "Thu", temp: 0, current: 0, speed: 0 },
      { day: "Fri", temp: 0, current: 0, speed: 0 },
      { day: "Sat", temp: 0, current: 0, speed: 0 },
      { day: "Sun", temp: 0, current: 0, speed: 0 },
    ],
    efficiencyTrend: [0, 0, 0, 0, 0, 0, 0],
  },
  2: {
    efficiencyScore: 45,
    efficiencyLabel: "LOW EFFICIENCY",
    efficiencyColor: "#cd6413",
    explanation:
      "Efficiency is critically low due to a belt jam that caused 22 minutes of downtime and a full machine stop recorded today.",
    losses: {
      sevenDays:  { pct: "−22.1%", DT: "≈ 3,100 DT" },
      thirtyDays: { pct: "−38.5%", DT: "≈ 12,400 DT" },
    },
    recommendations: [
      {
        num: "①",
        action: "Full belt inspection and replacement",
        impact: "Belt jam risk high · Do immediately",
        save: "−20%",
        color: "#cd6413",
        bg: "var(--color-bg-base)",
        border: "#cd641333",
      },
      {
        num: "②",
        action: "Check detection sensors calibration",
        impact: "False stops may come from bad readings",
        save: "−10%",
        color: "#d5a507",
        bg: "var(--color-bg-base)",
        border: "#d5a50733",
      },
      {
        num: "③",
        action: "Schedule preventive maintenance",
        impact: "Last maintenance was 47 days ago",
        save: "−8%",
        color: "#0098c2",
        bg: "var(--color-bg-base)",
        border: "#0098c233",
      },
    ],
    sensorTrend: [
      { day: "Mon", temp: 30, current: 35, speed: 30 },
      { day: "Tue", temp: 32, current: 36, speed: 28 },
      { day: "Wed", temp: 35, current: 40, speed: 25 },
      { day: "Thu", temp: 40, current: 45, speed: 20 },
      { day: "Fri", temp: 50, current: 50, speed: 10 },
      { day: "Sat", temp: 10, current: 10, speed: 5  },
      { day: "Sun", temp: 12, current: 12, speed: 5  },
    ],
    efficiencyTrend: [80, 78, 72, 65, 50, 42, 45],
  },
  3: {
    efficiencyScore: 91,
    efficiencyLabel: "GOOD EFFICIENCY",
    efficiencyColor: "#0098c2",
    explanation:
      "Conveyor 3 is performing well. Temperature is slightly elevated but within acceptable range. No stops recorded today.",
    losses: {
      sevenDays:  { pct: "−2.1%",  DT: "≈ 320 DT" },
      thirtyDays: { pct: "−5.8%",  DT: "≈ 1,100 DT" },
    },
    recommendations: [
      {
        num: "①",
        action: "Monitor temperature daily",
        impact: "Slight upward trend over 7 days",
        save: "−3%",
        color: "#d5a507",
        bg: "var(--color-bg-base)",
        border: "#d5a50733",
      },
      {
        num: "②",
        action: "Lubricate roller chain",
        impact: "Scheduled maintenance due in 3 days",
        save: "−2%",
        color: "#0098c2",
        bg: "var(--color-bg-base)",
        border: "#0098c233",
      },
      {
        num: "③",
        action: "Keep current speed settings",
        impact: "Optimal throughput achieved at 70%",
        save: "+5%",
        color: "var(--color-primary)",
        bg: "#0a1320",
        border: "var(--color-primary)33",
      },
    ],
    sensorTrend: [
      { day: "Mon", temp: 20, current: 28, speed: 25 },
      { day: "Tue", temp: 22, current: 28, speed: 25 },
      { day: "Wed", temp: 23, current: 30, speed: 25 },
      { day: "Thu", temp: 24, current: 30, speed: 25 },
      { day: "Fri", temp: 25, current: 32, speed: 27 },
      { day: "Sat", temp: 26, current: 32, speed: 27 },
      { day: "Sun", temp: 28, current: 34, speed: 27 },
    ],
    efficiencyTrend: [90, 92, 93, 91, 92, 91, 91],
  },
}

// Convert a data array into SVG polyline points string
// valKey = which field to use, chartH = chart height, maxVal = scale max
function toPoints(data, valKey, chartH, maxVal, xStart, xStep) {
  return data
    .map((d, i) => {
      const x = xStart + i * xStep
      // y: top of chart = low value, bottom = 0
      const y = chartH - (d[valKey] / maxVal) * chartH
      return `${x},${y}`
    })
    .join(" ")
}

function HistoryPage() {
  const { conveyors } = useMachine()

  // Which conveyor is selected
  const [selectedId, setSelectedId] = useState(1)

  // Event history state
  const [eventLogs, setEventLogs] = useState([])

  const fetchEventLogs = async () => {
    try {
      const token = localStorage.getItem("access_token")
      
      // Fetch tech logs
      const techRes = await fetch(`/api/techlogs?conveyor_id=${selectedId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      const techData = techRes.ok ? await techRes.json() : []

      // Fetch alerts (so we can mix critical ones into history)
      const alertRes = await fetch(`/api/alerts`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      const alertData = alertRes.ok ? await alertRes.json() : []

      // Format tech data
      const formattedLogs = techData.map(log => ({
        id: `tech-${log.id}`,
        timestamp: log.timestamp,
        type: log.intervention_type || "LOG",
        text: log.description,
        author: log.author
      }))

      // Format critical alerts and add to the list
      const criticalAlerts = alertData
        .filter(a => a.level === "critical" && a.conveyor_id === selectedId)
        .map(a => ({
          id: `alert-${a.id}`,
          timestamp: a.timestamp,
          type: "CRITICAL ALERT",
          text: a.message,
          author: "System (Auto)"
        }))

      // Combine both, and sort by newest first
      const combined = [...formattedLogs, ...criticalAlerts].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      )

      setEventLogs(combined)
    } catch (e) {
      console.error("Failed to fetch event logs:", e)
    }
  }

  useEffect(() => {
    fetchEventLogs()
  }, [selectedId])

  // Refresh animation state
  const [spinning, setSpinning] = useState(false)

  const data = AI_DATA[selectedId]
  const cv   = conveyors.find(c => c.id === selectedId)

  // Today formatted
  const today = new Date().toLocaleDateString("en-GB", {
    year: "numeric", month: "2-digit", day: "2-digit",
  })

  // Trigger refresh spin
  function handleRefresh() {
    setSpinning(true)
    fetchEventLogs()
    setTimeout(() => setSpinning(false), 700)
  }

  // Circle gauge math for efficiency score
  const radius       = 34
  const circumference = 2 * Math.PI * radius   // full circle
  const offset       = circumference - (data.efficiencyScore / 100) * circumference

  // Sensor chart points
  const xStart = 50, xStep = 40, chartH = 48
  const tempPoints    = toPoints(data.sensorTrend, "temp",    chartH, 55, xStart, xStep)
  const currentPoints = toPoints(data.sensorTrend, "current", chartH, 55, xStart, xStep)
  const speedPoints   = toPoints(data.sensorTrend, "speed",   chartH, 55, xStart, xStep)

  // Efficiency trend chart points
  const effPoints = data.efficiencyTrend
    .map((v, i) => {
      const x = xStart + i * xStep
      const y = 44 - (v / 100) * 38   // scale 0-100 into chart height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      <Navbar />

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex-1 p-2 md:p-4 flex flex-col gap-4 overflow-auto">

          {/* ── HEADER ── */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl px-5 py-4 flex flex-col md:flex-row items-center justify-between gap-4 flex-shrink-0">
            <div className="w-full md:w-auto text-center md:text-left">
              <p className="text-[var(--color-primary)] font-mono text-[12px] tracking-[3px] font-bold">
                ◈ HISTORY & AI PREDICTIONS
              </p>
              <p className="text-[var(--color-text-dim)] font-mono text-[9px] tracking-widest mt-1">
                CONVEYOR SYSTEM · TODAY: {today}
              </p>
            </div>

            {/* Conveyor selector tabs */}
            <div className="flex gap-2 flex-wrap justify-center">
              {conveyors.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="font-mono text-[9px] px-4 py-2 rounded-full border transition-all duration-200"
                  style={{
                    borderColor: selectedId === c.id ? "var(--color-primary)55" : "var(--color-border-card)",
                    color:       selectedId === c.id ? "var(--color-primary)"   : "var(--color-text-dim)",
                    background:  selectedId === c.id ? "#0a1320"   : "transparent",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              className="bg-[#0a1320] border border-[var(--color-primary)55] rounded-xl text-[var(--color-primary)] font-mono text-[10px] tracking-widest px-5 py-2.5 cursor-pointer hover:bg-[var(--color-primary)22] transition-colors duration-200 flex items-center gap-2"
            >
              <span
                className="text-sm inline-block"
                style={{
                  transition: "transform 0.6s",
                  transform: spinning ? "rotate(360deg)" : "rotate(0deg)",
                }}
              >
                ↻
              </span>
              REFRESH DATA
            </button>
          </div>

          {/* ── MAIN CONTENT: left + right ── */}
          <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">

            {/* ── LEFT: Event History (No Filters) ── */}
            <div className="flex-1 lg:flex-[1.8] bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl flex flex-col overflow-hidden">
              <div className="p-5 border-b border-[var(--color-border-card)]">
                <p className="text-[#94a3b8] font-mono text-[12px] tracking-[3px]">
                  ◈ EVENT HISTORY
                </p>
              </div>

              {/* Table Header */}
              <div className="hidden md:grid grid-cols-5 gap-4 px-5 py-3 border-b border-[var(--color-border-card)] bg-[var(--color-bg-base)]">
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">DATE / TIME</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">TYPE</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">DESCRIPTION</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">SENSORS</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">VALUES</div>
              </div>

              {/* Table Body */}
              <div className="flex-1 overflow-auto p-2 md:p-5 space-y-4">
                {eventLogs.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-[var(--color-text-dim)] font-mono text-[10px] tracking-widest">
                      NO EVENT RECORDS FOUND IN DATABASE
                    </p>
                  </div>
                ) : (
                  eventLogs.map((log) => {
                    const dateObj = new Date(log.timestamp)
                    const dateStr = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                    const timeStr = dateObj.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    
                    return (
                      <div key={log.id} className="flex flex-col md:grid md:grid-cols-5 gap-2 md:gap-4 md:items-center border-b border-[var(--color-border-card)] pb-4">
                        <div className="text-[12px] font-mono flex justify-between md:block">
                          <span className="md:hidden text-[#94a3b8] tracking-widest text-[10px]">TIME:</span>
                          <div>
                            <p className="text-[#94a3b8]">{dateStr}</p>
                            <p className="text-[var(--color-text-dim)] mt-1">{timeStr}</p>
                          </div>
                        </div>
                        <div className={`font-mono text-[11px] ${log.type === "CRITICAL ALERT" ? "text-[var(--color-danger)]" : "text-[#cbd5e1]"}`}>{log.type}</div>
                        <div className="text-[#94a3b8] text-[12px] pr-4">{log.text}</div>
                        <div className="text-[var(--color-text-dim)] font-mono text-[11px]">—</div>
                        <div className="text-[var(--color-text-dim)] font-mono text-[11px]">Logged by {log.author}</div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* ── RIGHT: AI Panel & Charts ── */}
            <div className="flex-1 lg:flex-[1.2] flex flex-col gap-4 overflow-auto pb-4 pr-1">

              {/* AI Header */}
              <div className="bg-[var(--color-bg-card)] max-w-full panel-border border-[var(--color-border-card)] p-4 flex-shrink-0 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-none bg-[var(--color-primary)] animate-pulse"></div>
                  <p className="text-[10px] tracking-[3px] text-white font-mono font-bold uppercase">
                    AI Intelligence Module
                  </p>
                </div>
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-none bg-[var(--color-text-dim)]"></div>
                  <div className="w-2 h-2 rounded-none bg-[var(--color-text-dim)]"></div>
                  <div className="w-2 h-2 rounded-none bg-[var(--color-primary)]"></div>
                </div>
              </div>

              {/* 1. Anomaly Score */}
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] p-5 flex flex-col gap-2">
                <div>
                  <p className="text-[10px] tracking-[2px] text-[var(--color-primary)] font-mono mb-1 font-semibold uppercase">
                    Anomaly Score
                  </p>
                  <p className="text-2xl font-mono text-[#e2e8f0] font-bold">
                    {data.anomalyScore?.score !== undefined ? `${data.anomalyScore.score} / 100` : "12 / 100"}
                  </p>
                </div>
                <p className="text-[10px] text-[#94a3b8] font-mono tracking-widest mt-2 uppercase">
                  Multi-sensor abnormality detection score.
                </p>
              </div>

              {/* 2. RUL — Remaining Useful Life */}
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] p-5 flex flex-col gap-2">
                <div>
                  <p className="text-[10px] tracking-[2px] text-[var(--color-primary)] font-mono mb-1 font-semibold uppercase">
                    Remaining Useful Life
                  </p>
                  <p className="text-2xl font-mono text-[#e2e8f0] font-bold">
                    {data.rul?.days !== undefined ? `~ ${data.rul.days} DAYS` : "~ 18 DAYS"}
                  </p>
                </div>
                <p className="text-[10px] text-[#94a3b8] font-mono tracking-widest mt-2 uppercase">
                  Estimated time before motor reaches critical threshold.
                </p>
              </div>

              {/* 3. Alert Forecast */}
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] p-5 flex flex-col gap-2">
                <div>
                  <p className="text-[10px] tracking-[2px] text-[var(--color-primary)] font-mono mb-1 font-semibold uppercase">
                    Alert Forecast (24H)
                  </p>
                  <p className="text-2xl font-mono text-[#e2e8f0] font-bold">
                    {data.alertForecast?.count !== undefined ? `${data.alertForecast.count} ALERTS` : "3 ALERTS"}
                  </p>
                </div>
                <p className="text-[10px] text-[#94a3b8] font-mono tracking-widest mt-2 uppercase">
                  Predicted occurrences based on recent sensor trends.
                </p>
              </div>

              {/* 4. Production Efficiency */}
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] p-5 flex flex-col gap-2">
                <div>
                  <p className="text-[10px] tracking-[2px] text-[var(--color-primary)] font-mono mb-1 font-semibold uppercase">
                    Production Efficiency
                  </p>
                  <p className="text-2xl font-mono text-[#e2e8f0] font-bold">
                    {data.productionScore?.score !== undefined ? `${data.productionScore.score}%` : "84%"}
                  </p>
                </div>
                <p className="text-[10px] text-[#94a3b8] font-mono tracking-widest mt-2 uppercase">
                  Current throughput scaled against theoretical maximum capacity.
                </p>
              </div>

              {/* 5. Maintenance Due Score */}
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] p-5 flex flex-col gap-2">
                <div>
                  <p className="text-[10px] tracking-[2px] text-[var(--color-primary)] font-mono mb-1 font-semibold uppercase">
                    Maintenance Due Score
                  </p>
                  <p className="text-2xl font-mono text-[#e2e8f0] font-bold">
                    {data.maintenanceScore?.days !== undefined ? `${data.maintenanceScore.days} DAYS` : "47 DAYS"}
                  </p>
                </div>
                <p className="text-[10px] text-[#94a3b8] font-mono tracking-widest mt-2 uppercase">
                  Days elapsed since the last scheduled preventive logs.
                </p>
              </div>

              {/* Sensor trends chart (Moved to Right Panel) */}
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 flex flex-col flex-shrink-0">
                <p className="text-[8px] tracking-[3px] text-[var(--color-text-dim)] mb-4">
                  SENSOR TRENDS — LAST 7 DAYS
                </p>
                <svg viewBox="0 0 330 80" className="w-full">
                  {/* Grid */}
                  <line x1="30" y1="5"  x2="30"  y2="55" stroke="var(--color-border-card)" strokeWidth="0.5"/>
                  <line x1="30" y1="55" x2="315" y2="55" stroke="var(--color-border-card)" strokeWidth="0.5"/>
                  <line x1="30" y1="20" x2="315" y2="20" stroke="#0d1828" strokeWidth="0.5"/>
                  <line x1="30" y1="35" x2="315" y2="35" stroke="#0d1828" strokeWidth="0.5"/>
                  {/* Y labels */}
                  <text x="24" y="9"  textAnchor="end" fill="var(--color-text-dim)" fontSize="6" fontFamily="monospace">HIGH</text>
                  <text x="24" y="39" textAnchor="end" fill="var(--color-text-dim)" fontSize="6" fontFamily="monospace">MID</text>
                  {/* Day labels */}
                  {data.sensorTrend.map((d, i) => (
                    <text key={i} x={xStart + i * xStep} y="66"
                      textAnchor="middle" fill="var(--color-text-dim)" fontSize="6" fontFamily="monospace">
                      {d.day}
                    </text>
                  ))}
                  {/* Limit reference line */}
                  <line x1="30" y1="12" x2="315" y2="12"
                    stroke="#cd641355" strokeWidth="1" strokeDasharray="3,3"/>
                  <text x="317" y="14" fill="#cd6413" fontSize="5" fontFamily="monospace">LIM</text>
                  {/* Temperature line */}
                  <polyline points={tempPoints}
                    fill="none" stroke="#cd6413" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Current line */}
                  <polyline points={currentPoints}
                    fill="none" stroke="var(--color-primary)" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Speed line dashed */}
                  <polyline points={speedPoints}
                    fill="none" stroke="#0098c2" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray="5,3"/>
                </svg>
                {/* Legend */}
                <div className="flex gap-5 mt-2 justify-center">
                  {[
                    ["#cd6413", "TEMP"],
                    ["var(--color-primary)", "CURRENT"],
                    ["#0098c2", "SPEED"],
                  ].map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 rounded" style={{ background: color }}/>
                      <span className="text-[7.5px] text-[var(--color-text-dim)]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Efficiency trend chart (Moved to Right Panel) */}
              <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 flex flex-col flex-shrink-0">
                <p className="text-[8px] tracking-[3px] text-[var(--color-text-dim)] mb-4">
                  EFFICIENCY SCORE — LAST 7 DAYS
                </p>
                <svg viewBox="0 0 330 70" className="w-full">
                  {/* Grid */}
                  <line x1="30" y1="5"  x2="30"  y2="48" stroke="var(--color-border-card)" strokeWidth="0.5"/>
                  <line x1="30" y1="48" x2="315" y2="48" stroke="var(--color-border-card)" strokeWidth="0.5"/>
                  <line x1="30" y1="20" x2="315" y2="20" stroke="#0d1828" strokeWidth="0.5"/>
                  <line x1="30" y1="34" x2="315" y2="34" stroke="#0d1828" strokeWidth="0.5"/>
                  <text x="24" y="9"  textAnchor="end" fill="var(--color-text-dim)" fontSize="6" fontFamily="monospace">100</text>
                  <text x="24" y="24" textAnchor="end" fill="var(--color-text-dim)" fontSize="6" fontFamily="monospace">75</text>
                  <text x="24" y="38" textAnchor="end" fill="var(--color-text-dim)" fontSize="6" fontFamily="monospace">50</text>
                  {/* Filled area */}
                  <polygon
                    points={`${effPoints} 290,48 50,48`}
                    fill="var(--color-primary)" opacity="0.07"
                  />
                  {/* Efficiency line */}
                  <polyline points={effPoints}
                    fill="none" stroke="var(--color-primary)" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Data dots + value labels */}
                  {data.efficiencyTrend.map((v, i) => {
                    const x = xStart + i * xStep
                    const y = 44 - (v / 100) * 38
                    const dotColor = v >= 85 ? "#0098c2" : v >= 70 ? "#d5a507" : "#cd6413"
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="3" fill={dotColor}/>
                        <text x={x} y={y - 6} textAnchor="middle"
                          fill={dotColor} fontSize="6" fontFamily="monospace">
                          {v}
                        </text>
                        <text x={x} y="60" textAnchor="middle"
                          fill="var(--color-text-dim)" fontSize="6" fontFamily="monospace">
                          {data.sensorTrend[i]?.day}
                        </text>
                      </g>
                    )
                  })}
                </svg>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HistoryPage