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
  let color = "#39ff14"  // Neon Green
  if (offline)       color = "#262626"  // Muted gray
  else if (pct >= critAt) color = "#ff3131"  // Neon Red
  else if (pct >= warnAt) color = "#ffee00"  // Neon Yellow

  // Status text shown below the gauge
  const status = offline ? "---"
    : pct >= critAt ? "! CRITICAL"
    : pct >= warnAt ? "Δ WARNING"
    : "√ OPERATIONAL"

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
    <div className="bg-bg-card border border-border-card rounded-sm p-4 flex flex-col items-center hover:border-text-dim transition-colors group"
         style={{ boxShadow: offline ? 'none' : `inset 0 0 20px ${color}05` }}>

      {/* Sensor name */}
      <p className="text-[7px] font-bold tracking-[0.2em] text-text-muted mb-2 group-hover:text-primary transition-colors">{label}</p>

      {/* SVG Gauge */}
      <svg viewBox="0 0 130 100" className="w-full">

        {/* Background arc (gray track) */}
        <path
          d={`M ${startX} ${startY} A ${r} ${r} 0 1 1 ${bgEndX} ${bgEndY}`}
          fill="none" stroke="#1a1a1a" strokeWidth={strokeW} strokeLinecap="square"
        />

        {/* Colored value arc */}
        {pct > 0 && (
          <path
            d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none" stroke={color} strokeWidth={strokeW} strokeLinecap="square"
            style={{ filter: `drop-shadow(0 0 3px ${color}66)` }}
          />
        )}

        {/* Big value number */}
        <text
          x={cx} y={cy + 6}
          textAnchor="middle"
          fill={color}
          fontSize="28"
          fontFamily="monospace"
          fontWeight="900"
        >
          {displayValue}
        </text>

        {/* Unit label */}
        <text x={cx} y={cy + 22} textAnchor="middle" fill={color} fillOpacity="0.4" fontSize="8" fontWeight="bold">
          {unit}
        </text>

        {/* Min / Max labels */}
        <text x="8" y="92" fill="#404040" fontSize="6">000</text>
        <text x={max >= 100 ? 106 : 108} y="92" fill="#404040" fontSize="6">{max.toString().padStart(3, '0')}</text>
      </svg>

      {/* Status text */}
      <p className="text-[9px] tracking-wider mt-1" style={{ color }}>{status}</p>
    </div>
  )
}

export default GaugeCard