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
      itemsToday: 0,
      dailyTarget: 300,
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
      itemsToday: 201,
      dailyTarget: 300,
      runtimeSeconds: 26043, // 07:14:03
    },
  ])

  // Which conveyor is currently selected on the dashboard
  const [selectedId, setSelectedId] = useState(1)

  // Thresholds — if sensor goes above these → alert
  const THRESHOLDS = {
    temperature: { warning: 65, critical: 75 },
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

  // Calculate machine health score (0-100%)
  // Based on: temperature and current staying within safe range
  function getHealthScore(conveyor) {
    if (!conveyor.isRunning) return 0
    const { temperature, current } = conveyor.sensors

    // How far is each sensor from its critical limit? (as %)
    const tempScore    = Math.max(0, 100 - (temperature / THRESHOLDS.temperature.critical) * 100)
    const currentScore = Math.max(0, 100 - (current / THRESHOLDS.current.critical) * 100)

    // Average of both scores, rounded
    return Math.round((tempScore + currentScore) / 2)
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
      const res = await fetch("http://localhost:8000/api/techlogs", {
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

  useEffect(() => {
    fetchTechLogs()
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
      const res = await fetch("http://localhost:8000/api/techlogs", {
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
  // alertsHistory: full log of every alert that ever happened
// In real app this comes from your backend database
const [alertsHistory, setAlertsHistory] = useState([])

// Mark an alert as resolved
function resolveAlert(id) {
  setAlertsHistory(prev =>
    prev.map(a => a.id === id ? { ...a, resolved: true } : a)
  )
}

  return (
    <MachineContext.Provider value={{
      conveyors,
      selectedId,
      setSelectedId,
      getConveyor,
      startConveyor,
      stopConveyor,
      increaseSpeed,
      decreaseSpeed,
      getAlerts,
      getHealthScore,
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