import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useMachine } from "../context/MachineContext";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

export default function ConfigPage() {
  const { user } = useAuth();
  const { conveyors, updateConveyor } = useMachine();
  const token = localStorage.getItem("access_token");
  
  // Find the active conveyor (usually ID 1 for now)
  const activeConveyor = conveyors.find(c => c.id === 1) || conveyors[0];
  
  const [config, setConfig] = useState({
    todays_target: 1000,
    material_name: "Standard Box",
    material_type: "Cardboard",
    item_length_cm: 10.0,
    item_mass_kg: 1.0,
    conveyor_speed_m_s: 0.5,
    conveyor_length_m: 5.0,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [timeToPass, setTimeToPass] = useState(0);
  const [totalTimeToPass, setTotalTimeToPass] = useState(0);

  useEffect(() => {
    fetchConfig();
  }, []);

  // Sync conveyor speed dynamically from real-world state
  useEffect(() => {
    if (activeConveyor && activeConveyor.speed !== undefined) {
      // Assuming 100% speed = 1.0 m/s, so we divide by 100
      const currentSpeedInMs = activeConveyor.speed / 100;
      setConfig(prev => ({
        ...prev,
        conveyor_speed_m_s: currentSpeedInMs
      }));
    }
  }, [activeConveyor?.speed]);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/production/config", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch configuration");
      const data = await res.json();
      setConfig({
        todays_target: data.todays_target,
        material_name: data.material_name,
        material_type: data.material_type,
        item_length_cm: data.item_length_cm,
        item_mass_kg: data.item_mass_kg,
        conveyor_speed_m_s: data.conveyor_speed_m_s,
        conveyor_length_m: data.conveyor_length_m || 5.0,
      });
      setTimeToPass(data.time_to_pass_sec || 0);
      setTotalTimeToPass(data.total_time_required_sec || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setConfig((prev) => ({
      ...prev,
      [name]: ["material_name", "material_type"].includes(name) ? value : Number(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      // Include all config fields (even speed) because the backend schema requires it
      const res = await fetch("/api/production/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Failed to update config");
      
      const updated = await res.json();
      setMessage("Configuration saved successfully!");
      setTimeToPass(updated.time_to_pass_sec || 0);
      setTotalTimeToPass(updated.total_time_required_sec || 0);

      // Instantly update the target inside the React Context so Dashboard items chart updates automatically without refresh
      if (activeConveyor) {
        updateConveyor(activeConveyor.id, "dailyTarget", updated.todays_target);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Time for ONE item to clear the IR Sensor beam
  const timeToPassSensor = config.conveyor_speed_m_s > 0 
    ? (config.item_length_cm / 100) / config.conveyor_speed_m_s 
    : 0;

  // Time for ONE item to travel the entire length of the conveyor
  const transitTime = config.conveyor_length_m && config.conveyor_speed_m_s > 0 
    ? config.conveyor_length_m / config.conveyor_speed_m_s 
    : 0;

  // Minimum time needed: The total time for all items to pass the sensor + the time for the last item to reach the end
  const totalProjectedTime = (timeToPassSensor * config.todays_target) + transitTime;

  // Format time (e.g. into hours, minutes, seconds)
  const formatTime = (seconds) => {
    if (!seconds) return "0 s";
    if (seconds < 60) return `${Math.round(seconds)} s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins < 60) return `${mins} m ${secs} s`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs} h ${remMins} m ${secs} s`;
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] flex flex-col">
      <Navbar title={user?.role === "admin" || user?.role === "operator" ? "Production Configuration" : "Configuration (View Only)"} />
      
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        <Sidebar />
        
        <div className="flex-1 bg-[var(--color-bg-base)] overflow-y-auto p-4 lg:p-6 lg:pl-10">
          <div className="max-w-4xl mx-auto py-8 px-6">
            <div className="bg-gray-800 rounded-xl p-8 shadow-lg border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6">Settings</h2>

          {loading ? (
            <p className="text-gray-400">Loading configuration...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Today's Target Items</label>
                  <input
                    type="number"
                    name="todays_target"
                    value={config.todays_target}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={user?.role !== "admin" && user?.role !== "operator"}
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Conveyor Speed (m/s) [Live]</label>
                  <input
                    type="number"
                    step="0.01"
                    name="conveyor_speed_m_s"
                    value={config.conveyor_speed_m_s}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-gray-400 rounded p-3 cursor-not-allowed opacity-75"
                    disabled={true}
                    title="Speed is fixed based on real-time conveyor data"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Conveyor Length (m) [Live]</label>
                  <input
                    type="number"
                    step="0.01"
                    name="conveyor_length_m"
                    value={config.conveyor_length_m}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-gray-400 rounded p-3 cursor-not-allowed opacity-75"
                    disabled={true}
                    title="Length is fixed based on real-time dual IR Sensor logic"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-700">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Material Name</label>
                  <input
                    type="text"
                    name="material_name"
                    value={config.material_name}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={user?.role !== "admin" && user?.role !== "operator"}
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Material Type</label>
                  <input
                    type="text"
                    name="material_type"
                    value={config.material_type}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={user?.role !== "admin" && user?.role !== "operator"}
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Item Length (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="item_length_cm"
                    value={config.item_length_cm}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={user?.role !== "admin" && user?.role !== "operator"}
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Item Mass (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    name="item_mass_kg"
                    value={config.item_mass_kg}
                    onChange={handleChange}
                    className="w-full bg-gray-700 text-white rounded p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={user?.role !== "admin" && user?.role !== "operator"}
                  />
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-700 p-6 rounded-lg mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-gray-400 text-sm mb-1">Time to Pass IR Sensor (Per Item)</p>
                  <div className="text-3xl font-mono text-blue-400">
                    {timeToPassSensor.toFixed(3)} s
                  </div>
                  {message && <p className="text-green-400 text-xs font-medium mt-2">Saved: {timeToPass.toFixed(3)} s</p>}
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Full Conveyor Transit Time (1 Item)</p>
                  <div className="text-3xl font-mono text-cyan-400">
                    {transitTime.toFixed(1)} s
                  </div>
                </div>
                <div>
                  <p className="text-gray-400 text-sm mb-1">Total Time for Target ({config.todays_target} items)</p>
                  <div className="text-3xl font-mono text-purple-400">
                    {formatTime(totalProjectedTime)}
                  </div>
                  {message && <p className="text-green-400 text-xs font-medium mt-2">Saved: {formatTime(totalTimeToPass)}</p>}
                </div>
              </div>

              {(user?.role === "admin" || user?.role === "operator") && (
                <div className="pt-6">
                  {error && <p className="text-red-400 mb-4">{error}</p>}
                  {message && <p className="text-green-400 mb-4">{message}</p>}
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded transition-colors"
                  >
                    {saving ? "Saving..." : "Save Configuration"}
                  </button>
                </div>
              )}
            </form>
          )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
