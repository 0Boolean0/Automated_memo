/**
 * BarcodeScanner component — updated Phase 6 & iVCam integration.
 *
 * Enumerates ALL video input devices (including virtual cameras like iVCam)
 * and lets the user pick which one to use via a dropdown.
 * iVCam registers as a standard webcam device — once selected it works
 * exactly like a physical camera.
 *
 * Props:
 *   onScan         — called with decoded barcode string
 *   onError        — called on camera error
 *   paused         — pauses scanning (e.g. while showing result)
 *   deviceId       — controlled: which camera device to use
 *   onDeviceChange — called when user picks a different camera
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import {
  Camera, CameraOff, Loader2, ChevronDown, RefreshCw,
  Smartphone, HelpCircle, CheckCircle2, ExternalLink,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Modal from '@/components/ui/Modal'

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

  const [status, setStatus]     = useState<'starting' | 'scanning' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')
  const [devices, setDevices]   = useState<CameraDevice[]>([])
  const [activeId, setActiveId] = useState<string | null>(controlledDeviceId ?? null)
  const [refreshing, setRefreshing] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)

  // ── Helper to detect iVCam in devices ────────────────────────────────────
  const isIvCamDevice = (label: string) => {
    const l = label.toLowerCase()
    return l.includes('ivcam') || l.includes('e2esoft') || l.includes('droidcam')
  }

  // ── Refresh device list ─────────────────────────────────────────────────
  const refreshDevices = useCallback(async (notify = false) => {
    setRefreshing(true)
    try {
      // Warm up camera permission if labels are blank
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        stream.getTracks().forEach(t => t.stop())
      } catch {
        // user may have already granted or denied
      }

      const devs = await BrowserMultiFormatReader.listVideoInputDevices()
      const mapped: CameraDevice[] = devs.map(d => ({
        deviceId: d.deviceId,
        label:    d.label || `Camera ${d.deviceId.slice(0, 6)}`,
      }))
      setDevices(mapped)

      const ivcam = mapped.find(d => isIvCamDevice(d.label))
      if (ivcam) {
        if (!activeId || activeId !== ivcam.deviceId) {
          setActiveId(ivcam.deviceId)
          onDeviceChange?.(ivcam)
        }
        if (notify) toast.success(`Connected to ${ivcam.label}!`)
      } else if (mapped.length > 0 && !activeId) {
        setActiveId(mapped[0].deviceId)
        onDeviceChange?.(mapped[0])
        if (notify) toast.success(`Found ${mapped.length} camera(s)`)
      } else if (notify) {
        toast('Cameras refreshed')
      }
    } catch {
      if (notify) toast.error('Could not enumerate camera devices')
    } finally {
      setRefreshing(false)
    }
  }, [activeId, onDeviceChange])

  // ── Initial load & listen to hardware changes ───────────────────────────
  useEffect(() => {
    refreshDevices(false)

    if (navigator.mediaDevices && 'ondevicechange' in navigator.mediaDevices) {
      const handleDeviceChange = () => {
        refreshDevices(false)
      }
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
      }
    }
  }, [refreshDevices])

  // ── Start scanning ──────────────────────────────────────────────────────
  const startScanning = useCallback(async () => {
    if (!videoRef.current) return

    setStatus('starting')
    controlsRef.current?.stop()
    controlsRef.current = null

    const codeReader = new BrowserMultiFormatReader()

    try {
      if (devices.length === 0) {
        await refreshDevices(false)
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
          ? 'No camera found. Make sure your webcam or iVCam is running and connected.'
          : 'Could not start camera: ' + message

      setStatus('error')
      setErrorMsg(friendly)
      onError?.(friendly)
    }
  }, [activeId, devices.length, onScan, onError, refreshDevices])

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

  const activeDevice = devices.find(d => d.deviceId === activeId)
  const isIvCamActive = activeDevice && isIvCamDevice(activeDevice.label)

  return (
    <div className="space-y-2">

      {/* ── Top controls bar ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Camera size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-primary-400"
            value={activeId ?? ''}
            onChange={handleDeviceSelect}
            aria-label="Select camera"
          >
            {devices.length === 0 ? (
              <option value="">Searching for cameras…</option>
            ) : (
              devices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {isIvCamDevice(d.label) ? `📱 ${d.label} (Phone iVCam)` : d.label}
                </option>
              ))
            )}
          </select>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={() => refreshDevices(true)}
          disabled={refreshing}
          className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors flex items-center justify-center flex-shrink-0"
          title="Refresh cameras / Detect iVCam"
          aria-label="Refresh cameras"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin text-primary-600' : ''} />
        </button>

        {/* iVCam Phone Helper button */}
        <button
          type="button"
          onClick={() => setShowHelpModal(true)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl border transition-colors ${
            isIvCamActive
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : 'bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100'
          }`}
          title="How to scan using phone via iVCam"
        >
          <Smartphone size={14} />
          <span>{isIvCamActive ? 'iVCam Active' : 'Use Phone (iVCam)'}</span>
        </button>
      </div>

      {/* ── Viewfinder ──────────────────────────────────────────────────── */}
      <div className="relative w-full aspect-video max-h-72 rounded-2xl overflow-hidden bg-gray-900 shadow-inner">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          aria-label="Camera viewfinder for barcode scanning"
        />

        {/* Starting */}
        {status === 'starting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-white gap-3 p-4 text-center">
            <Loader2 size={32} className="animate-spin text-primary-400" />
            <p className="text-sm font-medium">Starting camera…</p>
            <p className="text-xs text-gray-400 max-w-xs">
              If using your phone via iVCam, ensure the iVCam app is running on your phone and PC.
            </p>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 text-white gap-3 p-4 text-center">
            <CameraOff size={32} className="text-red-400" />
            <p className="text-sm font-medium">{errorMsg}</p>
            <div className="flex gap-2">
              <button
                onClick={startScanning}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-xs font-medium transition-colors"
              >
                Retry Camera
              </button>
              <button
                onClick={() => setShowHelpModal(true)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-xs font-medium transition-colors"
              >
                iVCam Setup Guide
              </button>
            </div>
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
            {isIvCamActive && (
              <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-emerald-600/90 text-white text-[11px] font-medium flex items-center gap-1 shadow-sm">
                <Smartphone size={12} /> Phone Camera (iVCam)
              </div>
            )}
          </>
        )}
      </div>

      {/* ── iVCam Setup Help Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="Scan Products Using Your Phone via iVCam"
        maxWidth="md"
      >
        <div className="space-y-4 text-sm text-gray-600">
          <p>
            You can use your mobile phone (iPhone or Android) as a high-definition wireless barcode scanner
            using the free <strong>iVCam</strong> application.
          </p>

          <div className="space-y-3">
            <div className="flex gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                1
              </div>
              <div>
                <p className="font-semibold text-gray-900">Install iVCam on PC and Phone</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Download the PC client from <a href="https://www.e2esoft.com/ivcam/" target="_blank" rel="noreferrer" className="text-primary-600 hover:underline font-medium inline-flex items-center gap-0.5">e2esoft.com/ivcam <ExternalLink size={10} /></a>.
                  Install the <strong>iVCam Webcam</strong> app on your phone from the App Store or Google Play.
                </p>
              </div>
            </div>

            <div className="flex gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                2
              </div>
              <div>
                <p className="font-semibold text-gray-900">Connect Phone to PC</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Connect both devices to the same <strong>Wi-Fi network</strong>, or plug your phone into PC with a <strong>USB cable</strong> (USB gives the fastest zero-lag performance).
                </p>
              </div>
            </div>

            <div className="flex gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 font-bold flex items-center justify-center text-xs flex-shrink-0">
                3
              </div>
              <div>
                <p className="font-semibold text-gray-900">Open App & Select Camera</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Open the iVCam app on your phone. Then in SmartStock, click the <strong>Refresh</strong> button (<RefreshCw size={11} className="inline" />) and choose <strong>"e2eSoft iVCam"</strong> in the dropdown above.
                </p>
              </div>
            </div>

            <div className="flex gap-3 bg-emerald-50 p-3 rounded-xl border border-emerald-100">
              <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-emerald-900">Ready to Scan!</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Hold your phone over any barcode, SKU, or serial label. SmartStock decodes it instantly in real-time.
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={() => {
                setShowHelpModal(false)
                refreshDevices(true)
              }}
              className="btn-primary"
            >
              Check & Refresh Cameras Now
            </button>
          </div>
        </div>
      </Modal>

    </div>
  )
}
