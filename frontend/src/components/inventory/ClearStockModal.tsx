import { useState } from 'react'
import { AlertTriangle, Loader2, Trash2, ShieldAlert } from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import { productService } from '@/services/productService'

interface Props {
  isOpen: boolean
  onClose: () => void
  onCleared: () => void
  productId?: number
  productName?: string
  currentStock?: number
  variantId?: number
  variantName?: string
}

export default function ClearStockModal({
  isOpen,
  onClose,
  onCleared,
  productId,
  productName,
  currentStock = 0,
  variantId,
  variantName,
}: Props) {
  const [reason, setReason] = useState('Manual stock clearance')
  const [submitting, setSubmitting] = useState(false)

  const handleConfirm = async () => {
    setSubmitting(true)
    try {
      if (variantId) {
        const res = await productService.clearVariantStock(variantId, reason)
        toast.success(res.message || 'Stock cleared to 0')
      } else if (productId) {
        const res = await productService.clearProductStock(productId, reason)
        toast.success(res.message || 'Stock cleared to 0')
      }
      onCleared()
      onClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to clear stock')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Clear Product Stock" maxWidth="md">
      <div className="space-y-4">
        {/* Warning Header */}
        <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-800">
          <div className="p-2 rounded-lg bg-red-100 text-red-600 flex-shrink-0 mt-0.5">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-red-900">Are you sure you want to clear stock?</h4>
            <p className="text-xs text-red-700 mt-0.5 leading-relaxed">
              This action will reset the available quantity to <span className="font-bold underline">0 units</span>.
              For serialized items, in-stock serial numbers will be cleared/archived.
            </p>
          </div>
        </div>

        {/* Target Details */}
        <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-500">Target Product:</span>
            <span className="font-semibold text-gray-900">{productName || 'Selected Product'}</span>
          </div>
          {variantName && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Variant:</span>
              <span className="font-medium text-gray-800">{variantName}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 border-t border-gray-200">
            <span className="text-xs text-gray-500">Current Stock:</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
              {currentStock} units in stock
            </span>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="label">Reason for clearing stock *</label>
          <select
            className="input mb-2"
            value={['Manual stock clearance', 'Physical count mismatch (stock 0)', 'Inventory audit reset', 'Damaged / obsolete goods written off'].includes(reason) ? reason : 'Other'}
            onChange={(e) => {
              if (e.target.value !== 'Other') {
                setReason(e.target.value)
              }
            }}
          >
            <option value="Manual stock clearance">Manual stock clearance</option>
            <option value="Physical count mismatch (stock 0)">Physical count mismatch (stock 0)</option>
            <option value="Inventory audit reset">Inventory audit reset</option>
            <option value="Damaged / obsolete goods written off">Damaged / obsolete goods written off</option>
            <option value="Other">Custom reason…</option>
          </select>
          <input
            type="text"
            className="input text-sm"
            placeholder="Specify reason..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2.5 justify-end pt-3 border-t border-gray-100">
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger text-sm flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors shadow-sm"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Clearing Stock…
              </>
            ) : (
              <>
                <Trash2 size={15} />
                Clear Stock to 0
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  )
}
