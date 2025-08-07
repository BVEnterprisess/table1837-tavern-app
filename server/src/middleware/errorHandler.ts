import { Request, Response, NextFunction } from 'express'
import { logger, alertWebhook } from '../utils/logger'

export interface AppError extends Error {
  statusCode?: number
  isOperational?: boolean
}

export const errorHandler = async (err: AppError, req: Request, res: Response, next: NextFunction) => {
  const statusCode = err.statusCode || 500
  const message = err.message || 'Internal Server Error'
  
  // Log error with context
  logger.error('Request error', {
    error: {
      message: err.message,
      stack: err.stack,
      statusCode,
    },
    request: {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    },
    timestamp: new Date().toISOString(),
  })
  
  // Send critical alerts for 5xx errors
  if (statusCode >= 500) {
    await alertWebhook(
      `Server error ${statusCode}: ${message} on ${req.method} ${req.path}`,
      'critical'
    )
  }
  
  // Don't leak error details in production
  const response = {
    error: message,
    ...(process.env.NODE_ENV !== 'production' && {
      stack: err.stack,
      details: err,
    }),
  }
  
  res.status(statusCode).json(response)
}

// Create operational errors
export const createError = (message: string, statusCode: number = 500): AppError => {
  const error = new Error(message) as AppError
  error.statusCode = statusCode
  error.isOperational = true
  return error
}

// Async error wrapper
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
