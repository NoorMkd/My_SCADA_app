// ProductionPanel.jsx
// The right side panel showing all conveyors
// Clicking one selects it and updates the whole dashboard

import { useMachine } from "../context/MachineContext"
import { useAuth } from "../context/AuthContext"

function ProductionPanel() {

  const {
    conveyors,
    selectedId,
    setSelectedId,
    getAlerts
  } = useMachine()

  const { user } = useAuth()

  // Can this user add conveyors? Only admin and supervisor
  const canAddConveyor = ["admin", "supervisor"].includes(user?.role)

  return (
    <div className="border-l border-[#162035] bg-[#060b14] p-2.5 flex flex-col gap-2 overflow-y-auto">

      {/* Panel title */}
      <p className="text-[#4a6080] text-[8px] tracking-[3px] pb-2 border-b border-[#162035] flex-shrink-0">
        PRODUCTION LINE
      </p>

      {/* One card per conveyor */}
      {conveyors.map(cv => {
        const alerts   = getAlerts(cv)
        const hasWarn  = alerts.some(a => a.level === "warning" || a.level === "critical")
        const isActive = cv.id === selectedId

        // Border color based on state
        let borderColor = "#7589b4"
        if (isActive && hasWarn)    borderColor = "#fbbf2455"
        else if (isActive)          borderColor = "#00e5a055"
        else if (!cv.isRunning)     borderColor = "#f8717133"
        else if (hasWarn)           borderColor = "#fbbf2433"

        // Background color
        let bgColor = "transparent"
        if (isActive && hasWarn)    bgColor = "#284c50"
        else if (isActive)          bgColor = "#244637"
        else if (!cv.isRunning)     bgColor = "#5a2b26"

        return (
          <div
            key={cv.id}
            onClick={() => setSelectedId(cv.id)}
            className="border rounded-xl p-2.5 cursor-pointer transition-all duration-200 hover:bg-[#0a1020]"
            style={{ borderColor, background: bgColor }}
          >
            {/* Conveyor name + status dot */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-mono">{cv.name}</span>
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: !cv.isRunning ? "#f87171"
                    : hasWarn ? "#fbbf24" : "#00e5a0",
                  // blinking dot for warning
                  animation: hasWarn && cv.isRunning ? "pulse 1s infinite" : "none"
                }}
              />
            </div>

            {/* Sensor values */}
            {[
              ["TEMP",    cv.isRunning ? `${cv.sensors.temperature}°C` : "--", cv.sensors.temperature >= 65 ? "#fbbf24" : "#00e5a0"],
              ["CURRENT", cv.isRunning ? `${cv.sensors.current}A`      : "--", cv.sensors.current >= 14     ? "#fbbf24" : "#00e5a0"],
              ["SPEED",   `${cv.speed}%`,  "#60a5fa"],
              ["ITEMS",   `${cv.itemsToday}`, "#60a5fa"],
            ].map(([label, value, color]) => (
              <div key={label} className="flex justify-between text-[9px] mb-0.5">
                <span className="text-[#2a3a50]">{label}</span>
                <span
                  className="font-mono"
                  style={{ color: cv.isRunning || label === "ITEMS" ? color : "#4a6080" }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        )
      })}

      {/* Add conveyor button — only for admin/supervisor */}
      {canAddConveyor && (
        <div className="mt-auto">
          <button className="w-full bg-transparent border border-dashed border-[#162035] rounded-xl text-[#2a3a50] text-[8px] tracking-wider py-2 cursor-pointer font-mono hover:border-[#60a5fa44] hover:text-[#60a5fa] transition-colors duration-200">
            + ADD CONVEYOR
          </button>
        </div>
      )}
    </div>
  )
}

export default ProductionPanel