// AuthContext.jsx
// This file manages WHO is logged in and their ROLE
// Any page in the app can read this information

import { createContext, useContext, useState, useEffect } from "react"

// Step 1: Create the context (like creating a radio station)
const AuthContext = createContext()

// Step 2: The Provider wraps the whole app and "broadcasts" the data
export function AuthProvider({ children }) {

  // This holds the current user. null = nobody is logged in
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Check localStorage for an existing token on app load
  useEffect(() => {
    const token = localStorage.getItem("access_token")
    if (token) {
      try {
        const payloadBase64 = token.split(".")[1]
        const decodedPayload = JSON.parse(atob(payloadBase64))
        setUser({
          id: decodedPayload.sub || decodedPayload.id,
          username: decodedPayload.username,
          role: decodedPayload.role,
          token: token,
        })
      } catch (error) {
        console.error("Invalid token:", error)
        localStorage.removeItem("access_token")
      }
    }
    setLoading(false)
  }, [])
  
  // Login function - called when user submits the login form
  async function login(username, password) {
    try {
      // Backend expects URL-encoded form data
      const formData = new URLSearchParams()
      formData.append("username", username)
      formData.append("password", password)

      // 1. Call real backend
      const response = await fetch("http://localhost:8000/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      })

      if (!response.ok) {
        return false // Login failed
      }

      // 2. Parse the answer (it contains the access_token)
      const data = await response.json()
      const token = data.access_token

      // 3. Decode the token to get the user's role and id
      // A JWT has 3 parts separated by dots. The middle part is the data (payload).
      const payloadBase64 = token.split(".")[1]
      const decodedPayload = JSON.parse(atob(payloadBase64)) // e.g. { sub: "1", username: "admin", role: "admin" }

      // 4. Save the user in memory (and save the token too, so we can use it in other requests)
      localStorage.setItem("access_token", token)
      setUser({
        id: decodedPayload.sub || decodedPayload.id,
        username: decodedPayload.username,
        role: decodedPayload.role,
        token: token,
      })

      return true // Login success
    } catch (error) {
      console.error("Login Error:", error)
      return false
    }
  }

  // Manage users functions
  // Implement addUser via POST /api/auth/register
  async function addUser(newUser) {
    try {
      const token = localStorage.getItem("access_token") || user?.token;
      const response = await fetch("http://localhost:8000/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(newUser)
      });
      if (!response.ok) {
        console.error("Failed to add user:", await response.text());
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error adding user:", error);
      return false;
    }
  }

  // Implement deleteUser via backend endpoint
  async function deleteUser(id) {
    try {
      const token = localStorage.getItem("access_token") || user?.token;
      const response = await fetch(`http://localhost:8000/api/auth/users/${id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      if (!response.ok) {
        console.error("Failed to delete user:", await response.text());
        return false;
      }
      return true;
    } catch (error) {
      console.error("Error deleting user:", error);
      return false;
    }
  }

  // Logout function - clears the user from memory
  function logout() {
    localStorage.removeItem("access_token")
    setUser(null)
  }

  // Step 3: Share the data with the entire app
  return (
    <AuthContext.Provider value={{ user, login, logout, addUser, deleteUser }}>
      {!loading && children}
    </AuthContext.Provider>
  )
}

// Step 4: A shortcut hook so any component can easily read the context
// Instead of writing useContext(AuthContext) every time, just write useAuth()
export function useAuth() {
  return useContext(AuthContext)
}