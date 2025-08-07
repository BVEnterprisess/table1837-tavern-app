import { Router } from 'express'
import { DatabaseService, supabase } from '../services/database'
import { asyncHandler, createError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { logger, alertWebhook } from '../utils/logger'

const router = Router()

// Get all menu items for admin management
router.get('/menu/:category/all', asyncHandler(async (req: AuthRequest, res) => {
  const { category } = req.params
  const { limit = '100', offset = '0' } = req.query
  
  const validCategories = ['wine_list', 'featured_menu', 'signature_cocktails', 'tavern_menu']
  
  if (!validCategories.includes(category)) {
    throw createError('Invalid menu category', 400)
  }
  
  try {
    // Admin can see all items including inactive ones
    const { data, error, count } = await supabase
      .from('menu_items')
      .select('*', { count: 'exact' })
      .eq('category', category)
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1)
    
    if (error) throw error
    
    res.json({
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    })
    
  } catch (error) {
    logger.error('Admin menu fetch error:', error)
    throw createError('Failed to fetch menu items', 500)
  }
}))

// Update menu item
router.put('/menu/item/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params
  const updates = req.body
  const user = req.user!
  
  // Remove read-only fields
  delete updates.id
  delete updates.created_at
  
  updates.updated_at = new Date().toISOString()
  
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw createError('Menu item not found', 404)
      }
      throw error
    }
    
    // Log the update
    await DatabaseService.logMenuUpdate({
      user_id: user.id,
      menu_type: data.category as any,
      operation: 'update',
      changes: { item_id: id, updates }
    })
    
    logger.info('Menu item updated', {
      itemId: id,
      userId: user.id,
      changes: Object.keys(updates)
    })
    
    res.json({
      success: true,
      data,
      message: 'Menu item updated successfully'
    })
    
  } catch (error) {
    logger.error('Menu item update error:', error)
    throw createError('Failed to update menu item', 500)
  }
}))

// Delete menu item
router.delete('/menu/item/:id', asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params
  const user = req.user!
  
  // Only boss can delete items
  if (user.role !== 'boss') {
    throw createError('Only boss can delete menu items', 403)
  }
  
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', id)
      .select()
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        throw createError('Menu item not found', 404)
      }
      throw error
    }
    
    // Log the deletion
    await DatabaseService.logMenuUpdate({
      user_id: user.id,
      menu_type: data.category as any,
      operation: 'delete',
      changes: { deleted_item: data }
    })
    
    logger.info('Menu item deleted', {
      itemId: id,
      itemName: data.name,
      userId: user.id
    })
    
    await alertWebhook(`Menu item '${data.name}' deleted by ${user.name}`, 'warn')
    
    res.json({
      success: true,
      message: 'Menu item deleted successfully'
    })
    
  } catch (error) {
    logger.error('Menu item deletion error:', error)
    throw createError('Failed to delete menu item', 500)
  }
}))

// Create new menu item
router.post('/menu/item', asyncHandler(async (req: AuthRequest, res) => {
  const itemData = req.body
  const user = req.user!
  
  // Validate required fields
  if (!itemData.name || !itemData.category) {
    throw createError('Name and category are required', 400)
  }
  
  const validCategories = ['wine_list', 'featured_menu', 'signature_cocktails', 'tavern_menu']
  if (!validCategories.includes(itemData.category)) {
    throw createError('Invalid category', 400)
  }
  
  // Set metadata
  itemData.id = `${itemData.category}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  itemData.created_at = new Date().toISOString()
  itemData.updated_at = itemData.created_at
  itemData.available = itemData.available ?? true
  
  try {
    const { data, error } = await supabase
      .from('menu_items')
      .insert(itemData)
      .select()
      .single()
    
    if (error) throw error
    
    // Log the creation
    await DatabaseService.logMenuUpdate({
      user_id: user.id,
      menu_type: data.category as any,
      operation: 'create',
      changes: { new_item: data }
    })
    
    logger.info('Menu item created', {
      itemId: data.id,
      itemName: data.name,
      category: data.category,
      userId: user.id
    })
    
    res.status(201).json({
      success: true,
      data,
      message: 'Menu item created successfully'
    })
    
  } catch (error) {
    logger.error('Menu item creation error:', error)
    throw createError('Failed to create menu item', 500)
  }
}))

// Get menu update history
router.get('/menu/history', asyncHandler(async (req: AuthRequest, res) => {
  const { limit = '50', offset = '0', menu_type } = req.query
  
  try {
    let query = supabase
      .from('menu_updates')
      .select(`
        *,
        users:user_id (name, email)
      `)
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1)
    
    if (menu_type) {
      query = query.eq('menu_type', menu_type)
    }
    
    const { data, error, count } = await query
    
    if (error) throw error
    
    res.json({
      success: true,
      data: data || [],
      pagination: {
        total: count || 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    })
    
  } catch (error) {
    logger.error('Menu history fetch error:', error)
    throw createError('Failed to fetch menu history', 500)
  }
}))

// Get system stats
router.get('/stats', asyncHandler(async (req: AuthRequest, res) => {
  try {
    const stats = await Promise.all([
      // Menu item counts by category
      supabase.from('menu_items').select('category', { count: 'exact' }).eq('available', true),
      supabase.from('menu_items').select('category', { count: 'exact' }),
      
      // Recent activity
      supabase.from('menu_updates').select('*', { count: 'exact' })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      
      // User counts
      supabase.from('users').select('role', { count: 'exact' }).eq('active', true)
    ])
    
    const [activeItems, allItems, recentUpdates, activeUsers] = stats
    
    res.json({
      success: true,
      data: {
        menu_items: {
          active: activeItems.count || 0,
          total: allItems.count || 0
        },
        recent_activity: {
          updates_24h: recentUpdates.count || 0
        },
        users: {
          active: activeUsers.count || 0
        },
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString()
        }
      }
    })
    
  } catch (error) {
    logger.error('Stats fetch error:', error)
    throw createError('Failed to fetch system stats', 500)
  }
}))

export default router
