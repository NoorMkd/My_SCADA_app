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
    normal:   { color: "text-[#0098c2]", dot: "bg-[#0098c2]", text: "NORMAL"   },
    warning:  { color: "text-[#d5a507]", dot: "bg-[#d5a507]", text: "WARNING"  },
    critical: { color: "text-[#cd6413]", dot: "bg-[#cd6413]", text: "CRITICAL" },
  }

  const c = config[status] || config.normal

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-xl p-4">

      <p className="text-[var(--color-text-dim)] font-mono text-[8px] tracking-widest mb-2">
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