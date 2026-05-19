// CameraFeed.jsx
// Shows live MJPEG stream from ESP32-CAM
// The <img> tag handles the stream automatically —
// the browser keeps reading new JPEG frames from the backend URL
// Props:
//   conveyorId → which conveyor's camera to show (1, 2, 3)

import { useState, useEffect } from "react"

function CameraFeed({ conveyorId }) {

  // Is the camera online?
  const [online, setOnline] = useState(false)

  // Check camera status every 5 seconds
  useEffect(() => {
    function checkStatus() {
      fetch(`http://localhost:8000/api/stream/${conveyorId}/status`)
        .then(res => res.json())
        .then(data => setOnline(data.online))
        .catch(() => setOnline(false))
    }

    checkStatus() // check immediately
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [conveyorId])

  // The stream URL — browser handles MJPEG automatically
  const streamUrl = `http://localhost:8000/api/stream/${conveyorId}`

  return (
    <div className="bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-2xl overflow-hidden flex flex-col h-full">

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border-card)] flex-shrink-0">
        <p className="text-[8px] tracking-widest text-[var(--color-text-dim)]">
          LIVE CAMERA — CONVEYOR {conveyorId}
        </p>

        {/* Online / Offline indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: online ? "#00e5a0" : "#f87171",
              animation: online ? "pulse 2s infinite" : "none"
            }}
          />
          <span
            className="text-[8px] font-mono"
            style={{ color: online ? "#00e5a0" : "#f87171" }}
          >
            {online ? "LIVE" : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* Camera feed area */}
      <div className="flex-1 relative bg-[#060b14] flex items-center justify-center">

        {online ? (
          // The img tag handles MJPEG streaming automatically
          // The browser keeps reading new frames from the URL
          <img
            src={streamUrl}
            alt={`Conveyor ${conveyorId} camera feed`}
            className="w-full h-full object-cover"
            // If image fails to load → mark as offline
            onError={() => setOnline(false)}
          />
        ) : (
          // Offline placeholder
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[#0a1020] border border-[#162035] flex items-center justify-center">
              <span className="text-[#2a3a50] text-xl">◉</span>
            </div>
            <div className="text-center">
              <p className="text-[#4a6080] font-mono text-[10px] tracking-widest">
                NO SIGNAL
              </p>
              <p className="text-[#2a3a50] font-mono text-[8px] mt-1">
                Camera offline or not connected
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer: timestamp */}
      <div className="px-4 py-2 border-t border-[var(--color-border-card)] flex-shrink-0">
        <p className="text-[8px] text-[#2a3a50] font-mono">
          {online
            ? `Streaming · ~10 FPS · QVGA 320×240`
            : "Connect ESP32-CAM to WiFi and start backend"
          }
        </p>
      </div>
    </div>
  )
}

export default CameraFeed