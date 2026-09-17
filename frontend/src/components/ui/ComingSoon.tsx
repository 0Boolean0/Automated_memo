/**
 * Placeholder component for pages that will be built in later phases.
 * Shows the page name and which phase it belongs to.
 */

import { Construction } from 'lucide-react'

interface ComingSoonProps {
  page: string
  phase: string
}

export default function ComingSoon({ page, phase }: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
        <Construction size={36} className="text-yellow-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">{page}</h2>
      <p className="text-gray-500 max-w-sm">
        This page will be built in <span className="font-semibold text-primary-600">{phase}</span>.
      </p>
      <div className="mt-6 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
        Coming soon
      </div>
    </div>
  )
}
