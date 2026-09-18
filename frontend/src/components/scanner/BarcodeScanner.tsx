/**
 * BarcodeScanner component — updated Phase 6.
 *
 * Enumerates ALL video input devices (including virtual cameras like iVCam)
 * and lets the user pick which one to use via a dropdown.
 * iVCam registers as a standard webcam device — once selected it works
 * exactly like a physical camera.
 *
 * Props:
 *   onScan      — called with decoded barcode string
 *   onError     — called on camera error
 *   paused      — pauses scanning (e.g. while showing result)
 *   deviceId    — controlled: which camera device to use
 *   onDeviceChange — called when user picks a different camera
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { Camera, CameraOff, Loader2, ChevronDown } from 'lucide-react'

export interface CameraDevice {
  deviceId: string
  label:    string
}

interface Props {
  onScan:          (barcode: string) => void
  onError?:        (error: string) => void
  paused?:         boolean
  deviceId?:       string | null
  onDeviceChange?: (device: CameraDevice) => void
}

export default function BarcodeScanner({
  onScan, onError, paused = false,
  deviceId: controlledDeviceId,
  onDeviceChange,
}: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const lastScanRef = useRef<{ value: string; time: number }>({ value: '', time: 0 })

  const [status, setStatus]   = useState<'starting' | 'scanning' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [activeId, setActiveId] = useState<string | null>(controlledDeviceId ?? null)

  // ── Enumerate cameras on mount ──────────────────────────────────────────
  useEffect(() => {
    BrowserMultiFormatReader.listVideoInputDevices()
      .then(devs => {
        const mapped = devs.map(d => ({
          deviceId: d.deviceId,
          label:    d.label || `Camera ${d.deviceId.slice(0, 6)}`,
        }))
        setDevices(mapped)

        // Auto-select: prefer iVCam, else rear camera, else first
        if (!activeId && mapped.length > 0) {
          const ivcam = mapped.find(d =>
            d.label.toLowerCase().includes('ivcam') ||
            d.label.toLowerCase().includes('e2esoft')
          )
          const rear = mapped.find(d =>
            d.label.toLowerCase().includes('back') ||
            d.label.toLowerCase().includes('rear') ||
            d.label.toLowerCase().includes('environment')
          )
          const chosen = ivcam ?? rear ?? mapped[0]
          setActiveId(chosen.deviceId)
          onDeviceChange?.(chosen)
        }
      })
      .catch(() => { /* permission not yet granted — will retry on start */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start scanning ──────────────────────────────────────────────────────
  const startScanning = useCallback(async () => {
    if (!videoRef.current) return

    setStatus('starting')
    controlsRef.current?.stop()
    controlsRef.current = null

    const codeReader = new BrowserMultiFormatReader()

    try {
      // Re-enumerate here so we catch permission being granted after mount
      if (devices.length === 0) {
        const devs = await BrowserMultiFormatReader.listVideoInputDevices()
        const mapped = devs.map(d => ({
          deviceId: d.deviceId,
          label:    d.label || `Camera ${d.deviceId.slice(0, 6)}`,
        }))
        setDevices(mapped)
        if (!activeId && mapped.length > 0) {
          const ivcam = mapped.find(d =>
            d.label.toLowerCase().includes('ivcam') ||
            d.label.toLowerCase().includes('e2esoft')
          )
          const chosen = ivcam ?? mapped[0]
          setActiveId(chosen.deviceId)
          onDeviceChange?.(chosen)
          return  // will re-trigger via activeId change
        }
      }

      // Use specific deviceId if selected, else use facingMode constraint
      const constraints: MediaStreamConstraints = activeId
        ? { video: { deviceId: { exact: activeId }, width: { ideal: 1280 }, height: { ideal: 720 } } }
        : { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } } }

      const controls = await codeReader.decodeFromConstraints(
        constraints,
        videoRef.current,
        (result) => {
          if (!result) return
          const barcode = result.getText()
          const now = Date.now()
          if (
            barcode === lastScanRef.current.value &&
            now - lastScanRef.current.time < 1500
          ) return
          lastScanRef.current = { value: barcode, time: now }
          onScan(barcode)
        }
      )

      controlsRef.current = controls
      setStatus('scanning')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Camera access failed'
      const friendly =
        message.includes('Permission') || message.includes('NotAllowed')
          ? 'Camera permission denied. Click "Allow" when the browser asks.'
          : message.includes('NotFound') || message.includes('DevicesNotFound')
          ? 'No camera found. Make sure iVCam is running and connected.'
          : 'Could not start camera: ' + message

      setStatus('error')
      setErrorMsg(friendly)
      onError?.(friendly)
    }
  }, [activeId, devices.length, onScan, onError, onDeviceChange])

  // ── Start/stop on paused or device change ───────────────────────────────
  useEffect(() => {
    if (paused) {
      controlsRef.current?.stop()
      controlsRef.current = null
      return
    }
    startScanning()
    return () => {
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [paused, activeId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handle device switch ────────────────────────────────────────────────
  const handleDeviceSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value
    setActiveId(id)
    const dev = devices.find(d => d.deviceId === id)
    if (dev) onDeviceChange?.(dev)
  }

  return (
    <div className="space-y-2">
      {/* Camera picker — only shown when multiple cameras available */}
      {devices.length > 0 && (
        <div className="relative">
          <Camera size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={activeId ?? ''}
            onChange={handleDeviceSelect}
            aria-label="Select camera"
          >
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label.includes('iVCam') || d.label.includes('e2eSoft')
                  ? `📱 ${d.label} (iVCam)`
                  : d.label
                }
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Viewfinder */}
      <div className="relative w-full aspect-video max-h-72 rounded-2xl overflow-hidden bg-gray-900">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          aria-label="Camera viewfinder for barcode scanning"
        />

        {/* Starting */}
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-white gap-3">
            <Loader2 size={32} className="animate-spin text-primary-400" />
            <p className="text-sm font-medium">Starting camera…</p>
            {devices.length === 0 && (
              <p className="text-xs text-gray-400 px-6 text-center">
                If using iVCam, make sure the app is running on your phone first.
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-white gap-3 p-4">
            <CameraOff size={32} className="text-red-400" />
            <p className="text-sm font-medium text-center">{errorMsg}</p>
            <button
              onClick={startScanning}
              className="mt-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Paused */}
        {paused && status !== 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/70 text-white gap-2">
            <Camera size={28} className="text-gray-300" />
            <p className="text-sm text-gray-300">Paused</p>
          </div>
        )}

        {/* Scanning overlay */}
        {status === 'scanning' && !paused && (
          <>
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute inset-x-[15%] inset-y-[20%] bg-transparent" />
            </div>
            {['top-[19%] left-[14%]', 'top-[19%] right-[14%] rotate-90',
              'bottom-[19%] left-[14%] -rotate-90', 'bottom-[19%] right-[14%] rotate-180',
            ].map((pos, i) => (
              <div key={i} className={`absolute ${pos} w-6 h-6 pointer-events-none`}>
                <svg viewBox="0 0 24 24" className="w-full h-full">
                  <path d="M2 10 L2 2 L10 2" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            ))}
            <div
              className="absolute left-[15%] right-[15%] h-0.5 bg-green-400/80 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)] animate-scan-line pointer-events-none"
              style={{ top: '20%', animationDuration: '2s' }}
            />
          </>
        )}
      </div>
    </div>
  )
}
