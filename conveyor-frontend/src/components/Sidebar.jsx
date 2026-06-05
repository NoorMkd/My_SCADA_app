// Sidebar.jsx
// Left side navigation — links to all pages
// Icons change color when you're on that page
// Some pages hidden based on role

import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

// Each nav item: icon (emoji-free, just text symbols), label, path, who can see it
const NAV_ITEMS = [
  {
    icon: "▣",
    label: "DASHBOARD",
    path: "/dashboard",
    roles: ["admin", "supervisor", "operator", "technician"],
  },
  {
    icon: "◈",
    label: "HISTORY",
    path: "/history",
    roles: ["admin", "supervisor", "operator", "technician"],
  },
  {
    icon: "◎",
    label: "ALERTS",
    path: "/alerts",
    roles: ["admin", "supervisor", "operator", "technician"],
  },
  {
    icon: "△",
    label: "TECH LOG",
    path: "/techlog",
    // only technicians, admins and supervisors see this
    roles: ["admin", "supervisor", "technician"],
  },
  {
    icon: "⊞",
    label: "USERS",
    path: "/users",
    roles: ["admin", "supervisor"],
  },
  {
    icon: "⚙",
    label: "CONFIG",
    path: "/config",
    roles: ["admin", "operator"],
  },
]

function Sidebar() {
  const navigate  = useNavigate()
  const location  = useLocation()  // tells us which page we're on right now
  const { user }  = useAuth()

  // Filter nav items based on the current user's role
  const visibleItems = NAV_ITEMS.filter(item =>
    item.roles.includes(user?.role)
  )

  return (
    <div className="w-full md:w-16 bg-[var(--color-nav-bg)] border-b md:border-b-0 md:border-r border-border-card flex flex-row md:flex-col items-center justify-center md:justify-start py-2 md:py-6 gap-2 md:gap-3 flex-shrink-0 relative z-10 overflow-x-auto">

      {visibleItems.map(item => {
        // Is this the page we're currently on?
        const isActive = location.pathname === item.path

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            title={item.label}
            className={`
              w-[3.5rem] h-[3.5rem] flex flex-col items-center justify-center gap-1
              transition-all duration-150 cursor-pointer shrink-0
              ${isActive
                ? "bg-[#111d2b] md:border-l-4 md:border-b-0 border-b-4 border-primary text-white"
                : "bg-transparent md:border-l-4 md:border-b-0 border-b-4 border-transparent text-text-muted hover:text-white hover:bg-[#111d2b]"
              }
            `}
          >
            {/* Icon */}
            <span className={`text-base leading-none ${isActive ? 'text-primary' : ''}`}>
              {item.icon}
            </span>
            {/* Tiny label below icon */}
            <span className="text-[10px] tracking-[0.2em] font-bold uppercase leading-none mt-1">
              {item.label.slice(0, 4)}
            </span>
          </button>
        )
      })}

    </div>
  )
}

export default Sidebar