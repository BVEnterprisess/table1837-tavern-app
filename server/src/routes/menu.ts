import { Router } from 'express'
import { DatabaseService } from '../services/database'
import { asyncHandler } from '../middleware/errorHandler'
import { optionalAuth, AuthRequest } from '../middleware/auth'
import { logger } from '../utils/logger'

const router = Router()

// Get menu items by category with pagination and caching
router.get('/:category', optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { category } = req.params
  const { limit = '50', offset = '0', search } = req.query
  
  const validCategories = ['wine_list', 'featured_menu', 'signature_cocktails', 'tavern_menu']
  
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid menu category' })
  }
  
  try {
    let result
    
    if (search && typeof search === 'string') {
      // Search mode
      const items = await DatabaseService.searchMenuItems(category, search, parseInt(limit as string))
      result = { items, total: items.length }
    } else {
      // Paginated listing
      result = await DatabaseService.getMenuItems(
        category,
        parseInt(limit as string),
        parseInt(offset as string)
      )
    }
    
    // Performance logging
    logger.info('Menu request served', {
      category,
      itemCount: result.items.length,
      total: result.total,
      hasSearch: !!search,
      userId: req.user?.id || 'anonymous',
      responseTime: Date.now() - (req as any).startTime
    })
    
    // Set cache headers for performance
    res.set({
      'Cache-Control': 'public, max-age=300, s-maxage=600', // 5min client, 10min CDN
      'ETag': `"${category}-${Date.now()}"`
    })
    
    res.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: result.total > (parseInt(offset as string) + result.items.length)
      }
    })
    
  } catch (error) {
    logger.error(`Error fetching ${category} menu:`, error)
    res.status(500).json({ error: 'Failed to fetch menu items' })
  }
}))

// Get featured/signature items (high-performance endpoint)
router.get('/:category/featured', optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { category } = req.params
  
  try {
    const items = await DatabaseService.searchMenuItems(category, '', 20)
    const featuredItems = items.filter(item => item.tags?.includes('featured') || item.tags?.includes('signature'))
    
    // Ultra-aggressive caching for featured items
    res.set({
      'Cache-Control': 'public, max-age=3600, s-maxage=7200', // 1hr client, 2hr CDN
      'ETag': `"featured-${category}-${Date.now()}"`
    })
    
    res.json({
      success: true,
      data: featuredItems.slice(0, 12), // Limit to top 12 featured items
      category
    })
    
  } catch (error) {
    logger.error(`Error fetching featured ${category}:`, error)
    res.status(500).json({ error: 'Failed to fetch featured items' })
  }
}))

// Performance monitoring middleware
router.use((req, res, next) => {
  (req as any).startTime = Date.now()
  next()
})

export default router
