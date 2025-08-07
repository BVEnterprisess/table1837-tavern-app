import winston from 'winston'

const { combine, timestamp, json, colorize, printf } = winston.format

// Custom format for console output
const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  return `${timestamp} [${level}]: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`
})

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: combine(
    timestamp(),
    json()
  ),
  defaultMeta: { service: 'table1837-api' },
  transports: [
    // Write all logs to combined.log
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
})

// Add console transport for non-production
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: combine(
      colorize(),
      timestamp({ format: 'HH:mm:ss' }),
      consoleFormat
    )
  }))
}

// Alert webhook for critical errors
export const alertWebhook = async (message: string, severity: 'info' | 'warn' | 'critical' = 'info') => {
  try {
    if (process.env.ALERT_WEBHOOK_URL) {
      const response = await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Table1837 Alert: ${message}`,
          severity,
          timestamp: new Date().toISOString(),
          service: 'table1837-api'
        })
      })
      
      if (!response.ok) {
        logger.error('Failed to send alert webhook', { status: response.status })
      }
    }
  } catch (error) {
    logger.error('Error sending alert webhook:', error)
  }
}
