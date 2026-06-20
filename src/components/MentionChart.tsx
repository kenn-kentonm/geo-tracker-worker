'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

interface Props {
  snapshots: any[]
}

export default function MentionChart({ snapshots }: Props) {
  // Group by date
  const byDate: Record<string, { total: number; mentioned: number }> = {}

  for (const s of snapshots) {
    const date = new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    if (!byDate[date]) byDate[date] = { total: 0, mentioned: 0 }
    byDate[date].total++
    if (s.brand_mentioned) byDate[date].mentioned++
  }

  const data = Object.entries(byDate).map(([date, { total, mentioned }]) => ({
    date,
    sov: total > 0 ? Math.round((mentioned / total) * 100) : 0
  }))

  if (data.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
        No scan data yet. Add keywords and run your first scan.
      </div>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h2 className="text-sm font-medium text-gray-400 mb-4">Share of voice — last 30 days</h2>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 11 }} />
          <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} unit="%" domain={[0, 100]} />
          <Tooltip
            contentStyle={{ backgroundColor: '#111827', border: '1px solid #1f2937', borderRadius: 8 }}
            labelStyle={{ color: '#9ca3af' }}
            itemStyle={{ color: '#f97316' }}
          />
          <Line type="monotone" dataKey="sov" stroke="#f97316" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
