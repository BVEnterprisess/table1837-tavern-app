import React from 'react'
import { motion } from 'framer-motion'
import { Wine, Crown } from 'lucide-react'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
      {/* Header */}
      <motion.header 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative z-10 px-6 py-8"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center space-x-3">
            <Crown className="w-8 h-8 text-amber-400" />
            <h1 className="text-4xl md:text-6xl font-playfair font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
              Table 1837
            </h1>
            <Wine className="w-8 h-8 text-amber-400" />
          </div>
          <p className="text-center text-gray-300 mt-2 font-light tracking-wider">
            TAVERN & BAR
          </p>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="relative z-10 px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      {/* Background Effects */}
      <div className="fixed inset-0 z-0">
        <div className="absolute top-20 left-20 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-yellow-500/5 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>
    </div>
  )
}

export default Layout
