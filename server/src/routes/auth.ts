import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { supabasePublic } from '../services/database'
import { asyncHandler, createError } from '../middleware/errorHandler'
import { logger } from '../utils/logger'
import { config } from '../config'

const router = Router()

// Login with email/password
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body
  
  if (!email || !password) {
    throw createError('Email and password are required', 400)
  }
  
  try {
    // Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabasePublic.auth.signInWithPassword({
      email,
      password,
    })
    
    if (authError || !authData.user) {
      logger.warn('Failed login attempt', { email, error: authError?.message })
      throw createError('Invalid credentials', 401)
    }
    
    // Get user role and profile from our users table
    const { data: userData, error: userError } = await supabasePublic
      .from('users')
      .select('id, email, name, role, active')
      .eq('id', authData.user.id)
      .single()
    
    if (userError || !userData) {
      logger.error('User profile not found after auth', { userId: authData.user.id, error: userError })
      throw createError('User profile not found', 404)
    }
    
    if (!userData.active) {
      logger.warn('Inactive user login attempt', { email, userId: userData.id })
      throw createError('Account is deactivated', 401)
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        sub: userData.id,
        email: userData.email,
        role: userData.role
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    )
    
    // Update last login
    await supabasePublic
      .from('users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', userData.id)
    
    logger.info('Successful login', {
      userId: userData.id,
      email: userData.email,
      role: userData.role
    })
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role
        }
      },
      message: 'Login successful'
    })
    
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid credentials')) {
      throw error
    }
    
    logger.error('Login error:', error)
    throw createError('Login failed', 500)
  }
}))

// Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body
  
  if (!refreshToken) {
    throw createError('Refresh token is required', 400)
  }
  
  try {
    const { data, error } = await supabasePublic.auth.refreshSession({ refresh_token: refreshToken })
    
    if (error || !data.user) {
      throw createError('Invalid refresh token', 401)
    }
    
    // Get updated user data
    const { data: userData, error: userError } = await supabasePublic
      .from('users')
      .select('id, email, name, role, active')
      .eq('id', data.user.id)
      .single()
    
    if (userError || !userData || !userData.active) {
      throw createError('User not found or deactivated', 401)
    }
    
    // Generate new JWT
    const token = jwt.sign(
      { 
        sub: userData.id,
        email: userData.email,
        role: userData.role
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    )
    
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role
        }
      }
    })
    
  } catch (error) {
    logger.error('Token refresh error:', error)
    throw createError('Token refresh failed', 500)
  }
}))

// Logout
router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body
  
  if (refreshToken) {
    try {
      await supabasePublic.auth.signOut()
    } catch (error) {
      // Non-critical error
      logger.warn('Logout cleanup error:', error)
    }
  }
  
  res.json({
    success: true,
    message: 'Logged out successfully'
  })
}))

// Get current user profile
router.get('/me', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw createError('Authorization token required', 401)
  }
  
  const token = authHeader.substring(7)
  
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as any
    
    const { data: userData, error } = await supabasePublic
      .from('users')
      .select('id, email, name, role, active, created_at, last_login')
      .eq('id', decoded.sub)
      .single()
    
    if (error || !userData || !userData.active) {
      throw createError('User not found', 404)
    }
    
    res.json({
      success: true,
      data: userData
    })
    
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw createError('Token expired', 401)
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError('Invalid token', 401)
    }
    
    throw error
  }
}))

export default router
