import type { ReactNode } from 'react'

type Variant = 'green' | 'blue' | 'yellow' | 'red' | 'purple' | 'gray' | 'orange' | 'indigo'

const variantClasses: Record<Variant, string> = {
  green:  'bg-green-100 text-green-800',
  blue:   'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red:    'bg-red-100 text-red-800',
  purple: 'bg-purple-100 text-purple-800',
  gray:   'bg-gray-100 text-gray-700',
  orange: 'bg-orange-100 text-orange-800',
  indigo: 'bg-indigo-100 text-indigo-800',
}

interface BadgeProps {
  children: ReactNode
  variant?: Variant
  className?: string
}

export default function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return (
    <span className={`badge ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}

/** Map a role name to a badge colour */
export function roleBadgeVariant(role: string): Variant {
  switch (role) {
    case 'ADMIN':   return 'red'
    case 'MANAGER': return 'purple'
    case 'STAFF':   return 'blue'
    case 'SELLER':  return 'green'
    case 'VIEWER':  return 'gray'
    default:        return 'gray'
  }
}
