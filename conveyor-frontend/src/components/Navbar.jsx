// Navbar.jsx
import { useAuth } from "../context/AuthContext"
import { useNavigate } from "react-router-dom"
import { useMachine } from "../context/MachineContext"

function Navbar() {
  const { user, logout } = useAuth()
  const { conveyors, selectedId } = useMachine()
  const navigate = useNavigate()

  const selected = conveyors.find(c => c.id === selectedId)

  function handleLogout() {
    logout()
    navigate("/")
  }

  const roleColors = {
    admin:      "text-primary border-primary/30",
    supervisor: "text-secondary border-secondary/30",
    operator:   "text-success border-success/30",
    technician: "text-warning border-warning/30",
  }

  return (
    <nav className="bg-[var(--color-nav-bg)] border-b border-border-card px-3 md:px-5 py-3 md:py-2.5 flex flex-col md:flex-row items-center justify-between gap-3 md:gap-0 flex-shrink-0 relative z-10 shadow-md">
      <div className="flex flex-col md:flex-row items-center gap-1 md:gap-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-success rounded-sm animate-pulse shadow-[0_0_8px_var(--color-success)]" />
          <span className="text-white font-mono text-[13px] md:text-[13px] font-bold tracking-[0.2em] text-center">
            CONVEYOR / SCADA
          </span>
        </div>
        <span className="hidden md:inline text-border-card text-sm">|</span>
        <span className="text-primary font-mono text-[9px] md:text-[10px] tracking-widest font-bold text-center">
          {selected ? `UPLINK: ${selected.name.toUpperCase()} [${selected.zone}]` : "AWAITING LINK..."}
        </span>
      </div>
      <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center">
        <span className={`font-mono text-[9px] border border-l-2 px-2 py-0.5 rounded-none ${roleColors[user?.role]}`}>
          {user?.role?.toUpperCase()}
        </span>
        <span className="text-text-muted font-mono text-[10px] uppercase">
          {user?.username}
        </span>
        <button
          onClick={handleLogout}
          className="bg-danger text-white hover:bg-red-700 font-mono text-[10px] uppercase px-3 py-1 rounded-sm border border-danger transition-colors duration-150"
        >
          DISCONNECT
        </button>
      </div>
    </nav>
  )
}

export default Navbar