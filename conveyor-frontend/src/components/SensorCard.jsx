// SensorCard.jsx
// A simple card showing one sensor value with status color
// We keep this for potential use in other pages (alerts page, history etc.)
// Props:
//   label  → "TEMPERATURE"
//   value  → 45
//   unit   → "°C"
//   status → "normal" | "warning" | "critical"

function SensorCard({ label, value, unit, status }) {

  const config = {
    normal:   { color: "text-[#00e5a0]", dot: "bg-[#00e5a0]", text: "NORMAL"   },
    warning:  { color: "text-[#fbbf24]", dot: "bg-[#fbbf24]", text: "WARNING"  },
    critical: { color: "text-[#f87171]", dot: "bg-[#f87171]", text: "CRITICAL" },
  }

  const c = config[status] || config.normal

  return (
    <div className="bg-[#0a1020] border border-[#162035] rounded-xl p-4">

      <p className="text-[#4a6080] font-mono text-[8px] tracking-widest mb-2">
        {label}
      </p>

      <p className={`font-mono text-3xl font-bold ${c.color}`}>
        {value}
        <span className="text-lg ml-1 font-normal">{unit}</span>
      </p>

      <div className="flex items-center gap-1.5 mt-2">
        <div className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
        <span className={`font-mono text-[8px] tracking-widest ${c.color}`}>
          {c.text}
        </span>
      </div>
    </div>
  )
}

export default SensorCard