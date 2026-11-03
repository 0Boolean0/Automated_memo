import { useState, useEffect } from 'react'
import {
  Barcode, Hash, Tag, Plus, Pencil, Trash2, Check, X,
  Loader2, Camera, AlertCircle, Sparkles, CheckCircle2,
  Package, Search, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import LabelScanModal from './LabelScanModal'
import { productService, type Product, type ProductVariant, type SerialNumberItem } from '@/services/productService'

interface Props {
  isOpen: boolean
  onClose: () => void
  product: Product
  initialVariantId?: number
  onSaved?: () => void
}

export default function SerialManagerModal({
  isOpen,
  onClose,
  product,
  initialVariantId,
  onSaved,
}: Props) {
  const variants = product.variants || []
  const [selectedVariantId, setSelectedVariantId] = useState<number>(
    initialVariantId || variants[0]?.id || 0
  )

  const selectedVariant = variants.find(v => v.id === selectedVariantId) || variants[0]

  // Segment 1 (Barcode & SKU) state
  const [barcode, setBarcode] = useState('')
  const [sku, setSku] = useState('')
  const [isEditingIdentifiers, setIsEditingIdentifiers] = useState(false)
  const [savingIdentifiers, setSavingIdentifiers] = useState(false)

  // Segment 2 (Serial Numbers) state
  const [serials, setSerials] = useState<SerialNumberItem[]>([])
  const [loadingSerials, setLoadingSerials] = useState(false)
  const [newSerialInput, setNewSerialInput] = useState('')
  const [addingSerial, setAddingSerial] = useState(false)

  // Inline editing of a specific serial number
  const [editingSerialId, setEditingSerialId] = useState<number | null>(null)
  const [editingSerialText, setEditingSerialText] = useState('')
  const [savingEditSerial, setSavingEditSerial] = useState(false)

  // Filter serials
  const [searchFilter, setSearchFilter] = useState('')

  // Label scan modal
  const [showScanModal, setShowScanModal] = useState(false)

  // Update selection and load data
  useEffect(() => {
    if (initialVariantId) {
      setSelectedVariantId(initialVariantId)
    } else if (variants[0]?.id) {
      setSelectedVariantId(variants[0].id)
    }
  }, [initialVariantId, product])

  useEffect(() => {
    if (selectedVariant) {
      setBarcode(selectedVariant.barcode || '')
      setSku(selectedVariant.sku || '')
      setIsEditingIdentifiers(false)
    }
  }, [selectedVariantId, selectedVariant])

  const fetchSerials = async () => {
    if (!selectedVariantId) return
    setLoadingSerials(true)
    try {
      const data = await productService.getVariantSerials(selectedVariantId)
      setSerials(data)
    } catch {
      toast.error('Failed to load serial numbers')
    } finally {
      setLoadingSerials(false)
    }
  }

  useEffect(() => {
    if (isOpen && selectedVariantId) {
      fetchSerials()
    }
  }, [isOpen, selectedVariantId])

  // Save Segment 1 (Barcode & SKU)
  const handleSaveIdentifiers = async () => {
    if (!selectedVariant) return
    setSavingIdentifiers(true)
    try {
      await productService.updateVariant(selectedVariant.id, {
        barcode: barcode.trim() || undefined,
        sku: sku.trim() || undefined,
      })
      toast.success('Barcode & SKU updated successfully!')
      setIsEditingIdentifiers(false)
      onSaved?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update Barcode/SKU')
    } finally {
      setSavingIdentifiers(false)
    }
  }

  // Add new Serial Number(s) to Segment 2
  const handleAddSerials = async (explicitSerials?: string[]) => {
    if (!selectedVariant) return
    const raw = explicitSerials || newSerialInput.split(/[\n,]+/).map(s => s.trim()).filter(Boolean)
    if (raw.length === 0) return

    setAddingSerial(true)
    try {
      await productService.addSerialsToVariant(selectedVariant.id, raw)
      toast.success(`Added ${raw.length} serial number(s)! Stock updated.`)
      setNewSerialInput('')
      await fetchSerials()
      onSaved?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to add serial numbers')
    } finally {
      setAddingSerial(false)
    }
  }

  // Update a single Serial Number string
  const handleSaveEditSerial = async (serialId: number) => {
    const trimmed = editingSerialText.trim()
    if (!trimmed) {
      toast.error('Serial number cannot be empty')
      return
    }

    setSavingEditSerial(true)
    try {
      await productService.updateSerialNumber(serialId, { serial: trimmed })
      toast.success('Serial number updated!')
      setEditingSerialId(null)
      await fetchSerials()
      onSaved?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to update serial number')
    } finally {
      setSavingEditSerial(false)
    }
  }

  // Delete an unsold Serial Number
  const handleDeleteSerial = async (serial: SerialNumberItem) => {
    if (!window.confirm(`Delete serial number "${serial.serial}"? This will decrease stock by 1.`)) {
      return
    }
    try {
      await productService.deleteSerialNumber(serial.id)
      toast.success(`Serial "${serial.serial}" deleted.`)
      await fetchSerials()
      onSaved?.()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to delete serial number')
    }
  }

  // Handle scanned codes from LabelScanModal
  const handleApplyScannedCodes = async (codes: { barcode?: string; sku?: string; serials?: string[] }) => {
    if (codes.barcode !== undefined) setBarcode(codes.barcode)
    if (codes.sku !== undefined) setSku(codes.sku)
    if (codes.barcode !== undefined || codes.sku !== undefined) {
      setIsEditingIdentifiers(true)
    }
    if (codes.serials && codes.serials.length > 0) {
      await handleAddSerials(codes.serials)
    }
  }

  const filteredSerials = serials.filter(s =>
    s.serial.toLowerCase().includes(searchFilter.toLowerCase()) ||
    s.status.toLowerCase().includes(searchFilter.toLowerCase())
  )

  const inStockCount = serials.filter(s => s.status === 'IN_STOCK').length

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`Serialized Management — ${product.name}`}
        maxWidth="lg"
      >
        <div className="space-y-6">

          {/* Variant Selector (if multiple) */}
          {variants.length > 1 && (
            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100 overflow-x-auto">
              <span className="text-xs font-semibold text-gray-500 px-2 uppercase tracking-wider">Variant:</span>
              <div className="flex gap-1.5 flex-1">
                {variants.map(v => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariantId(v.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      v.id === selectedVariantId
                        ? 'bg-primary-600 text-white shadow-xs font-semibold'
                        : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                    }`}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              SEGMENT 1: PRODUCT BARCODE & SKU (Shared Product Level)
              ════════════════════════════════════════════════════════════════════ */}
          <div className="border border-blue-100 rounded-xl bg-gradient-to-br from-blue-50/50 to-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between border-b border-blue-100/70 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">
                  1
                </span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    Segment 1: Product Barcode & SKU
                    <span className="text-[11px] font-normal text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full">
                      Editable Model Identifiers
                    </span>
                  </h4>
                  <p className="text-xs text-gray-500">
                    Shared barcode & SKU printed on all boxes of this variant (e.g., EAN-13 code)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {!isEditingIdentifiers ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingIdentifiers(true)}
                    className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Pencil size={12} /> Edit Barcode / SKU
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setBarcode(selectedVariant?.barcode || '')
                        setSku(selectedVariant?.sku || '')
                        setIsEditingIdentifiers(false)
                      }}
                      className="p-1 rounded text-gray-400 hover:text-gray-600"
                      title="Cancel"
                    >
                      <X size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveIdentifiers}
                      disabled={savingIdentifiers}
                      className="btn-primary text-xs py-1 px-3 flex items-center gap-1"
                    >
                      {savingIdentifiers ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Save
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Segment 1 Fields */}
            {isEditingIdentifiers ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1">
                    <Barcode size={13} className="text-blue-600" /> Barcode (EAN / UPC)
                  </label>
                  <input
                    type="text"
                    className="input text-xs font-mono py-1.5"
                    placeholder="e.g. 6950589916671"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700 flex items-center gap-1 mb-1">
                    <Tag size={13} className="text-blue-600" /> SKU Code
                  </label>
                  <input
                    type="text"
                    className="input text-xs font-mono py-1.5"
                    placeholder="e.g. EK75ProBF"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                <div className="bg-white p-2.5 rounded-lg border border-gray-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-blue-50 text-blue-600">
                      <Barcode size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">Barcode</p>
                      <p className="text-xs font-mono font-medium text-gray-900">
                        {barcode || <span className="text-gray-400 italic">None set</span>}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-2.5 rounded-lg border border-gray-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-md bg-indigo-50 text-indigo-600">
                      <Tag size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold">SKU</p>
                      <p className="text-xs font-mono font-medium text-gray-900">
                        {sku || <span className="text-gray-400 italic">None set</span>}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ════════════════════════════════════════════════════════════════════
              SEGMENT 2: SERIAL NUMBERS (Unique Unit S/N Level)
              ════════════════════════════════════════════════════════════════════ */}
          <div className="border border-purple-100 rounded-xl bg-gradient-to-br from-purple-50/40 to-white p-4 shadow-2xs space-y-3.5">
            <div className="flex items-center justify-between border-b border-purple-100/70 pb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold">
                  2
                </span>
                <div>
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    Segment 2: Serial Numbers (S/N)
                    <span className="text-[11px] font-normal text-purple-700 bg-purple-100/80 px-2 py-0.5 rounded-full">
                      Individual Box / Unit Codes
                    </span>
                  </h4>
                  <p className="text-xs text-gray-500">
                    Each unit has a unique serial number (e.g. S/N: EK75ProBF240300436). You can edit any serial later.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowScanModal(true)}
                  className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50"
                  title="Scan label image or photo to auto-extract Barcode, SKU and Serials"
                >
                  <Camera size={13} />
                  <span>Scan Label Picture</span>
                </button>
              </div>
            </div>

            {/* Add Serial Numbers Input */}
            <div className="p-3 bg-white rounded-lg border border-purple-100 space-y-2">
              <label className="text-xs font-semibold text-gray-800 flex items-center justify-between">
                <span>+ Add Serial Number to Stock:</span>
                <span className="text-[11px] font-normal text-gray-400">
                  Separate multiple serials by comma or new line
                </span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. EK75ProBF240300436 (type or paste & press Add)"
                  className="input text-xs py-1.5 flex-1 font-mono"
                  value={newSerialInput}
                  onChange={(e) => setNewSerialInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddSerials()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => handleAddSerials()}
                  disabled={addingSerial || !newSerialInput.trim()}
                  className="btn-primary text-xs py-1.5 px-3 font-medium flex items-center gap-1"
                >
                  {addingSerial ? <Loader2 size={12} className="animate-spin" /> : <Plus size={13} />}
                  Add Serial
                </button>
              </div>
            </div>

            {/* Serials Table / List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-700">Tracked Units:</span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {inStockCount} In Stock
                  </span>
                  {serials.length > inStockCount && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                      {serials.length - inStockCount} Sold / Inactive
                    </span>
                  )}
                </div>

                <div className="relative w-48">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    className="input text-xs pl-7 py-1"
                    placeholder="Search serials…"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                  />
                </div>
              </div>

              {loadingSerials ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={22} className="animate-spin text-purple-600" />
                </div>
              ) : serials.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-lg border border-dashed border-gray-200">
                  <Hash size={24} className="text-gray-300 mx-auto mb-1.5" />
                  <p className="text-xs text-gray-500 font-medium">No serial numbers recorded for this variant yet.</p>
                  <p className="text-[11px] text-gray-400">Add a serial above or snap a photo of the box label.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-500">
                        <th className="text-left px-3 py-2 font-medium">Serial Number (S/N)</th>
                        <th className="text-left px-3 py-2 font-medium">Status</th>
                        <th className="text-right px-3 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredSerials.map((s) => {
                        const isEditingThis = editingSerialId === s.id
                        return (
                          <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-3 py-2">
                              {isEditingThis ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    className="input text-xs font-mono py-1 px-2 w-full max-w-xs"
                                    value={editingSerialText}
                                    onChange={(e) => setEditingSerialText(e.target.value)}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveEditSerial(s.id)
                                      if (e.key === 'Escape') setEditingSerialId(null)
                                    }}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditSerial(s.id)}
                                    disabled={savingEditSerial}
                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                                    title="Save changes"
                                  >
                                    {savingEditSerial ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingSerialId(null)}
                                    className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                                    title="Cancel"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold text-gray-900">{s.serial}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingSerialId(s.id)
                                      setEditingSerialText(s.serial)
                                    }}
                                    className="text-gray-400 hover:text-blue-600 transition-colors p-0.5 rounded"
                                    title="Edit this serial number"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                s.status === 'IN_STOCK' ? 'bg-emerald-50 text-emerald-700' :
                                s.status === 'SOLD' ? 'bg-blue-50 text-blue-700' :
                                s.status === 'RETURNED' ? 'bg-amber-50 text-amber-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {s.status}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {s.status === 'IN_STOCK' && !isEditingThis && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteSerial(s)}
                                    className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete serial number & decrement stock"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button type="button" className="btn-primary text-xs py-2 px-5" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </Modal>

      {/* Label Scan Modal for Box/Label photo extraction */}
      <LabelScanModal
        isOpen={showScanModal}
        onClose={() => setShowScanModal(false)}
        variantIndex={0}
        variantName={selectedVariant?.name}
        onApplyCodes={handleApplyScannedCodes}
      />
    </>
  )
}
