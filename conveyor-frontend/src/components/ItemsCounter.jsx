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
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-4 flex flex-col justify-between h-full">

      {/* Top: label + big number */}
      <div>
        <p className="text-[11px] tracking-widest text-[var(--color-text-dim)] mb-2">
          ITEMS DETECTED TODAY
        </p>

        {/* The big count number */}
        <p
          className="text-5xl font-bold tracking-tight font-mono leading-none"
          style={{ color: offline ? "var(--color-text-dim)" : "var(--color-primary)" }}
        >
          {items}
        </p>

        <p className="text-[13px] tracking-widest text-[var(--color-text-dim)] mt-1">
          UNITS PASSED
        </p>
      </div>

      {/* Bottom: progress toward target */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <span className="text-[11px] text-[var(--color-text-dim)] tracking-widest">
            DAILY TARGET
          </span>
          <span
            className="text-[12px] font-mono"
            style={{ color: offline ? "var(--color-text-dim)" : "var(--color-primary)" }}
          >
            {pct}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-[var(--color-border-card)] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background: offline ? "var(--color-text-dim)" : "var(--color-primary)"
            }}
          />
        </div>

        {/* 0 → target labels */}
        <div className="flex justify-between mt-1">
          <span className="text-[11px] text-[var(--color-text-dim)] font-mono">0</span>
          <span className="text-[11px] text-[var(--color-text-dim)] font-mono">
            {target} target
          </span>
        </div>
      </div>
    </div>
  )
}

export default ItemsCounter