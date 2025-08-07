import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wine, Utensils, Martini, Star } from 'lucide-react'
import WineList from './tabs/WineList'
import FeaturedMenu from './tabs/FeaturedMenu'
import SignatureCocktails from './tabs/SignatureCocktails'
import TavernMenu from './tabs/TavernMenu'

const tabs = [
  { id: 'wine', label: 'Wine List', icon: Wine, component: WineList },
  { id: 'featured', label: 'Featured Menu', icon: Star, component: FeaturedMenu },
  { id: 'cocktails', label: 'Signature Cocktails', icon: Martini, component: SignatureCocktails },
  { id: 'tavern', label: 'Tavern Menu', icon: Utensils, component: TavernMenu },
]

const MenuTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('wine')
  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || WineList

  return (
    <div className="space-y-8">
      {/* Tab Navigation */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-wrap justify-center gap-4"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                relative px-6 py-3 rounded-lg font-medium transition-all duration-300
                flex items-center space-x-2 group
                ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-black shadow-lg shadow-amber-500/25'
                    : 'bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm'
                }
              `}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Icon className="w-5 h-5" />
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-gradient-to-r from-amber-600 to-yellow-600 rounded-lg -z-10"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              )}
            </motion.button>
          )
        })}
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -20, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden"
        >
          <ActiveComponent />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

export default MenuTabs
