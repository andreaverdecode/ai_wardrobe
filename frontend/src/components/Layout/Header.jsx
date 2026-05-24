import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Menu, X, Shirt } from 'lucide-react'
import clsx from 'clsx'
import { useScrollLock } from '../../hooks/useScrollLock.js'

const NAV_LINKS = [
  { to: '/',      label: 'Armadio' },
  { to: '/tryon', label: 'Try-On'  },
]

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  useScrollLock(menuOpen)

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-brand-200"
        style={{ height: 'var(--header-h)', paddingTop: 'var(--safe-top)' }}
      >
        <div className="flex items-center justify-between h-full px-4 md:px-6"
          style={{ paddingLeft: 'max(1rem, var(--safe-left))', paddingRight: 'max(1rem, var(--safe-right))' }}
        >
          {/* Logo */}
          <NavLink
            to="/"
            className="flex items-center gap-2 font-semibold text-brand-900 hover:text-brand-700 transition-colors"
            onClick={() => setMenuOpen(false)}
          >
            <span className="flex items-center justify-center w-7 h-7 bg-brand-900 rounded-lg">
              <Shirt size={15} className="text-white" />
            </span>
            <span className="tracking-tight">Progetto Armadio</span>
          </NavLink>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-100 text-brand-900'
                      : 'text-brand-500 hover:text-brand-900 hover:bg-brand-50',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="md:hidden btn-ghost p-2"
            aria-label={menuOpen ? 'Chiudi menu' : 'Apri menu'}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      {/* Mobile dropdown nav */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="absolute top-[var(--header-height)] left-0 right-0 bg-white border-b border-brand-200 shadow-lg px-4 py-3 flex flex-col gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  clsx(
                    'px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-brand-100 text-brand-900'
                      : 'text-brand-600 hover:bg-brand-50 hover:text-brand-900',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
