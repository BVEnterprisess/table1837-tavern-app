import { createClient } from '@supabase/supabase-js'
import { config } from '../config'
import { logger } from '../utils/logger'

// Initialize Supabase client with service role key for admin operations
export const supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Public client for frontend operations
export const supabasePublic = createClient(config.supabase.url, config.supabase.anonKey)

// Database schema interfaces
export interface MenuItem {
  id: string
  name: string
  description?: string
  price?: number
  category: string
  subcategory?: string
  available: boolean
  tags?: string[]
  image_url?: string
  created_at: string
  updated_at: string
}

export interface User {
  id: string
  email: string
  name: string
  role: 'boss' | 'manager' | 'staff'
  active: boolean
  created_at: string
  last_login?: string
}

export interface MenuUpdate {
  id: string
  user_id: string
  menu_type: 'wine_list' | 'featured_menu' | 'signature_cocktails' | 'tavern_menu'
  operation: 'create' | 'update' | 'delete' | 'bulk_update'
  changes: any
  created_at: string
}

// Database utility functions
export class DatabaseService {
  // Menu operations
  static async getMenuItems(category: string, limit = 50, offset = 0) {
    try {
      const { data, error, count } = await supabase
        .from('menu_items')
        .select('*', { count: 'exact' })
        .eq('category', category)
        .eq('available', true)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1)
      
      if (error) throw error
      
      return { items: data || [], total: count || 0 }
    } catch (error) {
      logger.error('Database error getting menu items:', error)
      throw error
    }
  }
  
  static async searchMenuItems(category: string, query: string, limit = 20) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('category', category)
        .eq('available', true)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .order('name', { ascending: true })
        .limit(limit)
      
      if (error) throw error
      
      return data || []
    } catch (error) {
      logger.error('Database error searching menu items:', error)
      throw error
    }
  }
  
  static async upsertMenuItem(item: Partial<MenuItem>) {
    try {
      const { data, error } = await supabase
        .from('menu_items')
        .upsert(item, { onConflict: 'id' })
        .select()
        .single()
      
      if (error) throw error
      
      return data
    } catch (error) {
      logger.error('Database error upserting menu item:', error)
      throw error
    }
  }
  
  static async bulkUpsertMenuItems(items: Partial<MenuItem>[], userId: string, menuType: string) {
    try {
      // Start transaction
      const { data, error } = await supabase
        .from('menu_items')
        .upsert(items, { onConflict: 'id' })
        .select()
      
      if (error) throw error
      
      // Log the update
      await this.logMenuUpdate({
        user_id: userId,
        menu_type: menuType as any,
        operation: 'bulk_update',
        changes: { items_count: items.length, items: items.map(i => i.id) }
      })
      
      return data
    } catch (error) {
      logger.error('Database error bulk upserting menu items:', error)
      throw error
    }
  }
  
  // User operations
  static async getUserById(id: string) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()
      
      if (error) throw error
      
      return data
    } catch (error) {
      logger.error('Database error getting user:', error)
      throw error
    }
  }
  
  // Audit logging
  static async logMenuUpdate(update: Omit<MenuUpdate, 'id' | 'created_at'>) {
    try {
      const { error } = await supabase
        .from('menu_updates')
        .insert({
          ...update,
          created_at: new Date().toISOString()
        })
      
      if (error) throw error
      
    } catch (error) {
      logger.error('Database error logging menu update:', error)
      // Don't throw - logging failure shouldn't break the main operation
    }
  }
}
