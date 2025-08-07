import { Router } from 'express'
import multer from 'multer'
import sharp from 'sharp'
import { DatabaseService } from '../services/database'
import { asyncHandler, createError } from '../middleware/errorHandler'
import { AuthRequest } from '../middleware/auth'
import { logger, alertWebhook } from '../utils/logger'
import { config } from '../config'

const router = Router()

// Configure multer for image uploads
const upload = multer({
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and TIFF are allowed.'))
    }
  }
})

// Menu type mapping for database operations
const MENU_TYPE_MAPPING = {
  'wine_list': 'wine_list',
  'featured_menu': 'featured_menu', 
  'signature_cocktails': 'signature_cocktails',
  'tavern_menu': 'tavern_menu'
} as const

type MenuType = keyof typeof MENU_TYPE_MAPPING

// OCR processing with FluxImagen integration
router.post('/process', upload.single('image'), asyncHandler(async (req: AuthRequest, res) => {
  const startTime = Date.now()
  
  if (!req.file) {
    throw createError('No image file provided', 400)
  }
  
  const { menuType } = req.body
  
  if (!menuType || !MENU_TYPE_MAPPING[menuType as MenuType]) {
    throw createError('Invalid or missing menu type', 400)
  }
  
  const user = req.user!
  
  logger.info('OCR processing started', {
    userId: user.id,
    menuType,
    fileName: req.file.originalname,
    fileSize: req.file.size
  })
  
  try {
    // Optimize image for OCR
    const optimizedImage = await sharp(req.file.buffer)
      .resize(2000, null, { withoutEnlargement: true })
      .normalize()
      .sharpen()
      .jpeg({ quality: 95 })
      .toBuffer()
    
    // Convert to base64 for FluxImagen API
    const imageBase64 = optimizedImage.toString('base64')
    
    // Call FluxImagen OCR API
    const ocrResponse = await fetch(config.ocr.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.ocr.fluxImagenApiKey}`
      },
      body: JSON.stringify({
        image: imageBase64,
        language: 'en',
        output_format: 'structured',
        menu_context: true,
        extract_prices: true,
        extract_descriptions: true
      })
    })
    
    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text()
      logger.error('FluxImagen OCR failed', {
        status: ocrResponse.status,
        error: errorText,
        userId: user.id
      })
      
      await alertWebhook(
        `OCR processing failed for ${menuType} by ${user.name}. Status: ${ocrResponse.status}`,
        'critical'
      )
      
      throw createError('OCR processing failed', 500)
    }
    
    const ocrData = await ocrResponse.json()
    
    // Parse and structure the OCR results
    const parsedItems = parseOCRResults(ocrData, menuType as MenuType)
    
    if (parsedItems.length === 0) {
      logger.warn('No menu items extracted from OCR', {
        userId: user.id,
        menuType,
        ocrDataLength: JSON.stringify(ocrData).length
      })
      
      return res.json({
        success: false,
        message: 'No menu items could be extracted from the image',
        extractedText: ocrData.text || '',
        suggestions: [
          'Ensure the image is clear and well-lit',
          'Make sure text is not obscured or rotated',
          'Try a higher resolution image'
        ]
      })
    }
    
    // Bulk insert/update menu items
    const savedItems = await DatabaseService.bulkUpsertMenuItems(
      parsedItems,
      user.id,
      menuType
    )
    
    const processingTime = Date.now() - startTime
    
    logger.info('OCR processing completed successfully', {
      userId: user.id,
      menuType,
      itemsExtracted: parsedItems.length,
      itemsSaved: savedItems.length,
      processingTimeMs: processingTime
    })
    
    // Trigger deployment webhook if configured
    if (process.env.DEPLOY_WEBHOOK_URL) {
      try {
        await fetch(process.env.DEPLOY_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: 'menu_update',
            menu_type: menuType,
            items_count: savedItems.length,
            user: user.name
          })
        })
      } catch (deployError) {
        logger.warn('Deploy webhook failed (non-critical):', deployError)
      }
    }
    
    res.json({
      success: true,
      data: {
        menuType,
        itemsProcessed: parsedItems.length,
        itemsSaved: savedItems.length,
        processingTimeMs: processingTime,
        items: savedItems.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.category
        }))
      },
      message: `Successfully processed ${savedItems.length} menu items`
    })
    
  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('OCR processing error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: user.id,
      menuType,
      processingTimeMs: processingTime
    })
    
    await alertWebhook(
      `OCR processing error for ${menuType} by ${user.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'critical'
    )
    
    throw error
  }
}))

