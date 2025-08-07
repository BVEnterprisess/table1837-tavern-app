import React, { useState, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { FixedSizeList as List } from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Martini, Star, Flame, Clock } from 'lucide-react'
import { menuApi } from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'

const SignatureCocktails: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [selectedCocktail, setSelectedCocktail] = useState<any>(null)

  // Infinite query for signature cocktails
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery({
    queryKey: ['signature-cocktails', searchTerm, selectedFilter, sortBy],
    queryFn: ({ pageParam = 0 }) => 
      menuApi.getMenuItems('signature_cocktails', {
        limit: 25,
        offset: pageParam,
        search: searchTerm || undefined
      }),
    getNextPageParam: (lastPage, pages) => {
      const totalFetched = pages.reduce((acc, page) => acc + page.data.length, 0)
      return lastPage.pagination.hasMore ? totalFetched : undefined
    },
    staleTime: 3 * 60 * 1000, // 3 minutes for cocktails (more dynamic)
    enabled: true
  })

  // Flatten and process data
  const allItems = useMemo(() => {
    if (!data) return []
    return data.pages.flatMap(page => page.data)
  }, [data])

  // Advanced filtering and sorting
  const filteredItems = useMemo(() => {
    let items = [...allItems]

    // Apply filters
    switch (selectedFilter) {
      case 'signature':
        items = items.filter(item => item.tags?.includes('signature'))
        break
      case 'premium':
        items = items.filter(item => item.tags?.includes('premium') || (item.price || 0) > 15)
        break
      case 'classic':
        items = items.filter(item => item.tags?.includes('classic'))
        break
      case 'seasonal':
        items = items.filter(item => item.tags?.includes('seasonal'))
        break
      case 'strong':
        items = items.filter(item => (item.alcohol_content || 0) > 25)
        break
      case 'featured':
        items = items.filter(item => item.tags?.includes('featured'))
        break
    }

    // Apply sorting
    switch (sortBy) {
      case 'name':
        items.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'price-low':
        items.sort((a, b) => (a.price || 0) - (b.price || 0))
        break
      case 'price-high':
        items.sort((a, b) => (b.price || 0) - (a.price || 0))
        break
      case 'alcohol':
        items.sort((a, b) => (b.alcohol_content || 0) - (a.alcohol_content || 0))
        break
      case 'popularity':
        items.sort((a, b) => {
          const aScore = (a.tags?.includes('featured') ? 10 : 0) + (a.tags?.includes('signature') ? 5 : 0)
          const bScore = (b.tags?.includes('featured') ? 10 : 0) + (b.tags?.includes('signature') ? 5 : 0)
          return bScore - aScore
        })
        break
    }

    return items
  }, [allItems, selectedFilter, sortBy])

  const isItemLoaded = (index: number) => !!filteredItems[index]
  const itemCount = hasNextPage ? filteredItems.length + 1 : filteredItems.length

  const loadMoreItems = () => {
    if (!isFetchingNextPage && hasNextPage) {
      fetchNextPage()
    }
  }

  // Cocktail item renderer with enhanced styling
  const CocktailItem = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredItems[index]

    if (!item) {
      return (
        <div style={style} className="flex items-center justify-center p-4">
          <LoadingSpinner size="sm" />
        </div>
      )
    }

    const isSignature = item.tags?.includes('signature')
    const isFeatured = item.tags?.includes('featured')
    const isPremium = item.tags?.includes('premium')
    const spiceLevel = item.spice_level || 0

    return (
      <div style={style} className="px-4 py-3">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.02 }}
          className={`
            relative bg-gradient-to-br from-white/5 to-white/10 backdrop-blur-sm rounded-lg p-6 
            border transition-all duration-300 cursor-pointer group overflow-hidden
            ${
              isSignature 
                ? 'border-amber-500/50 hover:border-amber-400 shadow-lg shadow-amber-500/20' 
                : 'border-white/10 hover:border-white/30'
            }
          `}
          onClick={() => setSelectedCocktail(item)}
        >
          {/* Premium Badge */}
          {isPremium && (
            <div className="absolute top-4 right-4 px-2 py-1 bg-gradient-to-r from-yellow-600 to-amber-600 text-black text-xs font-bold rounded-full">
              PREMIUM
            </div>
          )}

          {/* Signature Glow Effect */}
          {isSignature && (
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-amber-500/10 rounded-lg" />
          )}

          <div className="relative flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <Martini className={`w-5 h-5 ${isSignature ? 'text-amber-400' : 'text-white'}`} />
                <h3 className={`text-lg font-semibold transition-colors ${
                  isSignature ? 'text-amber-300' : 'text-white group-hover:text-amber-300'
                }`}>
                  {item.name}
                </h3>
                {isFeatured && <Star className="w-4 h-4 text-yellow-400 animate-pulse" />}
              </div>

              {item.description && (
                <p className="text-gray-300 text-sm mb-3 leading-relaxed">
                  {item.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-3 text-sm text-gray-400 mb-3">
                {item.alcohol_content && (
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                    <span>{item.alcohol_content}% ABV</span>
                  </span>
                )}
                {item.preparation_time && (
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>{item.preparation_time}min</span>
                  </span>
                )}
                {spiceLevel > 0 && (
                  <div className="flex items-center space-x-1">
                    <Flame className="w-3 h-3 text-red-400" />
                    <div className="flex space-x-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 h-3 rounded-full ${
                            i < spiceLevel ? 'bg-red-400' : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {item.tags.slice(0, 4).map((tag, tagIndex) => (
                    <span
                      key={tagIndex}
                      className={`px-2 py-1 text-xs rounded-full border ${
                        tag === 'signature' 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : tag === 'premium'
                          ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                          : 'bg-white/10 text-gray-300 border-white/20'
                      }`}
                    >
                      {tag.replace('_', ' ').toUpperCase()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="text-right ml-4">
              {item.price && (
                <div className={`text-2xl font-bold ${
                  isSignature ? 'text-amber-400' : 'text-white'
                }`}>
                  ${item.price.toFixed(2)}
                </div>
              )}
            </div>
          </div>

          {/* Hover Effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent transform translate-x-full group-hover:translate-x-0 transition-transform duration-700" />
        </motion.div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-300">Loading signature cocktails...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-12">
        <div className="text-red-400 mb-2">Failed to load cocktail menu</div>
        <div className="text-gray-400 text-sm">Please try again later</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Martini className="w-8 h-8 text-amber-400" />
          <div>
            <h2 className="text-3xl font-playfair font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
              Signature Cocktails
            </h2>
            <p className="text-gray-400">Handcrafted excellence in every glass</p>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          {filteredItems.length} cocktails available
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search cocktails..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <select
          value={selectedFilter}
          onChange={(e) => setSelectedFilter(e.target.value)}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="all">All Cocktails</option>
          <option value="signature">Signature</option>
          <option value="premium">Premium</option>
          <option value="classic">Classic</option>
          <option value="seasonal">Seasonal</option>
          <option value="strong">Strong (25%+ ABV)</option>
          <option value="featured">Featured</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="popularity">Sort by Popularity</option>
          <option value="name">Name</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="alcohol">Alcohol Content</option>
        </select>
      </div>

      {/* Virtual List */}
      <div className="h-96 border border-white/10 rounded-lg overflow-hidden bg-black/20">
        <InfiniteLoader
          isItemLoaded={isItemLoaded}
          itemCount={itemCount}
          loadMoreItems={loadMoreItems}
        >
          {({ onItemsRendered, ref }) => (
            <List
              ref={ref}
              height={384}
              itemCount={itemCount}
              itemSize={180}
              onItemsRendered={onItemsRendered}
              className="scrollbar-thin scrollbar-thumb-amber-500 scrollbar-track-transparent"
            >
              {CocktailItem}
            </List>
          )}
        </InfiniteLoader>
      </div>

      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-gray-400">Loading more cocktails...</span>
        </div>
      )}

      {/* Cocktail Detail Modal */}
      <AnimatePresence>
        {selectedCocktail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedCocktail(null)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gradient-to-br from-gray-900 to-black border border-amber-500/30 rounded-2xl p-8 max-w-lg w-full max-h-96 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <Martini className="w-12 h-12 text-amber-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">{selectedCocktail.name}</h3>
                {selectedCocktail.price && (
                  <div className="text-3xl font-bold text-amber-400 mb-4">
                    ${selectedCocktail.price.toFixed(2)}
                  </div>
                )}
                {selectedCocktail.description && (
                  <p className="text-gray-300 leading-relaxed mb-6">
                    {selectedCocktail.description}
                  </p>
                )}
                <button
                  onClick={() => setSelectedCocktail(null)}
                  className="px-6 py-2 bg-amber-600 hover:bg-amber-700 text-black font-medium rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default SignatureCocktails
