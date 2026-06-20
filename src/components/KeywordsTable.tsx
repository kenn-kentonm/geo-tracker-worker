'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Props {
  keywords: any[]
  companyId: string
}

export default function KeywordsTable({ keywords, companyId }: Props) {
  const supabase = createClient()
  const router = useRouter()

  async function triggerScan(keywordId: string) {
    await supabase
      .from('keywords')
      .update({ status: 'pending', next_run_at: new Date().toISOString() })
      .eq('id', keywordId)
    router.refresh()
  }

  if (keywords.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
        <p className="text-gray-500 text-sm">No keywords yet.</p>
        <p className="text-gray-600 text-xs mt-1">Add your first keyword to start tracking.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-800">
        <h2 className="text-sm font-medium text-gray-400">Keywords</h2>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left px-6 py-3 text-gray-500 font-normal">Phrase</th>
            <th className="text-left px-6 py-3 text-gray-500 font-normal">Frequency</th>
            <th className="text-left px-6 py-3 text-gray-500 font-normal">Status</th>
            <th className="text-left px-6 py-3 text-gray-500 font-normal">Last result</th>
            <th className="px-6 py-3" />
          </tr>
        </thead>
        <tbody>
          {keywords.map(kw => {
            const latest = kw.geo_snapshots?.sort(
              (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0]

            return (
              <tr key={kw.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                <td className="px-6 py-4 text-white">{kw.phrase}</td>
                <td className="px-6 py-4 text-gray-400 capitalize">{kw.frequency}</td>
                <td className="px-6 py-4">
                  <StatusBadge status={kw.status} />
                </td>
                <td className="px-6 py-4">
                  {latest ? (
                    <span className={latest.brand_mentioned ? 'text-green-400' : 'text-gray-500'}>
                      {latest.brand_mentioned ? '✓ Mentioned' : '✗ Not mentioned'}
                    </span>
                  ) : (
                    <span className="text-gray-600">No scans yet</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => triggerScan(kw.id)}
                    disabled={kw.status === 'processing'}
                    className="text-xs text-orange-400 hover:text-orange-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Scan now
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    done:       'bg-green-900/40 text-green-400',
    pending:    'bg-yellow-900/40 text-yellow-400',
    processing: 'bg-blue-900/40 text-blue-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${styles[status] ?? 'bg-gray-800 text-gray-400'}`}>
      {status}
    </span>
  )
}
