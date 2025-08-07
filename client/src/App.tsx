import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import MenuTabs from './components/MenuTabs'
import AdminPanel from './components/AdminPanel'
import Login from './components/Login'
import { useAuthStore } from './store/authStore'

function App() {
  const { user } = useAuthStore()

  return (
    <div className="min-h-screen bg-black text-white">
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/admin" element={
          user?.role === 'boss' ? <AdminPanel /> : <Login />
        } />
        <Route path="/" element={
          <Layout>
            <MenuTabs />
          </Layout>
        } />
      </Routes>
    </div>
  )
}

export default App
