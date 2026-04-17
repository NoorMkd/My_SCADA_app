// ItemsCounter.jsx
// Shows total items detected today as a big number
// with a progress bar toward the daily target
// Props:
//   items  → number of items counted today
//   target → daily goal (e.g. 300)
//   offline → machine stopped or not

function ItemsCounter({ items, target, offline }) {

  // How close are we to the daily target? (as %)
  const pct = Math.min(Math.round((items / target) * 100), 100)

  return (
    <div className="bg-[#0a1020] border border-[#162035] rounded-2xl p-4 flex flex-col justify-between h-full">

      {/* Top: label + big number */}
      <div>
        <p className="text-[8px] tracking-widest text-[#4a6080] mb-2">
          ITEMS DETECTED TODAY
        </p>

        {/* The big count number */}
        <p
          className="text-5xl font-bold tracking-tight font-mono leading-none"
          style={{ color: offline ? "#4a6080" : "#60a5fa" }}
        >
          {items}
        </p>

        <p className="text-[10px] tracking-widest text-[#4a6080] mt-1">
          UNITS PASSED
        </p>
      </div>

      {/* Bottom: progress toward target */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[8px] text-[#4a6080] tracking-widest">
            DAILY TARGET
          </span>
          <span
            className="text-[9px] font-mono"
            style={{ color: offline ? "#4a6080" : "#60a5fa" }}
          >
            {pct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-[#162035] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: offline ? "#2a3a50" : "#60a5fa"
            }}
          />
        </div>

        {/* 0 → target labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-[#2a3a50] font-mono">0</span>
          <span className="text-[8px] text-[#2a3a50] font-mono">
            {target} target
          </span>
        </div>
      </div>
    </div>
  )
}

export default ItemsCounter