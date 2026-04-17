// LoginPage.jsx
// This is the first page every user sees
// It takes username + password, checks them, and sends the user to the dashboard

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

function LoginPage() {

  // useState stores what the user is typing in real time
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  // error message shown when login fails
  const [error, setError] = useState("")

  // useNavigate lets us redirect to another page after login
  const navigate = useNavigate()

  // grab the login function from our AuthContext
  const { login } = useAuth()

  // This runs when the user clicks the LOGIN button
  async function handleLogin() {
    // Try to login with whatever the user typed
    const success = await login(username, password)

    if (success) {
      // If login worked → go to the dashboard
      navigate("/dashboard")
    } else {
      // If login failed → show error message
      setError("Invalid credentials — try again")
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#090d15] text-slate-200">
      {/* Atmospheric industrial backdrop */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 top-12 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
        <div className="absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute inset-0 opacity-35 [background:linear-gradient(transparent_31px,#1b2436_32px),linear-gradient(90deg,transparent_31px,#1b2436_32px)] [background-size:32px_32px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Left info panel */}
          <section className="hidden rounded-3xl border border-slate-700/60 bg-gradient-to-br from-slate-900/90 via-slate-900/80 to-[#102131]/70 p-8 shadow-[0_25px_70px_rgba(0,0,0,0.55)] lg:block">
            <p className="mb-4 inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.25em] text-cyan-300">
              INDUSTRIAL CONTROL APP
            </p>
            <h1 className="max-w-md text-4xl font-semibold leading-tight text-slate-100">
              Conveyor Control APP
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-400">
              SCADA-based real-time monitoring of motors, sensors, and production flow. Secure operator access is required to proceed.
            </p>

            <div className="mt-8 rounded-2xl border border-slate-700/60 bg-[#0a1320] p-4">
              <div className="mb-3 flex items-center justify-between text-[11px] tracking-[0.2em] text-slate-500">
                <span>CONVEYOR LINE</span>
            
              </div>

              {/* Slight 3D conveyor lane with moving parcels */}
              <div className="relative h-44 overflow-hidden rounded-xl border border-cyan-500/20 bg-[#07111d] [perspective:1000px]">
                <div className="absolute inset-x-6 top-20 h-16 rounded-lg border border-slate-600/70 bg-gradient-to-b from-slate-700 to-slate-800 shadow-2xl [transform:rotateX(52deg)]" />

                <div className="absolute inset-x-8 top-[94px] h-4 rounded-full bg-[#2f3f53] [transform:rotateX(55deg)]" />

                <div className="absolute inset-x-10 top-[86px] flex justify-between opacity-90 [transform:rotateX(55deg)]">
                  <span className="h-7 w-7 rounded-full border border-cyan-300/40 bg-slate-700" />
                  <span className="h-7 w-7 rounded-full border border-cyan-300/40 bg-slate-700" />
                  <span className="h-7 w-7 rounded-full border border-cyan-300/40 bg-slate-700" />
                  <span className="h-7 w-7 rounded-full border border-cyan-300/40 bg-slate-700" />
                  <span className="h-7 w-7 rounded-full border border-cyan-300/40 bg-slate-700" />
                </div>

                <div className="absolute left-0 right-0 top-[86px] h-8 overflow-hidden [transform:rotateX(55deg)]">
                  <div className="conveyor-package package-one" />
                  <div className="conveyor-package package-two" />
                  <div className="conveyor-package package-three" />
                </div>

                <div className="absolute bottom-3 left-3 rounded-md border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] tracking-[0.2em] text-emerald-300">
                  ACTIVE FLOW
                </div>
              </div>
            </div>
          </section>

          {/* Login card */}
          <section className="w-full rounded-3xl border border-slate-700/70 bg-[#101a2b]/90 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-md sm:p-8">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.25em] text-cyan-300">CONVEYOR SYSTEM</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-100">Operator Login</h2>
                <p className="mt-1 text-sm text-slate-400">Authenticate to access the SCADA dashboard.</p>
              </div>
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500/10">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.7">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-slate-400">
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-slate-600 bg-[#0b1322] px-4 py-3 text-sm text-cyan-200 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                placeholder="operator.id"
              />
            </div>

            <div className="mb-6">
              <label className="mb-2 block text-xs font-semibold tracking-[0.2em] text-slate-400">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                className="w-full rounded-xl border border-slate-600 bg-[#0b1322] px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
                placeholder="********"
              />
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2.5">
                <div className="h-2 w-2 shrink-0 rounded-full bg-amber-300" />
                <span className="text-xs text-amber-200">{error}</span>
              </div>
            )}

            <button
              onClick={handleLogin}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-400 to-emerald-400 py-3 text-sm font-semibold tracking-[0.2em] text-[#051019] transition-transform duration-200 hover:scale-[1.01] hover:from-cyan-300 hover:to-emerald-300"
            >
              LOGIN TO CONTROL ROOM
            </button>

            <div className="mt-6 flex items-center justify-between text-[11px] tracking-[0.15em] text-slate-500">
              <span>AUTHORIZED PERSONNEL ONLY</span>
              <span className="text-cyan-300">SHIFT A</span>
            </div>
          </section>
        </div>
      </div>

      <style>{`
        .conveyor-package {
          position: absolute;
          top: 3px;
          width: 44px;
          height: 22px;
          border-radius: 4px;
          border: 1px solid rgba(24, 179, 246, 0.35);
          background: linear-gradient(180deg, #172e41 0%, #184267 100%);
          box-shadow: 0 6px 14px rgba(0, 0, 0, 0.45);
          animation: movePackage 8s linear infinite;
        }

        .package-one {
          animation-delay: 0s;
        }

        .package-two {
          animation-delay: 2.2s;
        }

        .package-three {
          animation-delay: 4.4s;
        }

        @keyframes movePackage {
          0% {
            transform: translateX(-60px);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
          100% {
            transform: translateX(520px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

export default LoginPage