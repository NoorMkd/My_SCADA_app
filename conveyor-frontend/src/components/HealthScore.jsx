// HealthScore.jsx
// Shows machine health as a big circular progress
// 100% = perfect, 0% = critical / offline

function HealthScore({ score }) {

  // Circle math
  const radius = 54
  const circumference = 2 * Math.PI * radius  // full circle length
  const offset = circumference - (score / 100) * circumference  // how much to "hide"

  // Color based on score
  let color = "#00e5a0"    // green = healthy
  if (score < 40) color = "#f87171"   // red = bad
  else if (score < 70) color = "#fbbf24"  // amber = warning

  const label = score === 0 ? "OFFLINE"
    : score >= 80 ? "HEALTHY"
    : score >= 60 ? "DEGRADED"
    : "CRITICAL"

  return (
    <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-5 flex flex-col items-center justify-center h-full">

      <p className="text-[8px] tracking-widest text-[#4a6080] mb-4">MACHINE HEALTH</p>

      {/* SVG circle progress */}
      <svg viewBox="0 0 140 140" className="w-36 h-36">

        {/* Outer glow ring */}
        <circle cx="70" cy="70" r="62" fill="none" stroke={color + "11"} strokeWidth="12"/>

        {/* Background track */}
        <circle cx="70" cy="70" r={radius} fill="none" stroke="#0f1e30" strokeWidth="10"/>

        {/* Progress arc — starts from top (-90°) */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"   /* start from top */
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />

        {/* Center: big % number */}
        <text x="70" y="65" textAnchor="middle" fill={color} fontSize="28" fontFamily="monospace" fontWeight="bold">
          {score}%
        </text>

        {/* Status word */}
        <text x="70" y="85" textAnchor="middle" fill={color + "99"} fontSize="10" fontFamily="monospace" letterSpacing="2">
          {label}
        </text>
      </svg>

      {/* Small legend */}
      <div className="flex gap-3 mt-3">
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#00e5a0]"/>
          <span className="text-[8px] text-[#4a6080]">HEALTHY ≥80</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#fbbf24]"/>
          <span className="text-[8px] text-[#4a6080]">WARN ≥60</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[#f87171]"/>
          <span className="text-[8px] text-[#4a6080]">CRITICAL</span>
        </div>
      </div>
    </div>
  )
}

export default HealthScore