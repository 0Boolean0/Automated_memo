import Modal from './Modal'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export default function ConfirmDialog({
  isOpen, onClose, onConfirm,
  title, message,
  confirmLabel = 'Confirm',
  danger = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${danger ? 'bg-red-100' : 'bg-yellow-100'}`}>
          <AlertTriangle size={20} className={danger ? 'text-red-600' : 'text-yellow-600'} />
        </div>
        <p className="text-sm text-gray-600 pt-2">{message}</p>
      </div>
      <div className="flex gap-3 mt-6 justify-end">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className={danger ? 'btn-danger' : 'btn-primary'}
          onClick={() => { onConfirm(); onClose() }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
