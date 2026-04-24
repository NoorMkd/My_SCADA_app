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
    efficiencyColor: "#4a6080",
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
    efficiencyColor: "#f87171",
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
        color: "#f87171",
        bg: "#1c0f0f",
        border: "#f8717133",
      },
      {
        num: "②",
        action: "Check detection sensors calibration",
        impact: "False stops may come from bad readings",
        save: "−10%",
        color: "#fbbf24",
        bg: "#18140a",
        border: "#fbbf2433",
      },
      {
        num: "③",
        action: "Schedule preventive maintenance",
        impact: "Last maintenance was 47 days ago",
        save: "−8%",
        color: "#00e5a0",
        bg: "#071a14",
        border: "#00e5a033",
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
    efficiencyColor: "#00e5a0",
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
        color: "#fbbf24",
        bg: "#18140a",
        border: "#fbbf2433",
      },
      {
        num: "②",
        action: "Lubricate roller chain",
        impact: "Scheduled maintenance due in 3 days",
        save: "−2%",
        color: "#00e5a0",
        bg: "#071a14",
        border: "#00e5a033",
      },
      {
        num: "③",
        action: "Keep current speed settings",
        impact: "Optimal throughput achieved at 70%",
        save: "+5%",
        color: "#60a5fa",
        bg: "#0a1320",
        border: "#60a5fa33",
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
      const res = await fetch(`http://localhost:8000/api/techlogs?conveyor_id=${selectedId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        setEventLogs(data)
      }
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
    <div className="min-h-screen bg-[#060b14] flex flex-col">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto">

          {/* ── HEADER ── */}
          <div className="bg-[#0a1020] border border-[#162035] rounded-2xl px-5 py-4 flex items-center justify-between flex-shrink-0">
            <div>
              <p className="text-[#60a5fa] font-mono text-[12px] tracking-[3px] font-bold">
                ◈ HISTORY & AI PREDICTIONS
              </p>
              <p className="text-[#2a3a50] font-mono text-[9px] tracking-widest mt-1">
                CONVEYOR SYSTEM · TODAY: {today}
              </p>
            </div>

            {/* Conveyor selector tabs */}
            <div className="flex gap-2">
              {conveyors.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="font-mono text-[9px] px-4 py-2 rounded-full border transition-all duration-200"
                  style={{
                    borderColor: selectedId === c.id ? "#60a5fa55" : "#162035",
                    color:       selectedId === c.id ? "#60a5fa"   : "#4a6080",
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
              className="bg-[#0a1320] border border-[#60a5fa55] rounded-xl text-[#60a5fa] font-mono text-[10px] tracking-widest px-5 py-2.5 cursor-pointer hover:bg-[#60a5fa22] transition-colors duration-200 flex items-center gap-2"
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
          <div className="grid gap-4 flex-1 min-h-0" style={{ gridTemplateColumns: "1.8fr 1.2fr" }}>

            {/* ── LEFT: Event History (No Filters) ── */}
            <div className="bg-[#0a1020] border border-[#162035] rounded-2xl flex flex-col overflow-hidden">
              <div className="p-5 border-b border-[#162035]">
                <p className="text-[#94a3b8] font-mono text-[12px] tracking-[3px]">
                  ◈ EVENT HISTORY
                </p>
              </div>

              {/* Table Header */}
              <div className="grid grid-cols-5 gap-4 px-5 py-3 border-b border-[#162035] bg-[#060b14]">
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">DATE / TIME</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">TYPE</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">DESCRIPTION</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">SENSORS</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">VALUES</div>
              </div>

              {/* Table Body */}
              <div className="flex-1 overflow-auto p-5 space-y-4">
                {eventLogs.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-[#4a6080] font-mono text-[10px] tracking-widest">
                      NO EVENT RECORDS FOUND IN DATABASE
                    </p>
                  </div>
                ) : (
                  eventLogs.map((log) => {
                    const dateObj = new Date(log.timestamp)
                    const dateStr = dateObj.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                    const timeStr = dateObj.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                    
                    return (
                      <div key={log.id} className="grid grid-cols-5 gap-4 items-center border-b border-[#162035] pb-4">
                        <div className="text-[12px] font-mono">
                          <p className="text-[#94a3b8]">{dateStr}</p>
                          <p className="text-[#4a6080] mt-1">{timeStr}</p>
                        </div>
                        <div className="text-[#cbd5e1] font-mono text-[11px]">{log.type}</div>
                        <div className="text-[#94a3b8] text-[12px] pr-4">{log.text}</div>
                        <div className="text-[#4a6080] font-mono text-[11px]">—</div>
                        <div className="text-[#4a6080] font-mono text-[11px]">Logged by {log.author}</div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            {/* ── RIGHT: AI Panel & Charts ── */}
            <div className="flex flex-col gap-4 overflow-auto pb-4 pr-1">

              {/* AI Header */}
              <div className="bg-[#0a1020] border border-[#162035] rounded-xl p-4 flex-shrink-0 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#60a5fa] animate-pulse"></div>
                  <p className="text-[10px] tracking-[3px] text-[#e2e8f0] font-mono font-bold">
                    AI INTELLIGENCE MODULE
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#f87171]"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#3b82f6]"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></div>
                </div>
              </div>

              {/* 1. Motor Remaining Useful Life (MRUL) */}
              <div className="bg-[#1c0f0f] border border-[#f8717133] rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden transition-all hover:bg-[#251313]">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#f87171]"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] tracking-[2px] text-[#f87171] font-mono mb-1 font-semibold">
                      REMAINING USEFUL LIFE
                    </p>
                    <p className="text-3xl font-mono text-[#e2e8f0] font-bold">
                      {data.rul?.days !== undefined ? `~ ${data.rul.days} Days` : "1 day"}
                    </p>
                  </div>
                  <div className="bg-[#f871711a] px-2.5 py-1.5 rounded-lg text-lg">
                    🔴
                  </div>
                </div>
                <div className="bg-[#0b0606] border border-[#f8717122] rounded-lg p-3 mt-1 shadow-inner">
                  <p className="text-[11px] text-[#fcb6b6] leading-relaxed">
                    {data.rul?.explanation || "Awaiting AI analysis based on current draw trends..."}
                  </p>
                </div>
              </div>

              {/* 2. Failure Probability */}
              <div className="bg-[#18140a] border border-[#fbbf2433] rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden transition-all hover:bg-[#1f1a0d]">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#fbbf24]"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] tracking-[2px] text-[#fbbf24] font-mono mb-1 font-semibold">
                      FAILURE PROBABILITY (24H)
                    </p>
                    <p className="text-3xl font-mono text-[#e2e8f0] font-bold">
                      {data.failureProb?.prob !== undefined ? `${data.failureProb.prob}%` : "--%"}
                    </p>
                  </div>
                  <div className="bg-[#fbbf241a] px-2.5 py-1.5 rounded-lg text-lg">
                    🟠
                  </div>
                </div>
                <div className="bg-[#0b0905] border border-[#fbbf2422] rounded-lg p-3 mt-1 shadow-inner">
                  <p className="text-[11px] text-[#fde68a] leading-relaxed">
                    {data.failureProb?.explanation || "Awaiting AI analysis based on sensor trends, alerts, and tech logs..."}
                  </p>
                </div>
              </div>

              {/* 3. Production Efficiency */}
              <div className="bg-[#0a1320] border border-[#60a5fa33] rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden transition-all hover:bg-[#0c1829]">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#60a5fa]"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] tracking-[2px] text-[#60a5fa] font-mono mb-1 font-semibold">
                      PRODUCTION EFFICIENCY
                    </p>
                    <p className="text-3xl font-mono text-[#e2e8f0] font-bold">
                      {data.productionScore?.score !== undefined ? `${data.productionScore.score}%` : "--%"}
                    </p>
                  </div>
                  <div className="bg-[#60a5fa1a] px-2.5 py-1.5 rounded-lg text-lg">
                    🔵
                  </div>
                </div>
                <div className="bg-[#060b14] border border-[#60a5fa22] rounded-lg p-3 mt-1 shadow-inner">
                  <p className="text-[11px] text-[#bfdbfe] leading-relaxed">
                    {data.productionScore?.explanation || "Awaiting daily capacity calculation..."}
                  </p>
                </div>
              </div>

              {/* 4. Maintenance Due Score */}
              <div className="bg-[#071a14] border border-[#00e5a033] rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden transition-all hover:bg-[#09231b]">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#00e5a0]"></div>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] tracking-[2px] text-[#00e5a0] font-mono mb-1 font-semibold">
                      MAINTENANCE DUE SCORE
                    </p>
                    <p className="text-3xl font-mono text-[#e2e8f0] font-bold">
                      {data.maintenanceScore?.days !== undefined ? `In ${data.maintenanceScore.days} Days` : "--"}
                    </p>
                  </div>
                  <div className="bg-[#00e5a01a] px-2.5 py-1.5 rounded-lg text-lg">
                    🟢
                  </div>
                </div>
                <div className="bg-[#040e0b] border border-[#00e5a022] rounded-lg p-3 mt-1 shadow-inner">
                  <p className="text-[11px] text-[#a7f3d0] leading-relaxed">
                    {data.maintenanceScore?.explanation || "Awaiting maintenance prediction based on timestamps and sensor baselines..."}
                  </p>
                </div>
              </div>

              {/* Sensor trends chart (Moved to Right Panel) */}
              <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-5 flex flex-col flex-shrink-0">
                <p className="text-[8px] tracking-[3px] text-[#4a6080] mb-4">
                  SENSOR TRENDS — LAST 7 DAYS
                </p>
                <svg viewBox="0 0 330 80" className="w-full">
                  {/* Grid */}
                  <line x1="30" y1="5"  x2="30"  y2="55" stroke="#162035" strokeWidth="0.5"/>
                  <line x1="30" y1="55" x2="315" y2="55" stroke="#162035" strokeWidth="0.5"/>
                  <line x1="30" y1="20" x2="315" y2="20" stroke="#0d1828" strokeWidth="0.5"/>
                  <line x1="30" y1="35" x2="315" y2="35" stroke="#0d1828" strokeWidth="0.5"/>
                  {/* Y labels */}
                  <text x="24" y="9"  textAnchor="end" fill="#2a3a50" fontSize="6" fontFamily="monospace">HIGH</text>
                  <text x="24" y="39" textAnchor="end" fill="#2a3a50" fontSize="6" fontFamily="monospace">MID</text>
                  {/* Day labels */}
                  {data.sensorTrend.map((d, i) => (
                    <text key={i} x={xStart + i * xStep} y="66"
                      textAnchor="middle" fill="#2a3a50" fontSize="6" fontFamily="monospace">
                      {d.day}
                    </text>
                  ))}
                  {/* Limit reference line */}
                  <line x1="30" y1="12" x2="315" y2="12"
                    stroke="#f8717155" strokeWidth="1" strokeDasharray="3,3"/>
                  <text x="317" y="14" fill="#f87171" fontSize="5" fontFamily="monospace">LIM</text>
                  {/* Temperature line */}
                  <polyline points={tempPoints}
                    fill="none" stroke="#f87171" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Current line */}
                  <polyline points={currentPoints}
                    fill="none" stroke="#60a5fa" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Speed line dashed */}
                  <polyline points={speedPoints}
                    fill="none" stroke="#00e5a0" strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round"
                    strokeDasharray="5,3"/>
                </svg>
                {/* Legend */}
                <div className="flex gap-5 mt-2 justify-center">
                  {[
                    ["#f87171", "TEMP"],
                    ["#60a5fa", "CURRENT"],
                    ["#00e5a0", "SPEED"],
                  ].map(([color, label]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-4 h-0.5 rounded" style={{ background: color }}/>
                      <span className="text-[7.5px] text-[#4a6080]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Efficiency trend chart (Moved to Right Panel) */}
              <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-5 flex flex-col flex-shrink-0">
                <p className="text-[8px] tracking-[3px] text-[#4a6080] mb-4">
                  EFFICIENCY SCORE — LAST 7 DAYS
                </p>
                <svg viewBox="0 0 330 70" className="w-full">
                  {/* Grid */}
                  <line x1="30" y1="5"  x2="30"  y2="48" stroke="#162035" strokeWidth="0.5"/>
                  <line x1="30" y1="48" x2="315" y2="48" stroke="#162035" strokeWidth="0.5"/>
                  <line x1="30" y1="20" x2="315" y2="20" stroke="#0d1828" strokeWidth="0.5"/>
                  <line x1="30" y1="34" x2="315" y2="34" stroke="#0d1828" strokeWidth="0.5"/>
                  <text x="24" y="9"  textAnchor="end" fill="#2a3a50" fontSize="6" fontFamily="monospace">100</text>
                  <text x="24" y="24" textAnchor="end" fill="#2a3a50" fontSize="6" fontFamily="monospace">75</text>
                  <text x="24" y="38" textAnchor="end" fill="#2a3a50" fontSize="6" fontFamily="monospace">50</text>
                  {/* Filled area */}
                  <polygon
                    points={`${effPoints} 290,48 50,48`}
                    fill="#60a5fa" opacity="0.07"
                  />
                  {/* Efficiency line */}
                  <polyline points={effPoints}
                    fill="none" stroke="#60a5fa" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round"/>
                  {/* Data dots + value labels */}
                  {data.efficiencyTrend.map((v, i) => {
                    const x = xStart + i * xStep
                    const y = 44 - (v / 100) * 38
                    const dotColor = v >= 85 ? "#00e5a0" : v >= 70 ? "#fbbf24" : "#f87171"
                    return (
                      <g key={i}>
                        <circle cx={x} cy={y} r="3" fill={dotColor}/>
                        <text x={x} y={y - 6} textAnchor="middle"
                          fill={dotColor} fontSize="6" fontFamily="monospace">
                          {v}
                        </text>
                        <text x={x} y="60" textAnchor="middle"
                          fill="#2a3a50" fontSize="6" fontFamily="monospace">
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