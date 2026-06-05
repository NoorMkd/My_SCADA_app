// DashboardPage.jsx

import { useMachine } from "../context/MachineContext"
import { useAuth } from "../context/AuthContext"
import Navbar from "../components/Navbar"
import GaugeCard from "../components/GaugeCard"
import BeltSpeedGauge from "../components/BeltSpeedGauge"
import CameraFeed from "../components/CameraFeed"
import ItemsCounter from "../components/ItemsCounter"
import LocationCard from "../components/LocationCard"
import ProductionPanel from "../components/ProductionPanel"
import Sidebar from "../components/Sidebar"

function DashboardPage() {
  const {
    selectedId,
    getConveyor,
    getAlerts,
    formatRuntime,
    startConveyor,
    stopConveyor,
    increaseSpeed,
    decreaseSpeed,
  } = useMachine()

  const { user } = useAuth()

  const cv = getConveyor(selectedId)

  const canControl = ["admin", "supervisor", "operator"].includes(user?.role)

  const alerts  = cv ? getAlerts(cv) : []
  const runtime = cv ? formatRuntime(cv.runtimeSeconds) : "00:00:00"
  const offline = cv ? !cv.isRunning : true

  // Alert color helper
  function alertStyle(level) {
    if (level === "critical") return {
      bg: "var(--color-bg-base)", border: "var(--color-danger)", text: "var(--color-danger)", icon: "⚠"
    }
    if (level === "warning") return {
      bg: "var(--color-bg-base)", border: "var(--color-warning)", text: "var(--color-warning)", icon: "⚠"
    }
    return {
      bg: "var(--color-bg-base)", border: "var(--color-primary)", text: "var(--color-primary)", icon: "✓"
    }
  }

  if (!cv) return null

  // TARGET Hz display — integer, "--" when null
  const targetHz = (cv.freq_hz !== null && cv.freq_hz !== undefined)
    ? Math.round(cv.freq_hz)
    : "--"

  return (
    <div className="min-h-screen bg-bg-darker flex flex-col">

      <Navbar />

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">

        <Sidebar />

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">

          <div className="flex-1 flex flex-col p-3 gap-3 overflow-auto">

            {/* ══ ROW 1: 4 Gauges + Items Counter (5 columns on large screens) ══ */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 flex-shrink-0">

              {/* Temperature gauge */}
              <GaugeCard
                label="TEMPERATURE"
                value={cv.sensors.temperature}
                max={90}
                unit="°C"
                warnAt={45 / 90}
                critAt={70 / 90}
                offline={offline}
              />

              {/* Current gauge — 0 to 2.5A, warn at 2.2A, critical at 2.5A */}
              <GaugeCard
                label="CURRENT"
                value={cv.sensors.current}
                max={2.5}
                unit="A"
                warnAt={2.0 / 2.5}
                critAt={2.5 / 2.5}
                offline={offline}
              />

              {/* Speed gauge — 0 to 50 Hz, warn at 45 Hz, critical at 48 Hz */}
              <GaugeCard
                label="SPEED"
                value={cv.speed}
                max={50}
                unit="Hz"
                warnAt={45 / 50}
                critAt={48 / 50}
                offline={offline}
              />

              {/* Belt speed gauge — from IR sensor travel time */}
              <BeltSpeedGauge
                value={cv.rpm}
                offline={offline}
              />

              {/* Items counter */}
              <ItemsCounter
                items={cv.itemsToday}
                target={cv.dailyTarget}
                offline={offline}
              />
            </div>

            {/* ══ LOWER AREA ══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1.15fr_1fr] gap-3 flex-shrink-0 items-stretch">

              {/* Camera feed */}
              <CameraFeed conveyorId={selectedId} />

              {/* MIDDLE COLUMN: Controls + Alerts */}
              <div className="flex flex-col gap-3 h-full">

                {/* Machine controls */}
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 flex-[1] flex flex-col justify-center">

                  {/* Header row: label + TARGET Hz readout */}
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[13px] tracking-widest text-[var(--color-text-dim)]">
                      MACHINE CONTROL —{" "}
                      <span className="text-[#94a3b8]">{cv.name.toUpperCase()}</span>
                    </p>
                    <span className="font-mono text-[14px] text-[var(--color-primary)]">
                      TARGET: {targetHz} Hz
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2">

                    {/* STOP */}
                    <button
                      onClick={() => canControl && stopConveyor(cv.id)}
                      disabled={!canControl || !cv.isRunning}
                      className={`font-mono text-[15px] tracking-wider py-3 px-2 rounded-xl border transition-all duration-150 active:scale-95
                        ${!canControl || !cv.isRunning
                          ? "text-[var(--color-text-dim)] border-[var(--color-border-card)] cursor-not-allowed"
                          : "text-[#cd6413] border-[#cd641355] bg-[#180f0f] hover:bg-[#cd641322] cursor-pointer"
                        }`}
                    >
                      ■ STOP
                    </button>

                    {/* START */}
                    <button
                      onClick={() => canControl && startConveyor(cv.id)}
                      disabled={!canControl || cv.isRunning}
                      className={`font-mono text-[15px] tracking-wider py-3 px-2 rounded-xl border transition-all duration-150 active:scale-95
                        ${!canControl || cv.isRunning
                          ? "text-[var(--color-text-dim)] border-[var(--color-border-card)] cursor-not-allowed"
                          : "text-[#0098c2] border-[#0098c255] bg-[var(--color-bg-base)] hover:bg-[#0098c222] cursor-pointer"
                        }`}
                    >
                      ▶ START
                    </button>

                    {/* SPD + */}
                    <button
                      onClick={() => canControl && increaseSpeed(cv.id)}
                      disabled={!canControl || !cv.isRunning}
                      className={`font-mono text-[15px] tracking-wider py-3 px-2 rounded-xl border transition-all duration-150 active:scale-95
                        ${!canControl || !cv.isRunning
                          ? "text-[var(--color-text-dim)] border-[var(--color-border-card)] cursor-not-allowed"
                          : "text-[var(--color-primary)] border-[var(--color-primary)44] bg-[#0a1320] hover:bg-[var(--color-primary)22] cursor-pointer"
                        }`}
                    >
                      ▲ SPD +
                    </button>

                    {/* SPD − */}
                    <button
                      onClick={() => canControl && decreaseSpeed(cv.id)}
                      disabled={!canControl || !cv.isRunning}
                      className={`font-mono text-[15px] tracking-wider py-3 px-2 rounded-xl border transition-all duration-150 active:scale-95
                        ${!canControl || !cv.isRunning
                          ? "text-[var(--color-text-dim)] border-[var(--color-border-card)] cursor-not-allowed"
                          : "text-[var(--color-primary)] border-[var(--color-primary)44] bg-[#0a1320] hover:bg-[var(--color-primary)22] cursor-pointer"
                        }`}
                    >
                      ▼ SPD −
                    </button>
                  </div>

                  {!canControl && (
                    <p className="text-[15px] text-[var(--color-text-dim)] mt-2 tracking-wider">
                      ⊘ Technician role — view only
                    </p>
                  )}
                </div>

                {/* Live alerts */}
                <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-4 flex-[2] min-h-[160px] overflow-auto">
                  <p className="text-[15px] tracking-widest text-[var(--color-text-dim)] mb-3">
                    LIVE SENSOR ALERTS —{" "}
                    <span className="text-[#94a3b8]">{cv.name.toUpperCase()}</span>
                  </p>

                  <div className="flex flex-col gap-2">
                    {alerts.length === 0 ? (
                      <span
                        className="font-mono text-[15px] px-3 py-1.5 rounded-lg border w-fit"
                        style={{
                          color: "#0098c2",
                          borderColor: "#0098c233",
                          background: "var(--color-bg-base)"
                        }}
                      >
                        ✓ ALL SYSTEMS NORMAL
                      </span>
                    ) : (
                      alerts.map((alert, i) => {
                        const s = alertStyle(alert.level)
                        return (
                          <span
                            key={i}
                            className="font-mono text-[14px] px-3 py-1.5 rounded-lg border w-full truncate"
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

              {/* Location card */}
              <LocationCard conveyor={cv} runtime={runtime} />

            </div>
          </div>

          {/* Production panel */}
          <div className="w-full lg:w-44 flex-shrink-0 border-t border-border-card lg:border-t-0 p-3 lg:p-0">
            <ProductionPanel />
          </div>

        </div>
      </div>
    </div>
  )
}

export default DashboardPage
