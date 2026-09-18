/**
 * Warranty tracking page — Phase 10.
 *
 * Two tabs:
 *   Units  — all sold serialized units with warranty status + expiry date
 *   Claims — all filed warranty claims with status management
 *
 * Actions:
 *   - File a new claim from any ACTIVE / EXPIRING unit
 *   - Update claim status: OPEN → IN_REPAIR → RESOLVED | REJECTED
 */

import { useEffect, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Shield, AlertTriangle, CheckCircle, XCircle,
  Clock, Search, Plus, Loader2, ChevronLeft,
  ChevronRight, RotateCcw, Tag, Pencil,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'
import Badge from '@/components/ui/Badge'
import warrantyService, {
  type WarrantyUnit, type WarrantyClaim, type WarrantyStatus, type ClaimStatus,
} from '@/services/warrantyService'
import { useAuthStore } from '@/services/authStore'
import { formatDate } from '@/utils/format'

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<WarrantyStatus, {
  label: string
  badge: 'green' | 'yellow' | 'red' | 'gray'
  icon: React.ElementType
}> = {
  ACTIVE:      { label: 'Active',      badge: 'green',  icon: CheckCircle },
  EXPIRING:    { label: 'Expiring',    badge: 'yellow', icon: AlertTriangle },
  EXPIRED:     { label: 'Expired',     badge: 'red',    icon: XCircle },
  NO_WARRANTY: { label: 'No Warranty', badge: 'gray',   icon: Shield },
}

const CLAIM_STATUS_CONFIG: Record<ClaimStatus, { badge: 'blue' | 'yellow' | 'green' | 'red' }> = {
  OPEN:      { badge: 'blue' },
  IN_REPAIR: { badge: 'yellow' },
  RESOLVED:  { badge: 'green' },
  REJECTED:  { badge: 'red' },
}

// ─── File Claim Modal ─────────────────────────────────────────────────────────

const claimSchema = z.object({
  issue_desc: z.string().min(5, 'Describe the issue (min 5 characters)').trim(),
})
type ClaimForm = z.infer<typeof claimSchema>

function FileClaimModal({
  unit,
  onClose,
  onFiled,
}: {
  unit: WarrantyUnit | null
  onClose: () => void
  onFiled: () => void
}) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClaimForm>({
    resolver: zodResolver(claimSchema),
  })

  useEffect(() => { if (!unit) reset() }, [unit, reset])

  const onSubmit = async (data: ClaimForm) => {
    if (!unit) return
    try {
      const claim = await warrantyService.fileClaim({
        serial_id:  unit.serial_id,
        issue_desc: data.issue_desc,
        customer_id: undefined,
      })
      toast.success(`Claim ${claim.claim_number} filed`)
      reset()
      onClose()
      onFiled()
    } catch { /* interceptor */ }
  }

  if (!unit) return null

  return (
    <Modal isOpen={!!unit} onClose={onClose} title="File Warranty Claim" maxWidth="md">
      <div className="space-y-4">
        {/* Unit info */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-sm">
          <p className="font-semibold text-gray-900">{unit.product_name} — {unit.variant_name}</p>
          <p className="text-gray-500 font-mono text-xs mt-0.5">{unit.serial_number}</p>
          {unit.customer_name && <p className="text-gray-500 mt-1">Customer: {unit.customer_name}</p>}
          {unit.expiry_date && (
            <p className="text-gray-500">
              Warranty expires: {formatDate(unit.expiry_date)}
              {unit.days_remaining !== null && (
                <span className={`ml-1 font-semibold ${unit.days_remaining <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                  ({unit.days_remaining}d left)
                </span>
              )}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="label">Issue Description *</label>
            <textarea
              className="input"
              rows={4}
              placeholder="Describe the problem the customer is experiencing…"
              {...register('issue_desc')}
            />
            {errors.issue_desc && (
              <p className="mt-1 text-xs text-red-600">{errors.issue_desc.message}</p>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-1 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              File Claim
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

// ─── Update Claim Modal ───────────────────────────────────────────────────────

const resolveSchema = z.object({
  status:          z.enum(['OPEN', 'IN_REPAIR', 'RESOLVED', 'REJECTED']),
  resolution_note: z.string().optional(),
})
type ResolveForm = z.infer<typeof resolveSchema>

function UpdateClaimModal({
  claim,
  onClose,
  onUpdated,
}: {
  claim: WarrantyClaim | null
  onClose: () => void
  onUpdated: () => void
}) {
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<ResolveForm>({
    resolver: zodResolver(resolveSchema),
    defaultValues: { status: claim?.status ?? 'OPEN' },
  })

  useEffect(() => {
    if (claim) reset({ status: claim.status, resolution_note: claim.resolution_note ?? '' })
  }, [claim, reset])

  const onSubmit = async (data: ResolveForm) => {
    if (!claim) return
    try {
      await warrantyService.updateClaim(claim.id, data)
      toast.success('Claim updated')
      onClose()
      onUpdated()
    } catch { /* interceptor */ }
  }

  if (!claim) return null

  return (
    <Modal isOpen={!!claim} onClose={onClose} title={`Update Claim ${claim.claim_number}`} maxWidth="sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label">Status</label>
          <select className="input" {...register('status')}>
            <option value="OPEN">Open</option>
            <option value="IN_REPAIR">In Repair</option>
            <option value="RESOLVED">Resolved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <div>
          <label className="label">Resolution Note</label>
          <textarea
            className="input"
            rows={3}
            placeholder="Describe what was done / why rejected…"
            {...register('resolution_note')}
          />
        </div>
        <div className="flex gap-3 justify-end pt-1 border-t border-gray-100">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
            {isSubmitting ? <Loader2 size={15} className="animate-spin" /> : null}
            Save
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ─── Units Tab ────────────────────────────────────────────────────────────────

function UnitsTab({ canManage }: { canManage: boolean }) {
  const [units, setUnits]         = useState<WarrantyUnit[]>([])
  const [total, setTotal]         = useState(0)
  const [pages, setPages]         = useState(1)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [statusFilter, setStatus] = useState('')
  const [filing, setFiling]       = useState<WarrantyUnit | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await warrantyService.listUnits({
        status: statusFilter || undefined,
        search: search || undefined,
        page,
        per_page: 20,
      })
      setUnits(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }, [statusFilter, search, page])

  useEffect(() => { setPage(1) }, [statusFilter, search])
  useEffect(() => { fetchData() }, [fetchData])

  const canFileClaim = (unit: WarrantyUnit) =>
    canManage && (unit.warranty_status === 'ACTIVE' || unit.warranty_status === 'EXPIRING')

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9"
            placeholder="Search serial or product…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input w-auto min-w-[150px]" value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="EXPIRING">Expiring Soon</option>
          <option value="EXPIRED">Expired</option>
          <option value="NO_WARRANTY">No Warranty</option>
        </select>
        {(search || statusFilter) && (
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => { setSearch(''); setStatus('') }}>
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
        ) : units.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Shield size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No units found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Serial / Product</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Customer</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Sale</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Warranty</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Expiry</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                    {canManage && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {units.map(u => {
                    const cfg = STATUS_CONFIG[u.warranty_status]
                    const Icon = cfg.icon
                    return (
                      <tr key={u.serial_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <Tag size={13} className="text-gray-400 flex-shrink-0" />
                            <div>
                              <p className="font-mono text-sm font-medium text-gray-900">{u.serial_number}</p>
                              <p className="text-xs text-gray-500">{u.product_name} — {u.variant_name}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 text-sm">
                          {u.customer_name ?? <span className="text-gray-400">Walk-in</span>}
                        </td>
                        <td className="px-5 py-3.5 text-primary-600 font-mono text-xs">
                          {u.sale_number ?? '—'}
                        </td>
                        <td className="px-5 py-3.5 text-gray-600 text-sm">
                          {u.warranty_months > 0 ? `${u.warranty_months}mo` : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-sm">
                          {u.expiry_date ? (
                            <div>
                              <p className="text-gray-700">{formatDate(u.expiry_date)}</p>
                              {u.days_remaining !== null && (
                                <p className={`text-xs mt-0.5 ${u.days_remaining <= 30 ? 'text-yellow-600 font-semibold' : 'text-gray-400'}`}>
                                  {u.days_remaining}d left
                                </p>
                              )}
                            </div>
                          ) : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Icon size={13} className={
                              cfg.badge === 'green' ? 'text-green-500' :
                              cfg.badge === 'yellow' ? 'text-yellow-500' :
                              cfg.badge === 'red' ? 'text-red-500' : 'text-gray-400'
                            } />
                            <Badge variant={cfg.badge}>{cfg.label}</Badge>
                          </div>
                          {u.open_claims > 0 && (
                            <p className="text-xs text-blue-600 mt-0.5">{u.open_claims} open claim{u.open_claims > 1 ? 's' : ''}</p>
                          )}
                        </td>
                        {canManage && (
                          <td className="px-5 py-3.5">
                            {canFileClaim(u) && (
                              <button
                                onClick={() => setFiling(u)}
                                className="text-xs text-primary-600 hover:text-primary-800 font-medium"
                              >
                                + Claim
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">Page {page} of {pages} — {total} total</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronLeft size={15} /></button>
                  <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronRight size={15} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <FileClaimModal unit={filing} onClose={() => setFiling(null)} onFiled={fetchData} />
    </>
  )
}

// ─── Claims Tab ───────────────────────────────────────────────────────────────

function ClaimsTab({ canManage }: { canManage: boolean }) {
  const [claims, setClaims]       = useState<WarrantyClaim[]>([])
  const [total, setTotal]         = useState(0)
  const [pages, setPages]         = useState(1)
  const [page, setPage]           = useState(1)
  const [loading, setLoading]     = useState(true)
  const [statusFilter, setStatus] = useState('')
  const [editing, setEditing]     = useState<WarrantyClaim | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await warrantyService.listClaims({
        status: statusFilter || undefined,
        page,
        per_page: 20,
      })
      setClaims(res.items)
      setTotal(res.total)
      setPages(res.pages)
    } catch { /* interceptor */ }
    finally { setLoading(false) }
  }, [statusFilter, page])

  useEffect(() => { setPage(1) }, [statusFilter])
  useEffect(() => { fetchData() }, [fetchData])

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <select className="input w-auto min-w-[150px]" value={statusFilter} onChange={e => setStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="OPEN">Open</option>
          <option value="IN_REPAIR">In Repair</option>
          <option value="RESOLVED">Resolved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        {statusFilter && (
          <button className="btn-secondary flex items-center gap-1.5" onClick={() => setStatus('')}>
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
        ) : claims.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Clock size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-500 font-medium">No claims yet</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Claim #</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Serial / Product</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Customer</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Issue</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Date</th>
                    <th className="text-left px-5 py-3 font-medium text-gray-600">Status</th>
                    {canManage && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {claims.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-primary-600 font-medium">{c.claim_number}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-mono text-sm font-medium text-gray-900">{c.serial_number}</p>
                        <p className="text-xs text-gray-500">{c.product_name}</p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">
                        {c.customer_name ?? <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-gray-700 max-w-[200px] truncate">{c.issue_desc}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{formatDate(c.created_at)}</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={CLAIM_STATUS_CONFIG[c.status].badge}>
                          {c.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-5 py-3.5">
                          {c.status !== 'RESOLVED' && c.status !== 'REJECTED' && (
                            <button
                              onClick={() => setEditing(c)}
                              className="p-1.5 rounded text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                <p className="text-xs text-gray-500">Page {page} of {pages} — {total} total</p>
                <div className="flex gap-2">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronLeft size={15} /></button>
                  <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="btn-secondary py-1 px-2 disabled:opacity-40"><ChevronRight size={15} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <UpdateClaimModal claim={editing} onClose={() => setEditing(null)} onUpdated={fetchData} />
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WarrantyPage() {
  const { hasPermission } = useAuthStore()
  const canManage = hasPermission('manage_warranty')
  const [tab, setTab] = useState<'units' | 'claims'>('units')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900">Warranty</h2>
        <p className="text-sm text-gray-500 mt-0.5">Track warranty status and manage claims</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['units', 'claims'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'units' ? 'Warranty Units' : 'Claims'}
          </button>
        ))}
      </div>

      {tab === 'units'  && <UnitsTab  canManage={canManage} />}
      {tab === 'claims' && <ClaimsTab canManage={canManage} />}
    </div>
  )
}
