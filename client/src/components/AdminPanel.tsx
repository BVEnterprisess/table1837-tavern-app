import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Upload, Database, Settings, BarChart3, FileImage, AlertCircle, CheckCircle } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { ocrApi } from '../services/api'
import LoadingSpinner from './ui/LoadingSpinner'

const AdminPanel: React.FC = () => {
  const { user } = useAuthStore()
  const [selectedMenuType, setSelectedMenuType] = useState('wine_list')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const menuTypes = [
    { value: 'wine_list', label: 'Wine List', icon: '🍷' },
    { value: 'featured_menu', label: 'Featured Menu', icon: '⭐' },
    { value: 'signature_cocktails', label: 'Signature Cocktails', icon: '🍸' },
    { value: 'tavern_menu', label: 'Tavern Menu', icon: '🍽️' }
  ]

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/tiff']
    if (!allowedTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, WebP, or TIFF)')
      return
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB')
      return
    }

    setUploading(true)
    setError(null)
    setUploadResult(null)

    try {
      const result = await ocrApi.processImage(file, selectedMenuType)
      setUploadResult(result)
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const triggerFileSelect = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="text-center"
        >
          <h1 className="text-4xl font-playfair font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent mb-2">
            Admin Control Panel
          </h1>
          <p className="text-gray-400">Welcome back, {user?.name}</p>
          <div className="inline-flex items-center px-3 py-1 bg-amber-500/20 text-amber-300 text-sm rounded-full border border-amber-500/30 mt-2">
            <Settings className="w-4 h-4 mr-2" />
            {user?.role?.toUpperCase()} ACCESS
          </div>
        </motion.div>

        {/* OCR Upload Section */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8"
        >
          <div className="flex items-center space-x-3 mb-6">
            <FileImage className="w-6 h-6 text-amber-400" />
            <h2 className="text-2xl font-semibold text-white">OCR Menu Upload</h2>
          </div>

          {/* Menu Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Select Menu Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {menuTypes.map((type) => (
                <button
                  key={type.value}
                  onClick={() => setSelectedMenuType(type.value)}
                  className={`
                    p-4 rounded-lg border-2 transition-all duration-300 flex flex-col items-center space-y-2
                    ${
                      selectedMenuType === type.value
                        ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                        : 'border-white/20 bg-white/5 text-gray-300 hover:border-white/40'
                    }
                  `}
                >
                  <span className="text-2xl">{type.icon}</span>
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Upload Area */}
          <div className="space-y-4">
            <div
              onClick={triggerFileSelect}
              className="
                relative border-2 border-dashed border-white/30 hover:border-amber-500/50 
                rounded-lg p-12 text-center cursor-pointer transition-all duration-300
                bg-white/5 hover:bg-white/10 group
              "
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/tiff"
                onChange={handleFileUpload}
                className="hidden"
                disabled={uploading}
              />
              
              {uploading ? (
                <div className="flex flex-col items-center space-y-4">
                  <LoadingSpinner size="lg" />
                  <div className="text-amber-400 font-medium">Processing image...</div>
                  <div className="text-gray-400 text-sm">This may take a few moments</div>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-4">
                  <Upload className="w-12 h-12 text-gray-400 group-hover:text-amber-400 transition-colors" />
                  <div className="text-white font-medium">Click to upload menu image</div>
                  <div className="text-gray-400 text-sm">
                    Supports JPEG, PNG, WebP, and TIFF files up to 10MB
                  </div>
                </div>
              )}
            </div>

            {/* Selected Menu Type Display */}
            <div className="bg-black/30 rounded-lg p-4 border border-white/10">
              <div className="text-sm text-gray-400 mb-1">Selected Menu Type:</div>
              <div className="text-amber-400 font-medium">
                {menuTypes.find(t => t.value === selectedMenuType)?.label}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Results Section */}
        {(uploadResult || error) && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-8"
          >
            {error && (
              <div className="flex items-start space-x-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium mb-1">Upload Failed</div>
                  <div className="text-sm">{error}</div>
                </div>
              </div>
            )}

            {uploadResult && uploadResult.success && (
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
                  <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium mb-1">Upload Successful</div>
                    <div className="text-sm">{uploadResult.message}</div>
                  </div>
                </div>

                {uploadResult.data && (
                  <div className="bg-black/30 rounded-lg p-4 border border-white/10">
                    <h3 className="text-white font-medium mb-3">Processing Results</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-gray-400">Items Processed</div>
                        <div className="text-amber-400 font-medium">{uploadResult.data.itemsProcessed}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Items Saved</div>
                        <div className="text-green-400 font-medium">{uploadResult.data.itemsSaved}</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Processing Time</div>
                        <div className="text-blue-400 font-medium">{uploadResult.data.processingTimeMs}ms</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Menu Type</div>
                        <div className="text-white font-medium">{uploadResult.data.menuType}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {uploadResult && !uploadResult.success && (
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg text-yellow-400">
                  <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium mb-1">Processing Issue</div>
                    <div className="text-sm">{uploadResult.message}</div>
                  </div>
                </div>

                {uploadResult.suggestions && (
                  <div className="bg-black/30 rounded-lg p-4 border border-white/10">
                    <h3 className="text-white font-medium mb-3">Suggestions</h3>
                    <ul className="text-sm text-gray-300 space-y-1">
                      {uploadResult.suggestions.map((suggestion: string, index: number) => (
                        <li key={index} className="flex items-start space-x-2">
                          <span className="text-amber-400 mt-1">•</span>
                          <span>{suggestion}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="grid md:grid-cols-3 gap-6"
        >
          <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-6 text-center">
            <Database className="w-8 h-8 text-blue-400 mx-auto mb-3" />
            <h3 className="text-white font-medium mb-2">Database Status</h3>
            <div className="text-green-400 text-sm">✓ Connected</div>
          </div>

          <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-6 text-center">
            <BarChart3 className="w-8 h-8 text-purple-400 mx-auto mb-3" />
            <h3 className="text-white font-medium mb-2">Performance</h3>
            <div className="text-purple-400 text-sm">Optimal</div>
          </div>

          <div className="bg-white/5 backdrop-blur-lg rounded-xl border border-white/10 p-6 text-center">
            <Settings className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-white font-medium mb-2">System Health</h3>
            <div className="text-green-400 text-sm">All Systems Go</div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}

export default AdminPanel
