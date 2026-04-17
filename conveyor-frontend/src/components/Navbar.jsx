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
    admin:      "text-[#60a5fa] border-[#60a5fa33]",
    supervisor: "text-purple-400 border-purple-400/30",
    operator:   "text-[#00e5a0] border-[#00e5a044]",
    technician: "text-[#fbbf24] border-[#fbbf2444]",
  }

  return (
    <nav className="bg-[#0a1020] border-b border-[#162035] px-5 py-2.5 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 bg-[#00e5a0] rounded-full animate-pulse" />
        <span className="text-[#00e5a0] font-mono text-[11px] tracking-[4px]">
          CONVEYOR SCADA
        </span>
        <span className="text-[#162035] text-sm">│</span>
        <span className="text-[#2a3a50] font-mono text-[9px] tracking-widest">
          {selected ? `${selected.name.toUpperCase()} · ${selected.zone}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className={`font-mono text-[10px] border px-2.5 py-0.5 rounded ${roleColors[user?.role]}`}>
          {user?.role?.toUpperCase()}
        </span>
        <span className="text-[#4a6080] font-mono text-[10px]">
          {user?.username}
        </span>
        <button
          onClick={handleLogout}
          className="text-[#f87171] border border-[#f8717133] hover:bg-[#f8717111] font-mono text-[10px] px-2.5 py-0.5 rounded transition-colors duration-200"
        >
          LOGOUT
        </button>
      </div>
    </nav>
  )
}

export default Navbar