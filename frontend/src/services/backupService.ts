/**
 * Backup service — Phase 13.
 */

import api from '@/services/api'

export interface BackupFile {
  filename:   string
  size_bytes: number
  size_human: string
  created_at: string
}

export interface BackupListResponse {
  count:   number
  backups: BackupFile[]
}

export interface BackupCreateResponse {
  filename:   string
  size_bytes: number
  size_human: string
  created_at: string
  message:    string
}

const backupService = {
  /** Create a new backup (copy of the live DB). */
  create: () =>
    api.post<BackupCreateResponse>('/backup/create').then(r => r.data),

  /** List all backup files, newest first. */
  list: () =>
    api.get<BackupListResponse>('/backup/list').then(r => r.data),

  /** Download a backup file as a blob, then trigger browser save. */
  download: async (filename: string): Promise<void> => {
    const response = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
    })
    const url  = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href  = url
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },

  /** Restore from an uploaded .db file. */
  restore: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<{ message: string; filename: string; size_bytes: number }>(
      '/backup/restore',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    ).then(r => r.data)
  },

  /** Delete a backup file. */
  delete: (filename: string) =>
    api.delete(`/backup/delete/${encodeURIComponent(filename)}`).then(r => r.data),
}

export default backupService
