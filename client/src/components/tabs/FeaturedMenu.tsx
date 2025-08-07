import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Star, Search, Clock, Users, ChefHat } from 'lucide-react'
import { menuApi } from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'

const FeaturedMenu: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')

  const { data, isLoading, error } = useQuery({
    queryKey: ['featured-menu', searchTerm],
    queryFn: () => menuApi.getMenuItems('featured_menu', {
      search: searchTerm || undefined,
      limit: 50
    }),
    staleTime: 5 * 60 * 1000
  })

  const filteredItems = data?.data || []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-300">Loading featured menu...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-12">
        <div className="text-red-400 mb-2">Failed to load featured menu</div>
        <div className="text-gray-400 text-sm">Please try again later</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Star className="w-8 h-8 text-amber-400" />
          <div>
            <h2 className="text-3xl font-playfair font-bold text-white">Featured Menu</h2>
            <p className="text-gray-400">Chef's seasonal selections</p>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          {filteredItems.length} featured dishes
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search featured items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
        />
      </div>

      {/* Menu Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/10 hover:border-amber-500/30 transition-all duration-300 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center space-x-2">
                <ChefHat className="w-5 h-5 text-amber-400" />
                {item.tags?.includes('featured') && (
                  <Star className="w-4 h-4 text-yellow-400" />
                )}
              </div>
              {item.price && (
                <div className="text-2xl font-bold text-amber-400">
                  ${item.price.toFixed(2)}
                </div>
              )}
            </div>

            <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-amber-300 transition-colors">
              {item.name}
            </h3>

            {item.description && (
              <p className="text-gray-300 text-sm leading-relaxed mb-4">
                {item.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-4">
              {item.preparation_time && (
                <span className="flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>{item.preparation_time}min</span>
                </span>
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
              <div className="flex flex-wrap gap-2">
                {item.tags.slice(0, 3).map((tag, tagIndex) => (
                  <span
                    key={tagIndex}
                    className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full border border-amber-500/30"
                  >
                    {tag.replace('_', ' ').toUpperCase()}
                  </span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12">
          <Star className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">No featured items found</p>
        </div>
      )}
    </div>
  )
}

export default FeaturedMenu
