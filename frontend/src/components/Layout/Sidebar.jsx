import { NavLink } from 'react-router-dom'
import { Shirt, Camera } from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/',      icon: Shirt,  label: 'Armadio', description: 'I tuoi vestiti'       },
  { to: '/tryon', icon: Camera, label: 'Try-On',  description: 'Outfit & look generati' },
]

/**
 * Desktop-only sidebar. Hidden on mobile (hamburger nav in Header takes over).
 */
export default function Sidebar() {
  return (
    <aside
      className="hidden lg:flex flex-col shrink-0 bg-white border-r border-brand-200"
      style={{ width: 'var(--sidebar-width)', minHeight: 'calc(100vh - var(--header-h))' }}
    >
      <nav className="flex flex-col gap-1 p-3 pt-4">
        {NAV_ITEMS.map(({ to, icon: Icon, label, description }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx(
                'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150',
                isActive
                  ? 'bg-brand-900 text-white'
                  : 'text-brand-600 hover:bg-brand-50 hover:text-brand-900',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    'flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors',
                    isActive ? 'bg-white/15' : 'bg-brand-100 group-hover:bg-brand-200',
                  )}
                >
                  <Icon size={16} strokeWidth={isActive ? 2 : 1.75} />
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="text-sm font-medium leading-none">{label}</span>
                  <span
                    className={clsx(
                      'text-xs mt-0.5 leading-none',
                      isActive ? 'text-white/60' : 'text-brand-400',
                    )}
                  >
                    {description}
                  </span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer hint */}
      <div className="mt-auto p-4 border-t border-brand-100">
        <p className="text-xs text-brand-400 leading-relaxed">
          Analisi AI powered by Claude
        </p>
      </div>
    </aside>
  )
}
