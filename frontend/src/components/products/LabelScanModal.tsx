import { useState, useRef, useEffect, useCallback } from 'react'
import {
  Camera, Upload, X, Loader2, Sparkles, CheckCircle2,
  AlertCircle, Tag, Hash, ScanLine, Image as ImageIcon,
} from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import toast from 'react-hot-toast'
import { productService, type ExtractedLabelData } from '@/services/productService'

interface Props {
  isOpen: boolean
  onClose: () => void
  variantIndex: number
  variantName?: string
  targetField?: 'barcode' | 'sku' | 'serial' | 'all'
  onApplyCodes: (codes: { barcode?: string; sku?: string; serials?: string[] }) => void
}

export default function LabelScanModal({
  isOpen,
  onClose,
  variantIndex,
  variantName,
  targetField = 'all',
  onApplyCodes,
}: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedLabelData | null>(null)
  const [detectedBarcode, setDetectedBarcode] = useState<string | null>(null)
  const [detectedSku, setDetectedSku] = useState<string | null>(null)
  const [detectedSerials, setDetectedSerials] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)

  const cameraInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset state on open/close
  useEffect(() => {
    if (!isOpen) {
      setFile(null)
      setPreviewUrl(null)
      setLoading(false)
      setExtracted(null)
      setDetectedBarcode(null)
      setDetectedSku(null)
      setDetectedSerials([])
    }
  }, [isOpen])

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const processImage = useCallback(async (selectedFile: File) => {
    setFile(selectedFile)
    const objUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(objUrl)
    setLoading(true)
    setExtracted(null)

    let zxingBarcode: string | null = null

    // 1. Client-side barcode decoding (instant & offline-capable)
    try {
      const reader = new BrowserMultiFormatReader()
      const zxRes = await reader.decodeFromImageUrl(objUrl)
      if (zxRes) {
        zxingBarcode = zxRes.getText().trim()
      }
    } catch {
      // Not a barcode or unreadable by zxing
    }

    // 2. Backend Windows OCR & intelligent label parsing
    try {
      const data = await productService.extractLabelCodes(selectedFile)
      setExtracted(data)

      const finalBarcode = zxingBarcode || data.barcode || null
      const finalSku = data.sku || null
      const finalSerials = data.serials || []

      setDetectedBarcode(finalBarcode)
      setDetectedSku(finalSku)
      setDetectedSerials(finalSerials)

      if (finalBarcode || finalSku || finalSerials.length > 0) {
        toast.success('Codes detected from label image!')
      } else if (data.raw_text) {
        toast('Text detected. Select any snippet below to assign.', { icon: 'ℹ️' })
      } else {
        toast.error('No clear text or barcode detected. Try another photo.')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to scan image')
    } finally {
      setLoading(false)
    }
  }, [])

  // Clipboard paste support (Ctrl+V)
  useEffect(() => {
    if (!isOpen) return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile()
          if (blob) {
            processImage(blob)
            break
          }
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [isOpen, processImage])

  if (!isOpen) return null

  const handleApplyAll = () => {
    const payload: { barcode?: string; sku?: string; serials?: string[] } = {}
    if (detectedBarcode) payload.barcode = detectedBarcode
    if (detectedSku) payload.sku = detectedSku
    if (detectedSerials.length > 0) payload.serials = detectedSerials

    if (Object.keys(payload).length === 0) {
      toast.error('No codes to apply')
      return
    }

    onApplyCodes(payload)
    toast.success('Applied detected codes to variant!')
    onClose()
  }

  const handleApplySingle = (field: 'barcode' | 'sku' | 'serial', val: string) => {
    if (!val) return
    if (field === 'barcode') onApplyCodes({ barcode: val })
    else if (field === 'sku') onApplyCodes({ sku: val })
    else if (field === 'serial') onApplyCodes({ serials: [val] })

    toast.success(`Applied ${field.toUpperCase()} to variant!`)
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center">
              <Camera size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Scan Label Picture
                <span className="text-xs font-normal text-gray-500 ml-2">
                  (Variant {variantIndex + 1}{variantName ? `: ${variantName}` : ''})
                </span>
              </h3>
              <p className="text-xs text-gray-500">
                Capture or upload a photo to auto-detect Barcode, SKU & Serial numbers
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">

          {/* Hidden inputs */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) processImage(f)
              e.target.value = ''
            }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) processImage(f)
              e.target.value = ''
            }}
          />

          {/* Upload / Capture Buttons & Dropzone */}
          {!previewUrl ? (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragActive(false)
                const f = e.dataTransfer.files?.[0]
                if (f) processImage(f)
              }}
              className={`border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                dragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 bg-gray-50/50'
              }`}
            >
              <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center mx-auto mb-3">
                <ImageIcon size={22} />
              </div>
              <p className="text-sm font-semibold text-gray-800 mb-1">
                Upload or Snap Label Picture
              </p>
              <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">
                Take a photo with your device camera or choose an image file (or paste with Ctrl+V)
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="btn-primary text-xs py-2 px-3.5 flex items-center gap-1.5 shadow-sm"
                >
                  <Camera size={14} />
                  Take Photo (Camera)
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5"
                >
                  <Upload size={14} />
                  Choose File
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Image Preview Thumbnail with Re-take */}
              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-900 max-h-48 flex items-center justify-center">
                <img
                  src={previewUrl}
                  alt="Label preview"
                  className="max-h-48 w-auto object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(null)
                    setExtracted(null)
                    setDetectedBarcode(null)
                    setDetectedSku(null)
                    setDetectedSerials([])
                  }}
                  className="absolute top-2 right-2 bg-black/70 hover:bg-black text-white text-xs px-2.5 py-1 rounded-md flex items-center gap-1 backdrop-blur-sm transition-colors"
                >
                  <Camera size={12} />
                  Change Picture
                </button>

                {loading && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
                    <Loader2 size={26} className="animate-spin text-primary-400" />
                    <p className="text-xs font-medium">Extracting Barcode, SKU & Serials...</p>
                  </div>
                )}
              </div>

              {/* Extraction Results */}
              {!loading && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      Detected Information
                    </span>
                    {(detectedBarcode || detectedSku || detectedSerials.length > 0) && (
                      <button
                        type="button"
                        onClick={handleApplyAll}
                        className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded-md flex items-center gap-1.5 shadow-sm transition-colors"
                      >
                        <Sparkles size={12} />
                        Apply All to Variant
                      </button>
                    )}
                  </div>

                  {/* Field Cards */}
                  <div className="space-y-2">
                    
                    {/* Barcode Card */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <ScanLine size={16} className="text-primary-600" />
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500 uppercase">Barcode</p>
                          <p className="text-xs font-mono font-bold text-gray-900">
                            {detectedBarcode || <span className="text-gray-400 font-normal italic">None detected</span>}
                          </p>
                        </div>
                      </div>
                      {detectedBarcode && (
                        <button
                          type="button"
                          onClick={() => handleApplySingle('barcode', detectedBarcode)}
                          className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-primary-700 hover:bg-primary-50"
                        >
                          <CheckCircle2 size={12} /> Use as Barcode
                        </button>
                      )}
                    </div>

                    {/* SKU Card */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-gray-50">
                      <div className="flex items-center gap-2">
                        <Tag size={16} className="text-primary-600" />
                        <div>
                          <p className="text-[11px] font-semibold text-gray-500 uppercase">SKU / Model</p>
                          <p className="text-xs font-mono font-bold text-gray-900">
                            {detectedSku || <span className="text-gray-400 font-normal italic">None detected</span>}
                          </p>
                        </div>
                      </div>
                      {detectedSku && (
                        <button
                          type="button"
                          onClick={() => handleApplySingle('sku', detectedSku)}
                          className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-primary-700 hover:bg-primary-50"
                        >
                          <CheckCircle2 size={12} /> Use as SKU
                        </button>
                      )}
                    </div>

                    {/* Serials Card */}
                    <div className="p-2.5 rounded-lg border border-gray-200 bg-gray-50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Hash size={16} className="text-primary-600" />
                          <div>
                            <p className="text-[11px] font-semibold text-gray-500 uppercase">
                              Serial Number(s)
                            </p>
                            <p className="text-xs text-gray-500">
                              {detectedSerials.length > 0
                                ? `${detectedSerials.length} serial(s) found`
                                : <span className="text-gray-400 italic">None detected</span>
                              }
                            </p>
                          </div>
                        </div>
                        {detectedSerials.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              onApplyCodes({ serials: detectedSerials })
                              toast.success(`Added ${detectedSerials.length} serial(s) to variant!`)
                            }}
                            className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 text-primary-700 hover:bg-primary-50"
                          >
                            <CheckCircle2 size={12} /> Add to Serials
                          </button>
                        )}
                      </div>

                      {detectedSerials.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {detectedSerials.map((sn, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono bg-primary-100 text-primary-800 border border-primary-200"
                            >
                              {sn}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* All detected text chips (clickable fallback) */}
                  {extracted && extracted.all_candidates && extracted.all_candidates.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                      <p className="text-[11px] font-semibold text-gray-600 flex items-center gap-1">
                        <Sparkles size={12} className="text-amber-500" />
                        Other Detected Words / Snippets (tap to assign):
                      </p>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-gray-50 rounded-lg border border-gray-100">
                        {extracted.all_candidates.map((token, idx) => (
                          <div
                            key={idx}
                            className="group relative inline-flex items-center gap-1 px-2 py-1 rounded bg-white border border-gray-200 text-xs font-mono text-gray-700 hover:border-primary-400 hover:bg-primary-50 transition-colors shadow-2xs"
                          >
                            <span>{token}</span>
                            <div className="flex items-center gap-0.5 ml-1 border-l border-gray-200 pl-1">
                              <button
                                type="button"
                                title="Use as Barcode"
                                onClick={() => handleApplySingle('barcode', token)}
                                className="text-[10px] text-gray-400 hover:text-primary-600 font-sans px-0.5"
                              >
                                BC
                              </button>
                              <button
                                type="button"
                                title="Use as SKU"
                                onClick={() => handleApplySingle('sku', token)}
                                className="text-[10px] text-gray-400 hover:text-primary-600 font-sans px-0.5"
                              >
                                SKU
                              </button>
                              <button
                                type="button"
                                title="Add as Serial"
                                onClick={() => handleApplySingle('serial', token)}
                                className="text-[10px] text-gray-400 hover:text-primary-600 font-sans px-0.5"
                              >
                                SN
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Notice message if present */}
                  {extracted?.message && (
                    <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200 flex items-center gap-1.5">
                      <AlertCircle size={14} className="shrink-0" />
                      {extracted.message}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Close
          </button>
          {previewUrl && (
            <button
              type="button"
              onClick={handleApplyAll}
              disabled={loading || (!detectedBarcode && !detectedSku && detectedSerials.length === 0)}
              className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 size={14} />
              Done / Apply
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
