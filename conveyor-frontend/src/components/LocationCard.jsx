// LocationCard.jsx
// Shows where the selected conveyor is located in the factory

function LocationCard({ conveyor, runtime }) {

  // Each zone has its own color
  const zoneColors = {
    "ZONE A": { text: "#00e5a0", bg: "#071a14", border: "#00e5a044" },
    "ZONE B": { text: "#60a5fa", bg: "#0a1320", border: "#60a5fa44" },
    "ZONE C": { text: "#fbbf24", bg: "#18140a", border: "#fbbf2444" },
  }

  const zc = zoneColors[conveyor.zone] || zoneColors["ZONE A"]

  const statusText  = conveyor.isRunning ? "● RUNNING"  : "■ STOPPED"
  const statusColor = conveyor.isRunning ? "#00e5a0"    : "#f87171"

  return (
    <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-3 flex flex-col gap-2 overflow-hidden">

      <p className="text-[8px] tracking-widest text-[#4a6080]">
        CONVEYOR LOCATION
      </p>

      {/* Zone pill badge */}
      <span
        className="text-xs tracking-widest font-bold px-3 py-1 rounded-lg border text-center font-mono"
        style={{ color: zc.text, background: zc.bg, borderColor: zc.border }}
      >
        {conveyor.zone}
      </span>

      {/* Location detail rows */}
      <div className="flex flex-col gap-0.5">
        {[
          ["UNIT",    conveyor.name],
          ["SECTION", conveyor.section],
          ["MOTOR",   conveyor.motor],
          ["BAY",     conveyor.bay],
        ].map(([key, val]) => (
          <div
            key={key}
            className="flex justify-between items-center py-1 border-b border-[#162035] text-[9px]"
          >
            <span className="text-[#2a3a50] tracking-wider">{key}</span>
            <span className="text-[#94a3b8] font-mono">{val}</span>
          </div>
        ))}

        {/* Status row — no border bottom */}
        <div className="flex justify-between items-center py-1 text-[9px]">
          <span className="text-[#2a3a50] tracking-wider">STATUS</span>
          <span className="font-mono" style={{ color: statusColor }}>
            {statusText}
          </span>
        </div>
      </div>

      {/* Mini isometric zone indicator */}
      <div className="flex-1 border border-[#162035] rounded-lg overflow-hidden bg-[#060b14] flex items-center justify-center min-h-[80px]">
        <svg viewBox="0 0 140 80" className="w-full">
          {/* Isometric floor */}
          <polygon points="10,50 70,20 130,50 70,80"
            fill="#0a1320" stroke="#162035" strokeWidth="1"/>

          {/* Wall left */}
          <polygon points="10,30 10,50 70,20 70,0"
            fill="#0d1828" stroke="#162035" strokeWidth="1"/>

          {/* Wall right */}
          <polygon points="130,30 130,50 70,20 70,0"
            fill="#0a1525" stroke="#162035" strokeWidth="1"/>

          {/* Ceiling light */}
          <circle cx="70" cy="10" r="3" fill="#060b14"
            stroke={zc.text} strokeWidth="1"/>
          <polygon points="70,13 55,35 85,35"
            fill={zc.text} opacity="0.08"/>

          {/* Zone boxes on the floor */}
          {/* Zone A - left */}
          <rect x="18" y="47" width="28" height="17" rx="2"
            fill={conveyor.zone === "ZONE A" ? zc.bg : "#162035"}
            stroke={conveyor.zone === "ZONE A" ? zc.text : "#1e2d45"}
            strokeWidth={conveyor.zone === "ZONE A" ? "1.5" : "1"}
          />
          <text x="32" y="58" textAnchor="middle"
            fill={conveyor.zone === "ZONE A" ? "#00e5a0" : "#2a3a50"}
            fontSize="7" fontFamily="monospace">A</text>

          {/* Zone B - center */}
          <rect x="56" y="37" width="28" height="17" rx="2"
            fill={conveyor.zone === "ZONE B" ? "#0a1320" : "#162035"}
            stroke={conveyor.zone === "ZONE B" ? "#60a5fa" : "#1e2d45"}
            strokeWidth={conveyor.zone === "ZONE B" ? "1.5" : "1"}
          />
          <text x="70" y="48" textAnchor="middle"
            fill={conveyor.zone === "ZONE B" ? "#60a5fa" : "#2a3a50"}
            fontSize="7" fontFamily="monospace">B</text>

          {/* Zone C - right */}
          <rect x="94" y="27" width="28" height="17" rx="2"
            fill={conveyor.zone === "ZONE C" ? "#18140a" : "#162035"}
            stroke={conveyor.zone === "ZONE C" ? "#fbbf24" : "#1e2d45"}
            strokeWidth={conveyor.zone === "ZONE C" ? "1.5" : "1"}
          />
          <text x="108" y="38" textAnchor="middle"
            fill={conveyor.zone === "ZONE C" ? "#fbbf24" : "#2a3a50"}
            fontSize="7" fontFamily="monospace">C</text>

          {/* Arrow pointing to active zone */}
          {conveyor.zone === "ZONE A" && <>
            <polygon points="32,38 28,43 36,43" fill="#00e5a0"/>
            <line x1="32" y1="43" x2="32" y2="47" stroke="#00e5a0" strokeWidth="1"/>
          </>}
          {conveyor.zone === "ZONE B" && <>
            <polygon points="70,28 66,33 74,33" fill="#60a5fa"/>
            <line x1="70" y1="33" x2="70" y2="37" stroke="#60a5fa" strokeWidth="1"/>
          </>}
          {conveyor.zone === "ZONE C" && <>
            <polygon points="108,18 104,23 112,23" fill="#fbbf24"/>
            <line x1="108" y1="23" x2="108" y2="27" stroke="#fbbf24" strokeWidth="1"/>
          </>}
        </svg>
      </div>

      {/* Runtime */}
      <div className="bg-[#060b14] border border-[#162035] rounded-lg px-3 py-2">
        <p className="text-[8px] text-[#4a6080] tracking-widest mb-1">
          RUNTIME TODAY
        </p>
        <p
          className="text-lg font-bold font-mono tracking-widest"
          style={{ color: conveyor.isRunning ? "#00e5a0" : "#f87171" }}
        >
          {runtime}
        </p>
        {/* Runtime bar — out of 12 hours shift */}
        <div className="h-1 bg-[#162035] rounded-full overflow-hidden mt-1.5">
          <div
            className="h-full rounded-full"
            style={{
              // runtime as % of 12h shift (43200 seconds)
              width: `${Math.min((conveyor.runtimeSeconds / 43200) * 100, 100)}%`,
              background: conveyor.isRunning ? "#00e5a0" : "#f87171"
            }}
          />
        </div>
      </div>
    </div>
  )
}

export default LocationCard