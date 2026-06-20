'use client'

interface Props {
  keywords: any[]
  snapshots: any[]
}

export default function StatsCards({ keywords, snapshots }: Props) {
  const total = snapshots.length
  const mentioned = snapshots.filter(s => s.brand_mentioned).length
  const sov = total > 0 ? Math.round((mentioned / total) * 100) : 0
  const positive = snapshots.filter(s => s.sentiment === 'positive').length
  const pending = keywords.filter(k => k.status === 'pending' || k.status === 'processing').length

  const cards = [
    { label: 'Share of voice', value: `${sov}%`, sub: 'last 30 days' },
    { label: 'Total scans', value: total, sub: 'all time' },
    { label: 'Positive mentions', value: positive, sub: 'last 30 days' },
    { label: 'Keywords tracked', value: keywords.length, sub: `${pending} pending` },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-gray-500 text-xs">{card.label}</p>
          <p className="text-2xl font-semibold text-white mt-1">{card.value}</p>
          <p className="text-gray-600 text-xs mt-0.5">{card.sub}</p>
        </div>
      ))}
    </div>
  )
}
