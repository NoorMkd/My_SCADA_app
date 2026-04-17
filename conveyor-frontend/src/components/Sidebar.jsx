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
    <div className="w-16 bg-[#0a1020] border-r border-[#162035] flex flex-col items-center py-4 gap-2 flex-shrink-0">

      {visibleItems.map(item => {
        // Is this the page we're currently on?
        const isActive = location.pathname === item.path

        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            title={item.label}  // tooltip on hover
            className={`
              w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5
              border transition-all duration-200 cursor-pointer
              ${isActive
                ? "bg-[#071a14] border-[#00e5a044] text-[#00e5a0]"
                : "bg-transparent border-transparent text-[#2a3a50] hover:text-[#4a6080] hover:bg-[#162035]"
              }
            `}
          >
            {/* Icon */}
            <span className="text-sm leading-none">{item.icon}</span>
            {/* Tiny label below icon */}
            <span className="text-[6px] tracking-wider leading-none">
              {item.label.slice(0, 4)}
            </span>
          </button>
        )
      })}

    </div>
  )
}

export default Sidebar