// Parse OCR results into structured menu items
function parseOCRResults(ocrData: any, menuType: MenuType): Partial<any>[] {
  const items: Partial<any>[] = []
  
  try {
    // Handle different OCR response formats
    const extractedText = ocrData.text || ocrData.extracted_text || ''
    const structuredData = ocrData.structured_data || ocrData.items || []
    
    // If we have structured data, use it
    if (Array.isArray(structuredData) && structuredData.length > 0) {
      structuredData.forEach((item: any, index: number) => {
        const menuItem = {
          id: `${menuType}_ocr_${Date.now()}_${index}`,
          name: item.name || item.title || `Item ${index + 1}`,
          description: item.description || item.desc || null,
          price: parsePrice(item.price),
          category: menuType,
          subcategory: item.category || null,
          available: true,
          tags: determineTags(item, menuType),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        items.push(menuItem)
      })
    } else {
      // Fallback: parse text manually
      const parsedItems = parseTextMenu(extractedText, menuType)
      items.push(...parsedItems)
    }
    
  } catch (error) {
    logger.error('Error parsing OCR results:', error)
  }
  
  return items.filter(item => item.name && item.name.length > 2)
}

// Manual text parsing fallback
function parseTextMenu(text: string, menuType: MenuType): Partial<any>[] {
  const items: Partial<any>[] = []
  const lines = text.split('\n').filter(line => line.trim().length > 0)
  
  let currentItem: Partial<any> | null = null
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim()
    
    // Price pattern matching
    const priceMatch = trimmedLine.match(/\$([0-9]+(?:\.[0-9]{2})?)/)
    
    // If line contains a price, it's likely a new item
    if (priceMatch && trimmedLine.length > 5) {
      // Save previous item if exists
      if (currentItem && currentItem.name) {
        items.push(currentItem)
      }
      
      // Start new item
      const nameWithoutPrice = trimmedLine.replace(/\$[0-9]+(?:\.[0-9]{2})?.*$/, '').trim()
      
      currentItem = {
        id: `${menuType}_manual_${Date.now()}_${index}`,
        name: nameWithoutPrice,
        description: null,
        price: parseFloat(priceMatch[1]),
        category: menuType,
        available: true,
        tags: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    } else if (currentItem && trimmedLine.length > 10 && !priceMatch) {
      // This might be a description
      currentItem.description = (currentItem.description ? currentItem.description + ' ' : '') + trimmedLine
    }
  })
  
  // Don't forget the last item
  if (currentItem && currentItem.name) {
    items.push(currentItem)
  }
  
  return items
}

// Parse price from various formats
function parsePrice(priceStr: any): number | null {
  if (typeof priceStr === 'number') return priceStr
  if (!priceStr) return null
  
  const cleaned = priceStr.toString().replace(/[^0-9.]/g, '')
  const parsed = parseFloat(cleaned)
  
  return isNaN(parsed) ? null : parsed
}

// Determine appropriate tags based on content and menu type
function determineTags(item: any, menuType: MenuType): string[] {
  const tags: string[] = []
  
  const itemText = (item.name + ' ' + (item.description || '')).toLowerCase()
  
  // Menu type specific tags
  if (menuType === 'signature_cocktails') {
    tags.push('signature')
    if (itemText.includes('premium') || itemText.includes('top shelf')) {
      tags.push('premium')
    }
  }
  
  if (menuType === 'wine_list') {
    if (itemText.includes('reserve') || itemText.includes('vintage')) {
      tags.push('reserve')
    }
    if (itemText.includes('red')) tags.push('red')
    if (itemText.includes('white')) tags.push('white')
    if (itemText.includes('sparkling') || itemText.includes('champagne')) tags.push('sparkling')
  }
  
  // General tags
  if (itemText.includes('featured') || itemText.includes('special')) {
    tags.push('featured')
  }
  
  if (itemText.includes('new') || itemText.includes('limited')) {
    tags.push('limited')
  }
  
  return tags
}

// Get OCR processing status
router.get('/status', asyncHandler(async (req: AuthRequest, res) => {
  res.json({
    success: true,
    status: 'operational',
    capabilities: {
      supported_formats: ['JPEG', 'PNG', 'WebP', 'TIFF'],
      max_file_size: '10MB',
      supported_menu_types: Object.keys(MENU_TYPE_MAPPING),
      features: [
        'price_extraction',
        'description_parsing', 
        'automatic_categorization',
        'batch_processing'
      ]
    },
    user: {
      name: req.user?.name,
      role: req.user?.role
    }
  })
}))

export default router
