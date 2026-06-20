'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [competitors, setCompetitors] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('companies').insert({
      user_id: user.id,
      name,
      domain,
      competitors: competitors.split(',').map(c => c.trim()).filter(Boolean)
    })

    if (!error) {
      router.push('/dashboard')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold text-white mb-2">Set up your brand</h1>
        <p className="text-gray-500 text-sm mb-6">Tell us who you are and who you compete with.</p>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Brand name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              placeholder="Acme Inc"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Website domain</label>
            <input
              value={domain}
              onChange={e => setDomain(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              placeholder="acme.com"
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Competitors (comma separated)</label>
            <input
              value={competitors}
              onChange={e => setCompetitors(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              placeholder="CompetitorA, CompetitorB"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !name}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg text-sm transition-colors"
          >
            {loading ? 'Saving...' : 'Get started'}
          </button>
        </div>
      </div>
    </div>
  )
}
