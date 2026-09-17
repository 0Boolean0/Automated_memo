/**
 * Mobile bottom navigation bar.
 * Visible only on small screens (< md breakpoint).
 * Provides quick access to the 5 most important sections.
 * The Scan button is center-placed and visually prominent — it's the
 * most-used feature on phones.
 */

import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ScanLine,
  ShoppingCart,
  Boxes,
  MoreHorizontal,
} from 'lucide-react'

export default function MobileNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around h-16 px-2">

        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg
             text-xs font-medium transition-colors
             ${isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}`
          }
        >
          <LayoutDashboard size={22} />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/sales"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg
             text-xs font-medium transition-colors
             ${isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}`
          }
        >
          <ShoppingCart size={22} />
          <span>Sales</span>
        </NavLink>

        {/*
          SCAN button — center position, visually elevated.
          This is the most important mobile action — scanning a product.
          The floating circle design makes it obvious and easy to tap.
        */}
        <NavLink
          to="/scan"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center -mt-6
             w-16 h-16 rounded-full shadow-lg
             ${isActive
               ? 'bg-primary-700 text-white'
               : 'bg-primary-600 text-white hover:bg-primary-700'
             }
             transition-colors`
          }
          aria-label="Scan product"
        >
          <ScanLine size={26} />
          <span className="text-xs font-medium mt-0.5">Scan</span>
        </NavLink>

        <NavLink
          to="/inventory"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg
             text-xs font-medium transition-colors
             ${isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}`
          }
        >
          <Boxes size={22} />
          <span>Stock</span>
        </NavLink>

        <NavLink
          to="/more"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg
             text-xs font-medium transition-colors
             ${isActive ? 'text-primary-600' : 'text-gray-500 hover:text-gray-700'}`
          }
        >
          <MoreHorizontal size={22} />
          <span>More</span>
        </NavLink>

      </div>
    </nav>
  )
}
