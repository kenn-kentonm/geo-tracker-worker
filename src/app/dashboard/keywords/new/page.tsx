'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NewKeywordPage() {
  const [phrase, setPhrase] = useState('')
  const [frequency, setFrequency] = useState('weekly')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!company) return

    await supabase.from('keywords').insert({
      company_id: company.id,
      phrase,
      frequency,
      status: 'pending',
      next_run_at: new Date().toISOString()
    })

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold text-white mb-6">Add keyword</h1>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <div>
          <label className="text-sm text-gray-400 block mb-1">Search phrase</label>
          <input
            value={phrase}
            onChange={e => setPhrase(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
            placeholder="best football prediction app in Uganda"
          />
          <p className="text-gray-600 text-xs mt-1">Write it as a user would actually search it.</p>
        </div>

        <div>
          <label className="text-sm text-gray-400 block mb-1">Scan frequency</label>
          <select
            value={frequency}
            onChange={e => setFrequency(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
          >
            <option value="manual">Manual only (free tier)</option>
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
          </select>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !phrase}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
        >
          {loading ? 'Adding...' : 'Add keyword'}
        </button>
      </div>
    </div>
  )
}
