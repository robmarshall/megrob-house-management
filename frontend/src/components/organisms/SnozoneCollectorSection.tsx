import { useSnozoneStatus } from '@/hooks/snozone/useSnozoneStatus'
import type {
  CollectorHealth,
  DateCoverage,
  HealthLevel,
  ProductStatus,
  RunRow,
} from '@/types/snozone'

/**
 * Snozone collector health, for the admin settings tab.
 *
 * Built around making silence legible: the failure that matters is a collector
 * that has quietly stopped, which produces no errors and no rows. So the
 * headline is "when did a run last succeed", not "were there any errors".
 */
export function SnozoneCollectorSection() {
  const { data, isLoading, isError } = useSnozoneStatus()

  if (isLoading) {
    return <p className="text-sm text-gray-500">Loading collector status…</p>
  }
  if (isError) {
    return <p className="text-sm text-red-600">Could not load collector status.</p>
  }
  if (!data) return null

  const { observations, finals, coverage, products } = data

  return (
    <div className="space-y-8">
      {products.length === 0 && (
        <p className="text-sm text-gray-500">
          No products configured — nothing is being collected.
        </p>
      )}

      {products.map((product) => (
        <ProductPanel key={product.id} product={product} />
      ))}

      <section>
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Data collected</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Observations" value={observations.rows.toLocaleString()} />
          <Stat label="Session dates" value={observations.distinctDates} />
          <Stat label="Rows, last 24h" value={observations.rowsLast24h.toLocaleString()} />
          <Stat
            label="Rolled up"
            value={finals.rows.toLocaleString()}
            hint={finals.latestDate ? `to ${finals.latestDate}` : 'not yet run'}
          />
        </div>
        {observations.firstAt && (
          <p className="mt-3 text-xs text-gray-500">
            Collecting since {new Date(observations.firstAt).toLocaleString()} · last write{' '}
            {observations.lastAt ? new Date(observations.lastAt).toLocaleString() : '—'}
          </p>
        )}
      </section>

      {coverage.length > 0 && <CoverageTable coverage={coverage} />}
    </div>
  )
}

function ProductPanel({ product }: { product: ProductStatus }) {
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{product.label}</h3>
        <HealthBadge status={product.health.status} />
        {!product.active && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            paused
          </span>
        )}
      </div>

      <HealthSummary health={product.health} />
      <RunTable runs={product.runs} />
    </section>
  )
}

function HealthSummary({ health }: { health: CollectorHealth }) {
  return (
    <div className="mb-4 space-y-1 text-sm">
      <p className="text-gray-600">
        {health.lastOkAt ? (
          <>
            Last successful run {new Date(health.lastOkAt).toLocaleString()}
            {health.minutesSinceLastOk !== null && (
              <span className="text-gray-400"> ({formatAge(health.minutesSinceLastOk)} ago)</span>
            )}
          </>
        ) : (
          'No successful run yet'
        )}
      </p>
      {health.consecutiveFailures > 0 && (
        <p className="text-amber-700">
          {health.consecutiveFailures} consecutive failed run
          {health.consecutiveFailures === 1 ? '' : 's'} — backing off and retrying
        </p>
      )}
      {health.reasons.map((reason) => (
        <p key={reason} className="text-red-700">
          {reason}
        </p>
      ))}
    </div>
  )
}

function RunTable({ runs }: { runs: RunRow[] }) {
  if (runs.length === 0) {
    return <p className="text-sm text-gray-500">No runs recorded yet.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
            <th className="py-2 pr-3 font-medium">When</th>
            <th className="py-2 pr-3 font-medium">Mode</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium text-right">Slots</th>
            <th className="py-2 pr-3 font-medium text-right">Changes</th>
            <th className="py-2 font-medium text-right">Calls</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-gray-100 align-top">
              <td className="py-2 pr-3 whitespace-nowrap text-gray-700">
                {new Date(run.startedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                <span className="ml-1 text-xs text-gray-400">
                  {new Date(run.startedAt).toLocaleDateString([], {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </td>
              <td className="py-2 pr-3 text-gray-600">{run.mode}</td>
              <td className="py-2 pr-3">
                <RunStatus run={run} />
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-gray-700">
                {run.slotsSeen ?? '—'}
              </td>
              <td className="py-2 pr-3 text-right tabular-nums text-gray-700">
                {run.changesWritten ?? '—'}
              </td>
              <td className="py-2 text-right tabular-nums text-gray-500">
                {run.httpCalls ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RunStatus({ run }: { run: RunRow }) {
  const tone =
    run.status === 'ok'
      ? 'text-green-700'
      : run.status === 'skipped'
        ? 'text-gray-500'
        : 'text-red-700'

  return (
    <div>
      <span className={tone}>{run.status}</span>
      {run.error && (
        <p className="mt-0.5 max-w-xs break-words text-xs text-red-600">{run.error}</p>
      )}
      {run.datesSkipped && run.datesSkipped.length > 0 && (
        <p className="mt-0.5 text-xs text-gray-400">
          skipped {run.datesSkipped.join(', ')} (finished)
        </p>
      )}
    </div>
  )
}

function CoverageTable({ coverage }: { coverage: DateCoverage[] }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900 mb-1">Recent session dates</h3>
      <p className="mb-3 text-xs text-gray-500">
        Peak headcount counts only readings taken before a slot started — Snozone
        reports nonsense once a slot is past.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium text-right">Slots</th>
              <th className="py-2 pr-3 font-medium text-right">Observations</th>
              <th className="py-2 pr-3 font-medium text-right">Peak on slope</th>
              <th className="py-2 font-medium">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map((row) => (
              <tr key={row.sessionDate} className="border-b border-gray-100">
                <td className="py-2 pr-3 whitespace-nowrap text-gray-700">
                  {row.sessionDate}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-gray-700">{row.slots}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-gray-700">
                  {row.observations.toLocaleString()}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-gray-700">
                  {row.peakOnSlope ?? '—'}
                </td>
                <td className="py-2 whitespace-nowrap text-xs text-gray-500">
                  {new Date(row.lastObservedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-gray-900">{value}</p>
      {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
    </div>
  )
}

function HealthBadge({ status }: { status: HealthLevel }) {
  const styles: Record<HealthLevel, string> = {
    ok: 'bg-green-100 text-green-800',
    degraded: 'bg-amber-100 text-amber-800',
    down: 'bg-red-100 text-red-800',
  }
  const labels: Record<HealthLevel, string> = {
    ok: 'Collecting',
    degraded: 'Degraded',
    down: 'Not collecting',
  }
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

function formatAge(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ${minutes % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}
