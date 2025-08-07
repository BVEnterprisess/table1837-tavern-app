import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { supabase } from '../services/database'
import { logger } from '../utils/logger'
import { config } from '../config'

export interface AuthUser {
  id: string
  email: string
  role: 'boss' | 'manager' | 'staff'
  name: string
}

export interface AuthRequest extends Request {
  user?: AuthUser
}

export const authMiddleware = (allowedRoles: string[] = []) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authorization token required' })
      }

      const token = authHeader.substring(7)
      
      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret) as any
      
      // Get user from database with role
      const { data: user, error } = await supabase
        .from('users')
        .select('id, email, role, name, active')
        .eq('id', decoded.sub)
        .single()
      
      if (error || !user) {
        logger.warn('Invalid token - user not found', { userId: decoded.sub })
        return res.status(401).json({ error: 'Invalid token' })
      }
      
      if (!user.active) {
        logger.warn('Inactive user attempted access', { userId: user.id, email: user.email })
        return res.status(401).json({ error: 'Account deactivated' })
      }
      
      // Check role permissions
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        logger.warn('Insufficient permissions', { 
          userId: user.id, 
          role: user.role, 
          required: allowedRoles,
          path: req.path 
        })
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      
      req.user = user
      next()
      
    } catch (error) {
      logger.error('Auth middleware error:', error)
      
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Token expired' })
      }
      
      if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: 'Invalid token' })
      }
      
      return res.status(500).json({ error: 'Authentication error' })
    }
  }
}

// Optional auth - doesn't fail if no token provided
export const optionalAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authMiddleware([])(req, res, next)
  }
  
  next()
}
