// MachineContext.jsx
// Now handles MULTIPLE conveyors instead of just one
// Each conveyor has its own sensors, state, and alerts

import { createContext, useContext, useState, useEffect, useRef } from "react"

const MachineContext = createContext()

export function MachineProvider({ children }) {

  // All conveyors stored in one array
  // Later you'll fetch this from your backend instead
  const [conveyors, setconveyors] = useState([
    {
      id: 1,
      name: "Conveyor 1",
      zone: "ZONE A",
      section: "Section 01",
      motor: "CV1-M01",
      bay: "Bay 01 — North",
      isRunning: false,
      speed: 0,
      sensors: { temperature: 0, current: 0 },
      fault: null,
      itemsToday: 0,
      dailyTarget: 0,
      runtimeSeconds: 0,
      rpm: null,
      freq_hz: null,
    },
    {
      id: 2,
      name: "Conveyor 2",
      zone: "ZONE B",
      section: "Section 02",
      motor: "CV2-M01",
      bay: "Bay 02 — Center",
      isRunning: false,
      speed: 0,
      sensors: { temperature: 0, current: 0 },
      fault: null,
      itemsToday: 0,
      dailyTarget: 0,
      runtimeSeconds: 0,
      rpm: null,
      freq_hz: null,
    },
    {
      id: 3,
      name: "Conveyor 3",
      zone: "ZONE C",
      section: "Section 03",
      motor: "CV3-M01",
      bay: "Bay 03 — South",
      isRunning: false,
      speed: 0,
      sensors: { temperature: 0, current: 0 },
      fault: null,
      itemsToday: 0,
      dailyTarget: 0,
      runtimeSeconds: 0,
      belt_speed_mps: null,
      freq_hz: null,
    },
  ])

  // Which conveyor is currently selected on the dashboard
  const [selectedId, setSelectedId] = useState(1)

  // Tracks when a start/stop command was last sent per conveyor id.
  // While the lock is active the SSE handler won't override isRunning,
  // giving the ESP32 up to 5 s to physically respond before SSE corrects state.
  const commandLockRef = useRef({})

  // Thresholds — if sensor goes above these → alert
  const THRESHOLDS = {
    temperature: { warning: 45, critical: 70 },
    current:     { warning: 2.2, critical: 2.5 },
  }

  // Helper: get one conveyor by its id
  function getConveyor(id) {
    return conveyors.find(c => c.id === id)
  }

  // Helper: update one field of one conveyor
  // id = which conveyor, field = what to change, value = new value
  function updateConveyor(id, field, value) {
    setconveyors(prev =>
      prev.map(c => c.id === id ? { ...c, [field]: value } : c)
    )
  }

  // Start a conveyor
  async function startConveyor(id) {
    updateConveyor(id, "isRunning", true)
    commandLockRef.current[id] = Date.now() + 5000 // block SSE override for 5 s
    try {
      const token = localStorage.getItem("access_token")
      await fetch(`/api/conveyor/${id}/start`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      })
    } catch (e) {
      updateConveyor(id, "isRunning", false)
      delete commandLockRef.current[id]
      console.error("Failed to start conveyor:", e)
    }
  }

  // Stop a conveyor
  async function stopConveyor(id) {
    updateConveyor(id, "isRunning", false)
    commandLockRef.current[id] = Date.now() + 5000 // block SSE override for 5 s
    try {
      const token = localStorage.getItem("access_token")
      await fetch(`/api/conveyor/${id}/stop`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      })
    } catch (e) {
      updateConveyor(id, "isRunning", true)
      delete commandLockRef.current[id]
      console.error("Failed to stop conveyor:", e)
    }
  }

  async function increaseSpeed(id) {
    const cv = getConveyor(id)
    if (!cv || !cv.isRunning) return
    updateConveyor(id, "speed", Math.min(cv.speed + 5, 100))
    try {
      const token = localStorage.getItem("access_token")
      await fetch(`/api/conveyor/${id}/speed?direction=up`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      })
    } catch (e) {
      console.error("Failed to increase speed:", e)
    }
  }

  async function decreaseSpeed(id) {
    const cv = getConveyor(id)
    if (!cv || !cv.isRunning) return
    updateConveyor(id, "speed", Math.max(cv.speed - 5, 0))
    try {
      const token = localStorage.getItem("access_token")
      await fetch(`/api/conveyor/${id}/speed?direction=down`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      })
    } catch (e) {
      console.error("Failed to decrease speed:", e)
    }
  }

  // Calculate alerts for a conveyor based on its sensor values
  function getAlerts(conveyor) {
    const alerts = []
    if (!conveyor.isRunning) {
      alerts.push({ msg: "Machine offline — not started", level: "info" })
      return alerts
    }
    
    // Add real hardware fault if ESP32 sent one
    if (conveyor.fault) {
      alerts.push({ msg: `Hardware Fault: ${conveyor.fault}`, level: "critical" })
    }

    const { temperature, current } = conveyor.sensors
    if (temperature >= THRESHOLDS.temperature.critical)
      alerts.push({ msg: `High Temp: ${temperature}°C (limit ${THRESHOLDS.temperature.critical}°C)`, level: "critical" })
    else if (temperature >= THRESHOLDS.temperature.warning)
      alerts.push({ msg: `Warm Temp: ${temperature}°C`, level: "warning" })

    if (current >= THRESHOLDS.current.critical)
      alerts.push({ msg: `High Current: ${current}A (limit ${THRESHOLDS.current.critical}A)`, level: "critical" })
    else if (current >= THRESHOLDS.current.warning)
      alerts.push({ msg: `Current rising: ${current}A`, level: "warning" })

    return alerts
  }

  

  // Convert seconds to HH:MM:SS string
  function formatRuntime(seconds) {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`
  }

  // Stores all technician log entries
  // Each entry has: id, who wrote it, which conveyor, type, text, timestamp
  const [techLogs, setTechLogs] = useState([])

  // Fetch tech logs from backend
  const fetchTechLogs = async () => {
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`/api/techlogs`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        // parse timestamps
        const formattedData = data.map(log => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }))
        setTechLogs(formattedData.sort((a,b) => b.timestamp - a.timestamp))
      }
    } catch (e) {
      console.error("Failed to fetch tech logs:", e)
    }
  }

  // alertsHistory: full log of every alert that ever happened
  const [alertsHistory, setAlertsHistory] = useState([])

  // Tracks which alerts are currently active per conveyor to avoid duplicate saves.
  // Key format: "conveyorId|alertMessage"
  const activeAlertsRef = useRef({})

  // POST a new alert to the backend — called exactly once per rising edge
  async function postAlert(conveyor_id, message, level) {
    try {
      const token = localStorage.getItem("access_token")
      await fetch(`/api/alerts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ conveyor_id, message, level })
      })
      fetchAlerts()
    } catch (e) {
      console.error("Failed to save alert:", e)
    }
  }

  // Fetch alerts from backend
  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`/api/alerts`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const formattedAlerts = data.map(a => ({
          ...a,
          timestamp: new Date(a.timestamp),
          conveyor: `Conveyor ${a.conveyor_id}` // Map backend ID to frontend name
        }))
        setAlertsHistory(formattedAlerts)
      }
    } catch (e) {
      console.error("Failed to fetch alerts:", e)
    }
  }

  // Fetch the current snapshot immediately on page load
  const fetchCurrentSnapshot = async () => {
    try {
      const token = localStorage.getItem("access_token")

      // Fetch latest machine state
      const res = await fetch(`/api/conveyor/1/latest`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const liveData = await res.json()
        setconveyors(prev => prev.map(c => {
          if (c.id === liveData.conveyor_id) {
            return {
              ...c,
              isRunning: liveData.is_running,
              itemsToday: liveData.items_today || 0,
              dailyTarget: liveData.daily_target || c.dailyTarget,
              runtimeSeconds: liveData.runtime_seconds || 0,
            }
          }
          return c
        }))
      }

      // Fetch latest AI prediction for all conveyors so we don't start empty
      const predRes = await fetch(`/api/conveyor/1/predictions/latest`, {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (predRes.ok) {
        const predData = await predRes.json()
        if (!predData.error) {
          setconveyors(prev => prev.map(c => 
            c.id === 1 ? { ...c, aiPrediction: predData } : c
          ))
        }
      }

    } catch (e) {
      console.error("Failed to fetch initial conveyor snapshot:", e)
    }
  }

  useEffect(() => {
    fetchTechLogs()
    fetchAlerts() // Fetch alerts when component loads
    fetchCurrentSnapshot() // Get immediate machine status on load
  }, [])

  // Adds a new log entry
  async function addTechLog({ conveyor, type, text, author }) {
    // Parse the conveyor name into an ID (e.g., "Conveyor 1" -> 1)
    const conveyor_id = parseInt(conveyor.split(" ")[1]) || 1;

    const newLogDto = {
      author,
      conveyor_id,
      intervention_type: type,
      description: text
    }

    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`/api/techlogs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(newLogDto)
      })
      
      if (res.ok) {
        // Refresh the list to grab the DB-assigned ID
        fetchTechLogs()
      } else {
        console.error("Failed to save tech log to database")
      }
    } catch (error) {
      console.error("Error saving tech log:", error)
    }
  }

  // Mark an alert as resolved
  async function resolveAlert(id) {
    try {
      const token = localStorage.getItem("access_token")
      const res = await fetch(`/api/alerts/${id}/resolve`, {
        method: "PATCH",
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        // Locally update the UI to show it's resolved without reloading the page
        setAlertsHistory(prev =>
          prev.map(a => a.id === id ? { ...a, resolved: true } : a)
        )
      }
    } catch (e) {
      console.error("Failed to resolve alert:", e)
    }
  }

 // Rising-edge alert detection: fires whenever sensor data updates via SSE.
  // Saves each alert to the backend exactly once when it first appears,
  // and removes it from the ref when the condition clears (so it can be re-saved if it returns).
  useEffect(() => {
    conveyors.forEach(cv => {
      const current = getAlerts(cv).filter(a => a.level === "critical" || a.level === "warning")
      const currentKeys = new Set(current.map(a => `${cv.id}|${a.msg}`))

      current.forEach(alert => {
        const key = `${cv.id}|${alert.msg}`
        if (!activeAlertsRef.current[key]) {
          activeAlertsRef.current[key] = true
          postAlert(cv.id, alert.msg, alert.level)
        }
      })

      Object.keys(activeAlertsRef.current)
        .filter(k => k.startsWith(`${cv.id}|`))
        .forEach(key => {
          if (!currentKeys.has(key)) delete activeAlertsRef.current[key]
        })
    })
  }, [conveyors]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Connect to the backend stream using relative path
    // This allows it to work on mobile via your network IP
    const eventSource = new EventSource("/api/stream")

    // Listen for new messages from the backend
    eventSource.onmessage = (event) => {
      const liveData = JSON.parse(event.data)
      console.log("SSE:", liveData.conveyor_id, "items:", liveData.items_today)
      
      // Handle ML prediction broadcast separately
      if (liveData.type === "prediction") {
        console.log("SSE Prediction Update:", liveData.prediction);
        setconveyors(prev => prev.map(c => 
          Number(c.id) === Number(liveData.conveyor_id) 
            ? { ...c, aiPrediction: liveData.prediction } 
            : c
        ))
        // If it's a critical AI alert, add to live alerts history!
        if (liveData.prediction.anomaly?.label === "CRITICAL") {
           postAlert(liveData.conveyor_id, "AI Alert: Critical Anomaly Detected!", "critical");
        }
        return;
      }
      
      // Look for the specific conveyor (e.g. Conveyor 1)
      setconveyors(prev => prev.map(c => {
        if (Number(c.id) === Number(liveData.conveyor_id)) {
          // If a start/stop command was sent recently, keep our optimistic
          // isRunning value — don't let a stale SSE tick undo the button click
          // before the ESP32 has had time to physically respond.
          const locked = (commandLockRef.current[c.id] ?? 0) > Date.now()
          return {
            ...c,
            isRunning: locked
              ? c.isRunning
              : (liveData.is_running !== undefined ? liveData.is_running : c.isRunning),
            speed: liveData.speed ?? c.speed,
            sensors: {
              temperature: liveData.temperature ?? c.sensors.temperature,
              current: liveData.current ?? c.sensors.current,
            },
            fault: liveData.fault !== undefined ? liveData.fault : c.fault,
            itemsToday: liveData.items_today ?? c.itemsToday,
            dailyTarget: liveData.daily_target || c.dailyTarget,
            runtimeSeconds: liveData.runtime_seconds ?? c.runtimeSeconds,
            // null is a valid value here (no item passed) — use !== undefined, not ??
            rpm: liveData.rpm !== undefined ? liveData.rpm : c.rpm,
            freq_hz:        liveData.freq_hz        !== undefined ? liveData.freq_hz        : c.freq_hz,
          }
        }
        return c
      }))
    }

    eventSource.onerror = (err) => {
      console.error("SSE Connection Error:", err)
    }

    // Cleanup connection if the component unmounts
    return () => {
      eventSource.close()
    }
  }, [])
  return (
    <MachineContext.Provider value={{
      conveyors,
      setconveyors,
      selectedId,
      setSelectedId,
      getConveyor,
      updateConveyor,
      startConveyor,
      stopConveyor,
      increaseSpeed,
      decreaseSpeed,
      getAlerts,
      formatRuntime,
      THRESHOLDS,
      techLogs,
      addTechLog,
      alertsHistory,
      resolveAlert,
    }}>
      {children}
    </MachineContext.Provider>
  )
}

export function useMachine() {
  return useContext(MachineContext)
}