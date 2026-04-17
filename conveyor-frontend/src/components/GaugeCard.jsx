// GaugeCard.jsx
// Draws one arc gauge for a sensor value
// Props:
//   label  → "TEMPERATURE"
//   value  → 45
//   max    → 90
//   unit   → "°C"
//   warnAt → 0.72  (72% of max = warning)
//   critAt → 0.84  (84% of max = critical)
//   offline → true/false (machine stopped)

function GaugeCard({ label, value, max, unit, warnAt, critAt, offline }) {

  // What % of the max is the current value?
  const pct = offline ? 0 : Math.min(value / max, 1)

  // Pick color based on status
  let color = "#00e5a0"  // green = normal
  if (offline)       color = "#2a3a50"  // gray = offline
  else if (pct >= critAt) color = "#f87171"  // red = critical
  else if (pct >= warnAt) color = "#fbbf24"  // amber = warning

  // Status text shown below the gauge
  const status = offline ? "OFFLINE"
    : pct >= critAt ? "● CRITICAL"
    : pct >= warnAt ? "⚠ WARNING"
    : "● NORMAL"

  // SVG arc math
  // The gauge goes from -215° to +35° (250° total sweep)
  const r = 50, cx = 65, cy = 75, strokeW = 10
  const startAngle = -215
  const totalArc = 250

  function polarToXY(angle) {
    const rad = (angle * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }

  const [startX, startY] = polarToXY(startAngle)
  const [endX, endY]     = polarToXY(startAngle + totalArc * pct)
  const largeArc         = totalArc * pct > 180 ? 1 : 0

  // Full background arc end point
  const [bgEndX, bgEndY] = polarToXY(startAngle + totalArc)

  const displayValue = offline ? "--" : value

  return (
    <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-4 flex flex-col items-center"
         style={{ borderColor: color + "33" }}>

      {/* Sensor name */}
      <p className="text-[8px] tracking-widest text-[#4a6080] mb-1">{label}</p>

      {/* SVG Gauge */}
      <svg viewBox="0 0 130 100" className="w-full">

        {/* Background arc (gray track) */}
        <path
          d={`M ${startX} ${startY} A ${r} ${r} 0 1 1 ${bgEndX} ${bgEndY}`}
          fill="none" stroke="#0f1e30" strokeWidth={strokeW} strokeLinecap="round"
        />

        {/* Colored value arc */}
        {pct > 0 && (
          <path
            d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="round"
          />
        )}

        {/* Center circle background */}
        <circle cx={cx} cy={cy} r="33" fill="#060b14" />

        {/* Big value number */}
        <text
          x={cx} y={cy + 6}
          textAnchor="middle"
          fill={color}
          fontSize="26"
          fontFamily="monospace"
          fontWeight="bold"
        >
          {displayValue}
        </text>

        {/* Unit label */}
        <text x={cx} y={cy + 20} textAnchor="middle" fill={color + "99"} fontSize="10" fontFamily="monospace">
          {unit}
        </text>

        {/* Min / Max labels */}
        <text x="8" y="92" fill="#162035" fontSize="7" fontFamily="monospace">0</text>
        <text x={max >= 100 ? 106 : 108} y="92" fill="#162035" fontSize="7" fontFamily="monospace">{max}</text>
      </svg>

      {/* Status text */}
      <p className="text-[9px] tracking-wider mt-1" style={{ color }}>{status}</p>
    </div>
  )
}

export default GaugeCard