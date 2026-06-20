import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import LogoutButton from '@/components/LogoutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-gray-800 bg-gray-950 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-white font-semibold text-lg">
          GEO <span className="text-orange-500">Tracker</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm">{user.email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        {children}
      </main>
    </div>
  )
}
