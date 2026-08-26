import { useState } from 'react'
import { MainLayout } from '@/components/templates/MainLayout'
import { SnozoneBookTab } from '@/components/organisms/SnozoneBookTab'

type TabId = 'book' | 'patterns'

/**
 * Snozone: "when should I go?" (Book) and, eventually, "what is this slope
 * like?" (Patterns — work item G, shell only for now). Any signed-in user
 * can see this; it is not admin-only. Admin-only collector health lives at
 * Settings → Snozone.
 */
export function SnozonePage() {
  const [tab, setTab] = useState<TabId>('book')

  const tabs: { id: TabId; label: string }[] = [
    { id: 'book', label: 'Book' },
    { id: 'patterns', label: 'Patterns' },
  ]

  return (
    <MainLayout>
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Snozone</h1>

        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-6" aria-label="Snozone sections">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'border-primary-600 text-primary-700'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        {tab === 'book' && <SnozoneBookTab />}

        {tab === 'patterns' && (
          <p className="text-sm text-gray-500">
            Patterns — busyness and booking-time analytics — is coming soon, as the collector
            builds up enough history to make it meaningful.
          </p>
        )}
      </div>
    </MainLayout>
  )
}
