// BeltSpeedGauge.jsx
// Belt speed gauge — same SVG arc style as GaugeCard
// Handles null (no item has passed sensors yet)
// Props:
//   value   → belt_speed_mps (float | null)
//   offline → true when machine is stopped

function BeltSpeedGauge({ value, offline }) {
  const max = 68

  const hasValue = value !== null && value !== undefined
  const pct      = hasValue ? Math.min(value / max, 1) : 0

  // Color — green when measured, muted otherwise
  const arcColor = (!offline && hasValue && value > 0) ? "#39ff14" : "#262626"

  // Status label
  let status      = "✗ NO MEASUREMENT"
  let statusColor = "#404040"
  if (offline) {
    status      = "---"
    statusColor = "#262626"
  } else if (hasValue && value > 0) {
    status      = "✓ MEASURED"
    statusColor = "#39ff14"
  } else if (hasValue && value === 0) {
    status      = "✗ IDLE"
    statusColor = "#404040"
  }

  // SVG arc math — identical to GaugeCard
  const r = 50, cx = 65, cy = 75, strokeW = 10
  const startAngle = -215
  const totalArc   = 250

  function polarToXY(angle) {
    const rad = (angle * Math.PI) / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }

  const [startX, startY] = polarToXY(startAngle)
  const [endX,   endY]   = polarToXY(startAngle + totalArc * pct)
  const largeArc         = totalArc * pct > 180 ? 1 : 0
  const [bgEndX, bgEndY] = polarToXY(startAngle + totalArc)

  // 2 decimal places, or "--" when null
  const displayValue = hasValue ? Math.round(value) : "--"

  return (
    <div
      className="bg-bg-card border border-border-card rounded-sm p-4 flex flex-col items-center hover:border-text-dim transition-colors group"
      style={{ boxShadow: (!offline && hasValue && value > 0) ? `inset 0 0 20px ${arcColor}05` : 'none' }}
    >
      {/* Label */}
      <p className="text-[10px] font-bold tracking-[0.2em] text-text-muted mb-2 group-hover:text-primary transition-colors">
        OUTPUT RPM
      </p>

      <svg viewBox="0 0 130 100" className="w-full">

        {/* Background arc */}
        <path
          d={`M ${startX} ${startY} A ${r} ${r} 0 1 1 ${bgEndX} ${bgEndY}`}
          fill="none" stroke="#2a4a6a" strokeWidth={strokeW} strokeLinecap="square"
        />

        {/* Colored value arc — only when there's a positive measurement */}
        {pct > 0 && (
          <path
            d={`M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`}
            fill="none" stroke={arcColor} strokeWidth={strokeW} strokeLinecap="square"
            style={{ filter: `drop-shadow(0 0 3px ${arcColor}66)` }}
          />
        )}

        {/* Value — smaller font to fit 4-char decimal string */}
        <text
          x={cx} y={cy + 6}
          textAnchor="middle"
          fill={hasValue && value > 0 ? arcColor : "#404040"}
          fontSize="22"
          fontFamily="monospace"
          fontWeight="900"
        >
          {displayValue}
        </text>

        {/* Unit */}
        <text x={cx} y={cy + 22} textAnchor="middle" fill={arcColor} fillOpacity="0.4" fontSize="11" fontWeight="bold">
          rpm
        </text>

        {/* Min / Max labels */}
        <text x="8"   y="92" fill="#ffffff" fontWeight="bold" fontSize="9">0</text>
        <text x="107" y="92" fill="#ffffff" fontWeight="bold" fontSize="9">68</text>
      </svg>

      {/* Status */}
      <p className="text-[12px] tracking-wider mt-1" style={{ color: statusColor }}>
        {status}
      </p>
    </div>
  )
}

export default BeltSpeedGauge
