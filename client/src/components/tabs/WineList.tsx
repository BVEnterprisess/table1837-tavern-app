import React, { useState, useMemo } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { FixedSizeList as List } from 'react-window'
import InfiniteLoader from 'react-window-infinite-loader'
import { motion } from 'framer-motion'
import { Search, Filter, Wine, Star, MapPin } from 'lucide-react'
import { menuApi } from '../../services/api'
import LoadingSpinner from '../ui/LoadingSpinner'
import MenuItem from '../ui/MenuItem'

const WineList: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [sortBy, setSortBy] = useState('name')

  // Infinite query for wine list with search
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    error
  } = useInfiniteQuery({
    queryKey: ['wine-list', searchTerm, selectedFilter, sortBy],
    queryFn: ({ pageParam = 0 }) => 
      menuApi.getMenuItems('wine_list', {
        limit: 20,
        offset: pageParam,
        search: searchTerm || undefined
      }),
    getNextPageParam: (lastPage, pages) => {
      const totalFetched = pages.reduce((acc, page) => acc + page.data.length, 0)
      return lastPage.pagination.hasMore ? totalFetched : undefined
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: true
  })

  // Flatten data for virtual list
  const allItems = useMemo(() => {
    if (!data) return []
    return data.pages.flatMap(page => page.data)
  }, [data])

  // Filter and sort logic
  const filteredItems = useMemo(() => {
    let items = [...allItems]

    // Apply filters
    if (selectedFilter !== 'all') {
      switch (selectedFilter) {
        case 'red':
          items = items.filter(item => item.tags?.includes('red'))
          break
        case 'white':
          items = items.filter(item => item.tags?.includes('white'))
          break
        case 'sparkling':
          items = items.filter(item => item.tags?.includes('sparkling'))
          break
        case 'featured':
          items = items.filter(item => item.tags?.includes('featured'))
          break
        case 'premium':
          items = items.filter(item => (item.price || 0) > 25)
          break
      }
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
      case 'vintage':
        items.sort((a, b) => (b.vintage || 0) - (a.vintage || 0))
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

  // Wine item renderer for virtual list
  const WineItem = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const item = filteredItems[index]

    if (!item) {
      return (
        <div style={style} className="flex items-center justify-center p-4">
          <LoadingSpinner size="sm" />
        </div>
      )
    }

    return (
      <div style={style} className="px-4 py-2">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-sm rounded-lg p-6 border border-white/10 hover:border-amber-500/30 transition-all duration-300 group"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <Wine className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-white group-hover:text-amber-300 transition-colors">
                  {item.name}
                </h3>
                {item.tags?.includes('featured') && (
                  <Star className="w-4 h-4 text-yellow-400" />
                )}
              </div>
              
              {item.description && (
                <p className="text-gray-300 text-sm mb-3 leading-relaxed">
                  {item.description}
                </p>
              )}
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                {item.vintage && (
                  <span className="flex items-center space-x-1">
                    <span className="w-2 h-2 bg-amber-400 rounded-full"></span>
                    <span>Vintage {item.vintage}</span>
                  </span>
                )}
                {item.region && (
                  <span className="flex items-center space-x-1">
                    <MapPin className="w-3 h-3" />
                    <span>{item.region}</span>
                  </span>
                )}
                {item.alcohol_content && (
                  <span>{item.alcohol_content}% ABV</span>
                )}
              </div>
              
              {item.tags && item.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {item.tags.slice(0, 4).map((tag, tagIndex) => (
                    <span
                      key={tagIndex}
                      className="px-2 py-1 bg-amber-500/20 text-amber-300 text-xs rounded-full border border-amber-500/30"
                    >
                      {tag}
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
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-300">Loading wine collection...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-12">
        <div className="text-red-400 mb-2">Failed to load wine list</div>
        <div className="text-gray-400 text-sm">Please try again later</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Wine className="w-8 h-8 text-amber-400" />
          <div>
            <h2 className="text-3xl font-playfair font-bold text-white">Wine Collection</h2>
            <p className="text-gray-400">Curated selection of premium wines</p>
          </div>
        </div>
        <div className="text-sm text-gray-400">
          {filteredItems.length} wines available
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search wines..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        {/* Filter */}
        <select
          value={selectedFilter}
          onChange={(e) => setSelectedFilter(e.target.value)}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="all">All Wines</option>
          <option value="red">Red Wines</option>
          <option value="white">White Wines</option>
          <option value="sparkling">Sparkling</option>
          <option value="featured">Featured</option>
          <option value="premium">Premium ($25+)</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-amber-500 transition-colors"
        >
          <option value="name">Sort by Name</option>
          <option value="price-low">Price: Low to High</option>
          <option value="price-high">Price: High to Low</option>
          <option value="vintage">Vintage</option>
        </select>
      </div>

      {/* Virtual List */}
      <div className="h-96 border border-white/10 rounded-lg overflow-hidden">
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
              itemSize={200}
              onItemsRendered={onItemsRendered}
              className="scrollbar-thin scrollbar-thumb-amber-500 scrollbar-track-transparent"
            >
              {WineItem}
            </List>
          )}
        </InfiniteLoader>
      </div>

      {isFetchingNextPage && (
        <div className="flex items-center justify-center py-4">
          <LoadingSpinner size="sm" />
          <span className="ml-2 text-gray-400">Loading more wines...</span>
        </div>
      )}
    </div>
  )
}

export default WineList
