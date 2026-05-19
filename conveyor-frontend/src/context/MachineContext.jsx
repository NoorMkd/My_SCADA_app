// MachineContext.jsx
// Now handles MULTIPLE conveyors instead of just one
// Each conveyor has its own sensors, state, and alerts

import { createContext, useContext, useState, useEffect } from "react"

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
      itemsToday: 74,
      dailyTarget: 300,
      runtimeSeconds: 0,
    },
    {
      id: 3,
      name: "Conveyor 3",
      zone: "ZONE C",
      section: "Section 03",
      motor: "CV3-M01",
      bay: "Bay 03 — South",
      isRunning: true,
      speed: 70,
      sensors: { temperature: 78, current: 16 },
      fault: null,
      itemsToday: 201,
      dailyTarget: 300,
      runtimeSeconds: 26043, // 07:14:03
    },
  ])

  // Which conveyor is currently selected on the dashboard
  const [selectedId, setSelectedId] = useState(1)

  // Thresholds — if sensor goes above these → alert
  const THRESHOLDS = {
    temperature: { warning: 30, critical: 31.5 },
    current:     { warning: 14, critical: 18 },
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
  function startConveyor(id) {
    updateConveyor(id, "isRunning", true)
  }

  // Stop a conveyor
  function stopConveyor(id) {
    updateConveyor(id, "isRunning", false)
    updateConveyor(id, "speed", 0)
  }

  // Increase speed of a conveyor by 10, max 100
  function increaseSpeed(id) {
    const cv = getConveyor(id)
    if (!cv || !cv.isRunning) return
    updateConveyor(id, "speed", Math.min(cv.speed + 10, 100))
  }

  // Decrease speed by 10, min 0
  function decreaseSpeed(id) {
    const cv = getConveyor(id)
    if (!cv) return
    updateConveyor(id, "speed", Math.max(cv.speed - 10, 0))
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
              speed: liveData.speed,
              sensors: {
                temperature: liveData.temperature,
                current: liveData.current,
              },
              itemsToday: liveData.items_today || 0,
              dailyTarget: liveData.daily_target || c.dailyTarget,
              runtimeSeconds: liveData.runtime_seconds || 0,
            }
          }
          return c
        }))
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

 useEffect(() => {
    // Connect to the backend stream using relative path
    // This allows it to work on mobile via your network IP
    const eventSource = new EventSource("/api/stream")

    // Listen for new messages from the backend
    eventSource.onmessage = (event) => {
      const liveData = JSON.parse(event.data)
      console.log("SSE Received:", liveData) // Added for debugging
      
      // Auto-refresh alerts whenever new data comes in
      fetchAlerts()
      
      // Look for the specific conveyor (e.g. Conveyor 1)
      setconveyors(prev => prev.map(c => {
        // Ensure both IDs are numbers for a safe comparison
        if (Number(c.id) === Number(liveData.conveyor_id)) {
          // Merge the real backend data into our React state!
          return {
            ...c,
            isRunning: liveData.is_running,
            speed: liveData.speed,
            sensors: {
              temperature: liveData.temperature,
              current: liveData.current,
            },
            fault: liveData.fault,
            itemsToday: liveData.items_today,
            dailyTarget: liveData.daily_target || c.dailyTarget,
            runtimeSeconds: liveData.runtime_seconds,
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