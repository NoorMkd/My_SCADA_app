import { useState, useEffect } from "react"
import { useAuth } from "../context/AuthContext"
import Navbar from "../components/Navbar"
import Sidebar from "../components/Sidebar"

function UsersPage() {
  const { user, addUser, deleteUser } = useAuth()
  const [showAddForm, setShowAddForm] = useState(false)
  const [usersList, setUsersList] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("access_token") || user?.token;
      const response = await fetch(`/api/auth/users`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Sort ascending by ID so new additions appear at the bottom
        setUsersList(data.sort((a, b) => a.id - b.id));
      } else {
        console.error("Failed to fetch users. Response status:", response.status);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch users on mount
  useEffect(() => {
    fetchUsers();
  }, [user?.token]);

  // Form state
  const [newUsername, setNewUsername] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newRole, setNewRole] = useState("operator")

  const handleAddUser = async (e) => {
    e.preventDefault()
    if (!newUsername || !newEmail || !newPassword) return

    const success = await addUser({
      username: newUsername,
      email: newEmail,
      password: newPassword,
      role: newRole,
    })

    if (success) {
      // Reset form and refetch to show in UI
      setNewUsername("")
      setNewEmail("")
      setNewPassword("")
      setNewRole("operator")
      setShowAddForm(false)
      fetchUsers()
    } else {
      alert("Failed to add user. Check console for error details.")
    }
  }

  const handleDelete = async (id, username) => {
    if (user.username === username) {
      alert("You cannot delete your own account.")
      return
    }
    if (window.confirm(`Are you sure you want to delete user: ${username}?`)) {
      const success = await deleteUser(id)
      if (success) {
        fetchUsers()
      } else {
        alert("Failed to delete user.")
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col justify-center items-center">
        <p className="text-[#0098c2] font-mono tracking-widest text-xl animate-pulse">LOADING USERS...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      <Navbar />

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <Sidebar />

        <div className="flex-1 p-4 flex flex-col gap-4 overflow-auto">
          {/* ── HEADER ── */}
          <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl px-5 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-0 flex-shrink-0">
            <div>
              <p className="text-[var(--color-primary)] font-mono text-[12px] tracking-[3px] font-bold">
                ◈ MANAGE USERS
              </p>
              <p className="text-[var(--color-text-dim)] font-mono text-[9px] tracking-widest mt-1">
                PLATFORM ACCESS CONTROL
              </p>
            </div>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-[#0a1320] border border-[#0098c255] rounded-xl text-[#0098c2] font-mono text-[10px] tracking-widest px-6 py-2.5 cursor-pointer hover:bg-[#0098c222] transition-colors duration-200"
            >
              {showAddForm ? "CANCEL" : "+ ADD USER"}
            </button>
          </div>

          {/* ── MAIN CONTENT ── */}
          <div className="flex flex-col md:flex-row gap-4 items-start">
            
            {/* Users List */}
            <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl flex-1 flex flex-col overflow-hidden w-full">
              <div className="p-5 border-b border-[var(--color-border-card)]">
                <p className="text-[#94a3b8] font-mono text-[12px] tracking-[3px]">
                  REGISTERED USERS
                </p>
              </div>

              {/* Table Header */}
              <div className="hidden md:grid grid-cols-4 gap-4 px-5 py-3 border-b border-[var(--color-border-card)] bg-[var(--color-bg-base)]">
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">ID</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">USERNAME</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest">ROLE</div>
                <div className="text-[#94a3b8] text-[10px] font-mono tracking-widest text-right">ACTIONS</div>
              </div>

              {/* Table Body */}
              <div className="flex-1 overflow-auto p-5 space-y-6 md:space-y-4 min-h-[300px]">
                {usersList.map((u, index) => (
                  <div key={u.id} className="flex flex-col gap-2 md:grid md:grid-cols-4 md:gap-4 md:items-center border-b border-[var(--color-border-card)] pb-4 last:border-0 last:pb-0">
                    <div className="flex justify-between md:block">
                      <span className="md:hidden text-[#94a3b8] text-[10px] font-mono tracking-widest">ID</span>
                      <div className="text-[#64748b] font-mono text-[10px]">#{index + 1}</div>
                    </div>
                    
                    <div className="flex justify-between md:block items-center">
                      <span className="md:hidden text-[#94a3b8] text-[10px] font-mono tracking-widest">USERNAME</span>
                      <div className="text-[#f8fafc] font-mono text-[12px] flex items-center justify-end md:justify-start gap-2">
                        <span className="hidden md:flex w-6 h-6 rounded-md justify-center items-center bg-[var(--color-border-card)] text-[10px] text-[var(--color-primary)]">
                          👤
                        </span>
                        {u.username}
                      </div>
                    </div>
                    
                    <div className="flex justify-between md:block items-center">
                      <span className="md:hidden text-[#94a3b8] text-[10px] font-mono tracking-widest">ROLE</span>
                      <div>
                        <span className="px-2 py-0.5 rounded-full border text-[9px] font-mono uppercase tracking-widest"
                        style={{
                          color: u.role === "admin" ? "#cd6413" :
                                 u.role === "supervisor" ? "#d5a507" :
                                 u.role === "technician" ? "#0098c2" : "var(--color-primary)",
                          borderColor: u.role === "admin" ? "#cd641344" :
                                       u.role === "supervisor" ? "#d5a50744" :
                                       u.role === "technician" ? "#0098c244" : "var(--color-primary)44",
                          backgroundColor: u.role === "admin" ? "#cd641311" :
                                           u.role === "supervisor" ? "#d5a50711" :
                                           u.role === "technician" ? "#0098c211" : "var(--color-primary)11",
                        }}
                      >
                        {u.role}
                      </span>
                    </div>
                    </div>

                    <div className="flex justify-end md:justify-end mt-2 md:mt-0">
                      <button
                        onClick={() => handleDelete(u.id, u.username)}
                        className="text-[#cd6413] hover:bg-[#cd641322] px-3 py-1.5 rounded-lg transition-colors font-mono text-[12px] tracking-widest border border-transparent hover:border-[#cd641344] w-full md:w-auto mt-2 md:mt-0 border-[#cd641311]"
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                ))}
                {usersList.length === 0 && (
                  <p className="text-[var(--color-text-dim)] text-[10px] font-mono text-center py-10">NO USERS FOUND.</p>
                )}
              </div>
            </div>

            {/* Add User Form Sidebar */}
            {showAddForm && (
              <div className="w-full md:w-[320px] bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl p-5 flex-shrink-0 transition-all">
                <p className="text-[#94a3b8] font-mono text-[11px] tracking-[3px] mb-5">
                  NEW USER DETAILS
                </p>
                <form onSubmit={handleAddUser} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[var(--color-text-dim)] text-[8px] font-mono tracking-widest pl-1">USERNAME</label>
                    <input
                      type="text"
                      required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="bg-[var(--color-bg-base)] border border-[var(--color-border-card)] rounded-lg px-3 py-2 text-[#e2e8f0] font-mono text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                      placeholder="Enter username"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[var(--color-text-dim)] text-[8px] font-mono tracking-widest pl-1">EMAIL</label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="bg-[var(--color-bg-base)] border border-[var(--color-border-card)] rounded-lg px-3 py-2 text-[#e2e8f0] font-mono text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                      placeholder="Enter email"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[var(--color-text-dim)] text-[8px] font-mono tracking-widest pl-1">PASSWORD</label>
                    <input
                      type="text"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-[var(--color-bg-base)] border border-[var(--color-border-card)] rounded-lg px-3 py-2 text-[#e2e8f0] font-mono text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                      placeholder="Enter password"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[var(--color-text-dim)] text-[8px] font-mono tracking-widest pl-1">ROLE</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="bg-[var(--color-bg-base)] border border-[var(--color-border-card)] rounded-lg px-3 py-2 text-[#e2e8f0] font-mono text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors appearance-none"
                    >
                      <option value="operator">Operator</option>
                      <option value="technician">Technician</option>
                      <option value="supervisor">Supervisor</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="mt-2 w-full bg-[#0098c2] text-[var(--color-bg-base)] font-mono font-bold text-[11px] tracking-widest py-3 rounded-lg hover:bg-[#00cf90] transition-colors"
                  >
                    SAVE USER
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

export default UsersPage
