// main.jsx
// This is the ENTRY POINT of the app - the first file that runs
// We wrap everything with our Providers so the whole app has access to the data

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { MachineProvider } from './context/MachineContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* AuthProvider wraps everything = all pages know who is logged in */}
    <AuthProvider>
      {/* MachineProvider wraps everything = all pages know machine state */}
      <MachineProvider>
        <App />
      </MachineProvider>
    </AuthProvider>
  </StrictMode>
)