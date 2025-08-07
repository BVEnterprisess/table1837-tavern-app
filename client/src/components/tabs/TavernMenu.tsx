import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Utensils, Search, DollarSign } from 'lucide-react'
import { menuApi } from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'

const TavernMenu: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [priceFilter, setPriceFilter] = useState('all')

  const { data, isLoading, error } = useQuery({
    queryKey: ['tavern-menu', searchTerm],
    queryFn: () => menuApi.getMenuItems('tavern_menu', {
      search: searchTerm || undefined,
      limit: 100
    }),
    staleTime: 5 * 60 * 1000
  })

  const filteredItems = (data?.data || []).filter(item => {
    if (priceFilter === 'all') return true
    const price = item.price || 0
    switch (priceFilter) {
      case 'under-15': return price < 15
      case '15-25': return price >= 15 && price <= 25
      case 'over-25': return price > 25
      default: return true
    }
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-300">Loading tavern menu...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-12">
        <div className="text-red-400 mb-2">Failed to load tavern menu</div>
        <div className="text-gray-400 text-sm">Please try again later</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Utensils className="w-8 h-8 text-amber-400" />
          <div>
            <h2 className="text-3xl font-playfair font-bold text-white">Tavern Menu</h2>
            <p className="text-gray-400">Hearty classics & comfort food</p>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          {filteredItems.length} tavern dishes
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tavern menu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>
        
        <select
          value={priceFilter}
          onChange={(e) => setPriceFilter(e.target.value)}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="all">All Prices</option>
          <option value="under-15">Under $15</option>
          <option value="15-25">$15 - $25</option>
          <option value="over-25">Over $25</option>
        </select>
      </div>

      {/* Menu Items */}
      <div className="space-y-4">
        {filteredItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 hover:border-amber-500/30 transition-all duration-300 group"
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-2">
                  <Utensils className="w-5 h-5 text-amber-400" />
                  <h3 className="text-lg font-semibold text-white group-hover:text-amber-300 transition-colors">
                    {item.name}
                  </h3>
                </div>
                
                {item.description && (
                  <p className="text-gray-300 text-sm mb-3 leading-relaxed">
                    {item.description}
                  </p>
                )}
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                  {item.preparation_time && (
                    <span>⏱️ {item.preparation_time} min</span>
                  )}
                  {item.spice_level && item.spice_level > 0 && (
                    <div className="flex items-center space-x-1">
                      <span>🌶️</span>
                      <div className="flex space-x-1">
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1 h-3 rounded-full ${
                              i < item.spice_level! ? 'bg-red-400' : 'bg-gray-600'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {item.tags.slice(0, 4).map((tag, tagIndex) => (
                      <span
                        key={tagIndex}
                        className="px-2 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full border border-orange-500/30"
                      >
                        {tag.replace('_', ' ').toUpperCase()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="text-right ml-4">
                {item.price && (
                  <div className="text-2xl font-bold text-amber-400">
                    ${item.price.toFixed(2)}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <Utensils className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No tavern items found</p>
          {searchTerm && (
            <p className="text-gray-500 text-sm mt-2">Try adjusting your search terms</p>
          )}
        </div>
      )}
    </div>
  )
}

export default TavernMenu
