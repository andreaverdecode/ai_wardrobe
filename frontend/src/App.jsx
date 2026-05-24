import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

import Header from './components/Layout/Header.jsx'
import Sidebar from './components/Layout/Sidebar.jsx'
import WardrobePage from './pages/WardrobePage.jsx'
import OutfitsPage from './pages/OutfitsPage.jsx'
import TryOnPage from './pages/TryOnPage.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,   // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex flex-col min-h-screen bg-brand-50">
          <Header />
          <div className="flex flex-1" style={{ paddingTop: 'var(--header-height)' }}>
            <Sidebar />
            <main
              className="flex-1 min-w-0"
              style={{ marginLeft: 0 }}
            >
              <div className="page-container">
                <Routes>
                  <Route path="/"        element={<WardrobePage />} />
                  <Route path="/outfit"  element={<OutfitsPage />} />
                  <Route path="/tryon"   element={<TryOnPage />} />
                  <Route path="*"        element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </BrowserRouter>

      <Toaster
        position="bottom-right"
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#1a1a1a',
            color: '#ffffff',
            fontSize: '14px',
            borderRadius: '10px',
            padding: '12px 16px',
          },
          success: {
            iconTheme: { primary: '#22c55e', secondary: '#fff' },
          },
          error: {
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
          },
        }}
      />
    </QueryClientProvider>
  )
}
