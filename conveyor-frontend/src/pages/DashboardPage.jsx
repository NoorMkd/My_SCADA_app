// DashboardPage.jsx
// The main page — assembles all components together
// Layout:
//   TOP    → 3 gauges (Temp, Current, Speed) + Items Counter
//   MIDDLE → Health Score circle + Location Card
//   BOTTOM → Machine Controls + Alerts
//   RIGHT  → Production Panel (all conveyors list)

import { useEffect } from "react"
import { useMachine } from "../context/MachineContext"
import { useAuth } from "../context/AuthContext"
import Navbar from "../components/Navbar"
import GaugeCard from "../components/GaugeCard"
import HealthScore from "../components/HealthScore"
import ItemsCounter from "../components/ItemsCounter"
import LocationCard from "../components/LocationCard"
import ProductionPanel from "../components/ProductionPanel"
import Sidebar from "../components/Sidebar"

function DashboardPage() {
  const {
    conveyors,
    selectedId,
    getConveyor,
    getAlerts,
    getHealthScore,
    formatRuntime,
    startConveyor,
    stopConveyor,
    increaseSpeed,
    decreaseSpeed,
  } = useMachine()

  const { user } = useAuth()

  // Get the currently selected conveyor object
  const cv = getConveyor(selectedId)

  // Who can press the control buttons?
  const canControl = ["admin", "supervisor", "operator"].includes(user?.role)

  // Get alerts and health for the selected conveyor
  const alerts      = cv ? getAlerts(cv)       : []
  const healthScore = cv ? getHealthScore(cv)  : 0
  const runtime     = cv ? formatRuntime(cv.runtimeSeconds) : "00:00:00"

  // Is the machine offline?
  const offline = cv ? !cv.isRunning : true

  // Alert color helper
  function alertStyle(level) {
    if (level === "critical") return {
      bg: "#1c0f0f", border: "#f8717144", text: "#f87171", icon: "⚠"
    }
    if (level === "warning") return {
      bg: "#18140a", border: "#fbbf2444", text: "#fde68a", icon: "⚠"
    }
    return {
      bg: "#071a14", border: "#00e5a033", text: "#00e5a0", icon: "✓"
    }
  }

  // If no conveyor found yet, show nothing
  if (!cv) return null

  return (
    // Full screen dark background — flex column so navbar + content stack
    <div className="min-h-screen bg-[#060b14] flex flex-col">

      {/* ── NAVBAR ── */}
      <Navbar />
       
      {/* ── MAIN BODY: left content + right panel ── */}
      <div className="flex flex-1 overflow-hidden">

          <Sidebar />
        {/* ── LEFT/CENTER: everything except the sidebar ── */}
        <div className="flex-1 flex flex-col p-3 gap-3 overflow-auto">

          {/* ══ ROW 1: 3 Gauges + Items Counter ══ */}
          <div className="grid grid-cols-4 gap-3 flex-shrink-0">

            {/* Temperature gauge */}
            <GaugeCard
              label="TEMPERATURE"
              value={cv.sensors.temperature}
              max={90}
              unit="°C"
              warnAt={0.72}   // warn at 65°C
              critAt={0.84}   // critical at 75°C
              offline={offline}
            />

            {/* Current gauge */}
            <GaugeCard
              label="CURRENT"
              value={cv.sensors.current}
              max={20}
              unit="A"
              warnAt={0.70}   // warn at 14A
              critAt={0.90}   // critical at 18A
              offline={offline}
            />

            {/* Speed gauge */}
            <GaugeCard
              label="SPEED"
              value={cv.speed}
              max={100}
              unit="%"
              warnAt={0.90}
              critAt={0.97}
              offline={false}  // speed gauge always shows even when stopped
            />

            {/* Items counter — takes same space as a gauge */}
            <ItemsCounter
              items={cv.itemsToday}
              target={cv.dailyTarget}
              offline={offline}
            />
          </div>

          {/* ══ LOWER AREA: keep Location on right-top, move Health/Controls/Alerts on left side ══ */}
          <div className="grid grid-cols-3 lg:grid-cols-[1fr_1.15fr_1fr] gap-3 flex-shrink-0 items-stretch">

            {/* ── MACHINE HEALTH (left-top) ── */}
            <HealthScore score={healthScore} />

            {/* ── MIDDLE COLUMN: CONTROLS + ALERTS ── */}
            <div className="flex flex-col gap-3 h-full">
              {/* ── MACHINE CONTROLS (middle-top) ── */}
              <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-5 flex-[1] flex flex-col justify-center">
                <p className="text-[10px] tracking-widest text-[#4a6080] mb-3">
                  MACHINE CONTROL —{" "}
                  <span className="text-[#94a3b8]">{cv.name.toUpperCase()}</span>
                </p>

                <div className="grid grid-cols-4 gap-2">

                  {/* STOP button */}
                  <button
                    onClick={() => canControl && stopConveyor(cv.id)}
                    disabled={!canControl || !cv.isRunning}
                    className={`font-mono text-[15px] tracking-wider py-3 px-2 rounded-xl border transition-all duration-150 active:scale-95
                      ${!canControl || !cv.isRunning
                        ? "text-[#2a3a50] border-[#162035] cursor-not-allowed"
                        : "text-[#f87171] border-[#f8717155] bg-[#180f0f] hover:bg-[#f8717122] cursor-pointer"
                      }`}
                  >
                    ■ STOP
                  </button>

                  {/* START button */}
                  <button
                    onClick={() => canControl && startConveyor(cv.id)}
                    disabled={!canControl || cv.isRunning}
                    className={`font-mono text-[15px] tracking-wider py-3 px-2 rounded-xl border transition-all duration-150 active:scale-95
                      ${!canControl || cv.isRunning
                        ? "text-[#2a3a50] border-[#162035] cursor-not-allowed"
                        : "text-[#00e5a0] border-[#00e5a055] bg-[#071a14] hover:bg-[#00e5a022] cursor-pointer"
                      }`}
                  >
                    ▶ START
                  </button>

                  {/* SPEED UP button */}
                  <button
                    onClick={() => canControl && increaseSpeed(cv.id)}
                    disabled={!canControl || !cv.isRunning}
                    className={`font-mono text-[15px] tracking-wider py-3 px-2 rounded-xl border transition-all duration-150 active:scale-95
                      ${!canControl || !cv.isRunning
                        ? "text-[#2a3a50] border-[#162035] cursor-not-allowed"
                        : "text-[#60a5fa] border-[#60a5fa44] bg-[#0a1320] hover:bg-[#60a5fa22] cursor-pointer"
                      }`}
                  >
                    ▲ SPD +
                  </button>

                  {/* SPEED DOWN button */}
                  <button
                    onClick={() => canControl && decreaseSpeed(cv.id)}
                    disabled={!canControl || !cv.isRunning}
                    className={`font-mono text-[15px] tracking-wider py-3 px-2 rounded-xl border transition-all duration-150 active:scale-95
                      ${!canControl || !cv.isRunning
                        ? "text-[#2a3a50] border-[#162035] cursor-not-allowed"
                        : "text-[#60a5fa] border-[#60a5fa44] bg-[#0a1320] hover:bg-[#60a5fa22] cursor-pointer"
                      }`}
                  >
                    ▼ SPD −
                  </button>
                </div>

                {/* Role notice for technician */}
                {!canControl && (
                  <p className="text-[15px] text-[#4a6080] mt-2 tracking-wider">
                    ⊘ Technician role — view only
                  </p>
                )}
              </div>

              {/* ── ALERTS (exactly under machine controls) ── */}
              <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-4 flex-[2] min-h-[160px]">
                <p className="text-[15px] tracking-widest text-[#4a6080] mb-3">
                  ALERTS —{" "}
                  <span className="text-[#94a3b8]">{cv.name.toUpperCase()}</span>
                </p>

                <div className="flex flex-wrap gap-2">
                  {/* No alerts → show all clear */}
                  {alerts.length === 0 ? (
                    <span
                      className="font-mono text-[15px] px-3 py-1.5 rounded-lg border"
                      style={{
                        color: "#00e5a0",
                        borderColor: "#00e5a033",
                        background: "#071a14"
                      }}
                    >
                      ✓ ALL SYSTEMS NORMAL
                    </span>
                  ) : (
                    // Show each alert as a pill
                    alerts.map((alert, i) => {
                      const s = alertStyle(alert.level)
                      return (
                        <span
                          key={i}
                          className="font-mono text-[10px] px-3 py-1.5 rounded-lg border"
                          style={{
                            color: s.text,
                            borderColor: s.border,
                            background: s.bg
                          }}
                        >
                          {s.icon} {alert.msg}
                        </span>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* ── LOCATION (right-top, unchanged position) ── */}
            <LocationCard conveyor={cv} runtime={runtime} />

          </div>
        </div>

        {/* ── RIGHT: Production Panel sidebar ── */}
        <div className="w-44 flex-shrink-0">
          <ProductionPanel />
        </div>

      </div>
    </div>
  )
}

export default DashboardPage