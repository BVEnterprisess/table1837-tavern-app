import dotenv from 'dotenv'
dotenv.config()

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  supabase: {
    url: process.env.SUPABASE_URL!,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    anonKey: process.env.SUPABASE_ANON_KEY!,
  },
  
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  ocr: {
    fluxImagenApiKey: process.env.FLUX_IMAGEN_API_KEY!,
    endpoint: process.env.FLUX_IMAGEN_ENDPOINT || 'https://api.flux-imagen.com/v1/ocr',
  },
  
  redis: {
    url: process.env.REDIS_URL,
  },
  
  webhooks: {
    alertUrl: process.env.ALERT_WEBHOOK_URL!,
  },
  
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // requests per window
  }
}

// Validate required environment variables
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET',
  'FLUX_IMAGEN_API_KEY',
  'ALERT_WEBHOOK_URL'
]

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`)
  }
}
