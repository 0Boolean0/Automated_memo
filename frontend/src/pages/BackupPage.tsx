/**
 * Backup & Restore page — Phase 13.
 *
 * Features:
 * - Create backup: copies the live SQLite DB to backups/ with a timestamp name
 * - List backups: shows all saved backups with size and date
 * - Download: download any backup file to your computer
 * - Delete: remove old backup files
 * - Restore: upload a .db backup file to replace the live database
 *   (shows a prominent warning, requires typing confirmation text)
 */

import { useEffect, useState, useRef } from 'react'
import {
  Database, Download, Trash2, Upload, Loader2,
  AlertTriangle, CheckCircle, RefreshCw, ShieldAlert,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import backupService, { type BackupFile } from '@/services/backupService'
import { useAuthStore } from '@/services/authStore'
import { formatDate } from '@/utils/format'

// ─── Restore Confirmation Modal ───────────────────────────────────────────────

function RestoreModal({
  file,
  onClose,
  onRestored,
}: {
  file: File | null
  onClose: () => void
  onRestored: () => void
}) {
  const [confirm, setConfirm] = useState('')
  const [restoring, setRestoring] = useState(false)
  const CONFIRM_TEXT = 'RESTORE'

  const handleRestore = async () => {
    if (!file || confirm !== CONFIRM_TEXT) return
    setRestoring(true)
    try {
      const res = await backupService.restore(file)
      toast.success(res.message)
      setConfirm('')
      onClose()
      onRestored()
    } catch { /* interceptor */ }
    finally { setRestoring(false) }
  }

  useEffect(() => { if (!file) setConfirm('') }, [file])

  return (
    <Modal isOpen={!!file} onClose={onClose} title="Restore Database" maxWidth="sm">
      <div className="space-y-4">
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <ShieldAlert size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-900">This will replace ALL live data</p>
            <p className="text-sm text-red-700 mt-1">
              Every sale, product, customer, and inventory record will be replaced
              with the contents of <span className="font-mono font-bold">{file?.name}</span>.
              This action cannot be undone.
            </p>
            <p className="text-sm text-red-700 mt-1 font-semibold">
              Make sure you have a current backup before proceeding.
            </p>
          </div>
        </div>

        {/* File info */}
        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p><span className="font-medium">File:</span> {file?.name}</p>
          <p><span className="font-medium">Size:</span> {file ? (file.size / 1024).toFixed(1) + ' KB' : '—'}</p>
        </div>

        {/* Confirmation input */}
        <div>
          <label className="label">
            Type <span className="font-mono font-bold text-red-600">{CONFIRM_TEXT}</span> to confirm
          </label>
          <input
            className="input"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            placeholder={CONFIRM_TEXT}
            autoComplete="off"
          />
        </div>

        <div className="flex gap-3 justify-end pt-1 border-t border-gray-100">
          <button className="btn-secondary" onClick={onClose} disabled={restoring}>
            Cancel
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium disabled:opacity-40 transition-colors"
            disabled={confirm !== CONFIRM_TEXT || restoring}
            onClick={handleRestore}
          >
            {restoring ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {restoring ? 'Restoring…' : 'Restore Now'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BackupPage() {
  const { hasPermission } = useAuthStore()
  const canManage  = hasPermission('manage_backup')
  const canRestore = hasPermission('restore_backup')

  const [backups, setBackups]       = useState<BackupFile[]>([])
  const [loading, setLoading]       = useState(true)
  const [creating, setCreating]     = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting]     = useState<string | null>(null)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchBackups = async () => {
    setLoading(true)
    try {
      const res = await backupService.list()
      setBackups(res.backups)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchBackups() }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await backupService.create()
      toast.success(`Backup created: ${res.filename} (${res.size_human})`)
      fetchBackups()
    } catch { /* interceptor */ }
    finally { setCreating(false) }
  }

  const handleDownload = async (filename: string) => {
    setDownloading(filename)
    try {
      await backupService.download(filename)
      toast.success(`Downloaded ${filename}`)
    } catch {
      toast.error('Download failed')
    } finally {
      setDownloading(null)
    }
  }

  const handleDelete = async (filename: string) => {
    if (!window.confirm(`Delete backup "${filename}"? This cannot be undone.`)) return
    setDeleting(filename)
    try {
      await backupService.delete(filename)
      toast.success(`Deleted ${filename}`)
      fetchBackups()
    } catch { /* interceptor */ }
    finally { setDeleting(null) }
  }

  const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.endsWith('.db')) {
      toast.error('Only .db files can be restored')
      return
    }
    setRestoreFile(f)
    // Reset input so the same file can be re-selected
    e.target.value = ''
  }

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Backup & Restore</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Protect your data — create regular backups of the database
        </p>
      </div>

      {/* Info card */}
      <div className="card flex items-start gap-4 bg-blue-50 border-blue-200">
        <Database size={22} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 space-y-1">
          <p className="font-semibold">SQLite backup</p>
          <p>
            Backups are a complete copy of the database file. Each backup captures
            every product, sale, customer, and transaction at that moment in time.
          </p>
          <p className="text-blue-700">
            Backups are saved to <span className="font-mono bg-blue-100 px-1 rounded">backups/</span> in the project folder.
            Download them regularly and store off-device.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {canManage && (
          <button
            className="btn-primary flex items-center gap-2"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating
              ? <Loader2 size={16} className="animate-spin" />
              : <Database size={16} />
            }
            {creating ? 'Creating…' : 'Create Backup Now'}
          </button>
        )}

        {canRestore && (
          <>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-red-300 text-red-700 hover:bg-red-50 text-sm font-medium transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={16} /> Restore from File…
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              className="hidden"
              onChange={handleRestoreFileChange}
            />
          </>
        )}

        <button
          className="btn-secondary flex items-center gap-2"
          onClick={fetchBackups}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Backup list */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="font-semibold text-sm text-gray-700">
            Saved Backups {backups.length > 0 && <span className="text-gray-400 font-normal">({backups.length})</span>}
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary-500" />
          </div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <Database size={36} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No backups yet</p>
            <p className="text-xs text-gray-400 mt-1">Click "Create Backup Now" to make your first backup.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {backups.map(b => (
              <div key={b.filename} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <CheckCircle size={16} className="text-green-500 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-mono text-sm font-medium text-gray-900 truncate">{b.filename}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(b.created_at)} · {b.size_human}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  {canManage && (
                    <button
                      onClick={() => handleDownload(b.filename)}
                      disabled={downloading === b.filename}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                      title="Download backup"
                    >
                      {downloading === b.filename
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Download size={15} />
                      }
                    </button>
                  )}
                  {canManage && (
                    <button
                      onClick={() => handleDelete(b.filename)}
                      disabled={deleting === b.filename}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete backup"
                    >
                      {deleting === b.filename
                        ? <Loader2 size={15} className="animate-spin" />
                        : <Trash2 size={15} />
                      }
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warning footer */}
      <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
        <AlertTriangle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-yellow-800">
          <span className="font-semibold">Best practice:</span> Create a backup before every major operation
          (bulk imports, software updates, restores). Store downloaded backups on a separate drive or cloud storage.
        </p>
      </div>

      {/* Restore modal */}
      <RestoreModal
        file={restoreFile}
        onClose={() => setRestoreFile(null)}
        onRestored={fetchBackups}
      />
    </div>
  )
}
