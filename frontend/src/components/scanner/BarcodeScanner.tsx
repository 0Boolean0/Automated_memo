/**
 * BarcodeScanner component — Phase 6.
 *
 * Uses @zxing/browser to access the phone/laptop camera and
 * continuously decode barcodes. Calls onScan(barcode) each time
 * a code is successfully read.
 *
 * Props:
 *   onScan   — called with the decoded string when a barcode is found
 *   onError  — called if camera access is denied or not supported
 *   paused   — when true, scanning is paused (e.g. while showing result)
 *
 * Design notes:
 * - Uses rear camera by default (facingMode: environment) for phones
 * - Falls back to any camera if rear not available
 * - Debounces consecutive same-barcode reads (1 second cooldown)
 * - Shows a scanning target overlay over the video
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { Camera, CameraOff, Loader2 } from 'lucide-react'

interface Props {
  onScan: (barcode: string) => void
  onError?: (error: string) => void
  paused?: boolean
}

export default function BarcodeScanner({ onScan, onError, paused = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const lastScanRef = useRef<{ value: string; time: number }>({ value: '', time: 0 })

  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting')
  const [errorMsg, setErrorMsg] = useState('')

  const startScanning = useCallback(async () => {
    if (!videoRef.current) return

    setStatus('starting')

    // Stop any existing scan session first
    controlsRef.current?.stop()
    controlsRef.current = null

    const codeReader = new BrowserMultiFormatReader()

    try {
      const controls = await codeReader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: 'environment' }, // rear camera on phones
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        videoRef.current,
        (result, error) => {
          if (!result) return

          const barcode = result.getText()
          const now = Date.now()

          // Debounce: ignore same barcode within 1.5 seconds
          if (
            barcode === lastScanRef.current.value &&
            now - lastScanRef.current.time < 1500
          ) {
            return
          }

          lastScanRef.current = { value: barcode, time: now }
          onScan(barcode)
        }
      )

      controlsRef.current = controls
      setStatus('scanning')
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Camera access failed'

      const friendly =
        message.includes('Permission') || message.includes('NotAllowed')
          ? 'Camera permission denied. Allow camera access and try again.'
          : message.includes('NotFound') || message.includes('DevicesNotFound')
          ? 'No camera found on this device.'
          : 'Could not start camera. ' + message

      setStatus('error')
      setErrorMsg(friendly)
      onError?.(friendly)
    }
  }, [onScan, onError])

  // Start / stop based on paused prop
  useEffect(() => {
    if (paused) {
      controlsRef.current?.stop()
      controlsRef.current = null
    } else {
      startScanning()
    }

    return () => {
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [paused, startScanning])

  return (
    <div className="relative w-full aspect-video max-h-72 rounded-2xl overflow-hidden bg-gray-900">

      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        playsInline
        aria-label="Camera viewfinder for barcode scanning"
      />

      {/* Starting overlay */}
      {status === 'starting' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 text-white gap-3">
          <Loader2 size={32} className="animate-spin text-primary-400" />
          <p className="text-sm font-medium">Starting camera…</p>
        </div>
      )}

      {/* Error overlay */}
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

      {/* Paused overlay */}
      {paused && status !== 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/70 text-white gap-2">
          <Camera size={28} className="text-gray-300" />
          <p className="text-sm text-gray-300">Paused</p>
        </div>
      )}

      {/* Scanning target — only when actively scanning */}
      {status === 'scanning' && !paused && (
        <>
          {/* Dark edges */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-black/30" />
            {/* Clear window in the center */}
            <div className="absolute inset-x-[15%] inset-y-[20%] bg-transparent" />
          </div>

          {/* Corner markers */}
          {[
            'top-[19%] left-[14%]',
            'top-[19%] right-[14%] rotate-90',
            'bottom-[19%] left-[14%] -rotate-90',
            'bottom-[19%] right-[14%] rotate-180',
          ].map((pos, i) => (
            <div
              key={i}
              className={`absolute ${pos} w-6 h-6 pointer-events-none`}
            >
              <svg viewBox="0 0 24 24" className="w-full h-full">
                <path
                  d="M2 10 L2 2 L10 2"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          ))}

          {/* Animated scan line */}
          <div
            className="absolute left-[15%] right-[15%] h-0.5 bg-green-400/80 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)] animate-scan-line pointer-events-none"
            style={{ top: '20%', animationDuration: '2s' }}
          />
        </>
      )}
    </div>
  )
}
