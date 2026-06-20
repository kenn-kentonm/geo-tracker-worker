import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StatsCards from '@/components/StatsCards'
import MentionChart from '@/components/MentionChart'
import KeywordsTable from '@/components/KeywordsTable'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get company
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!company) redirect('/onboarding')

  // Get keywords with latest snapshot
  const { data: keywords } = await supabase
    .from('keywords')
    .select(`
      *,
      geo_snapshots (
        id, brand_mentioned, sentiment, engine, created_at
      )
    `)
    .eq('company_id', company.id)
    .order('created_at', { ascending: false })

  // Get snapshots for chart (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: snapshots } = await supabase
    .from('geo_snapshots')
    .select('brand_mentioned, created_at, engine')
    .gte('created_at', thirtyDaysAgo)
    .in('keyword_id', (keywords ?? []).map(k => k.id))
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">{company.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{company.domain}</p>
        </div>
        <Link
          href="/dashboard/keywords/new"
          className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + Add keyword
        </Link>
      </div>

      <StatsCards keywords={keywords ?? []} snapshots={snapshots ?? []} />
      <MentionChart snapshots={snapshots ?? []} />
      <KeywordsTable keywords={keywords ?? []} companyId={company.id} />
    </div>
  )
}
