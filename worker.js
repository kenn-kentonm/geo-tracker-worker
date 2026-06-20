import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ── Env validation ────────────────────────────────────────────────────────────
const REQUIRED_ENV = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY']
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

// ── Clients ───────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' })

// ── Helpers ───────────────────────────────────────────────────────────────────
function detectSentiment(response, brandName) {
  const lower = response.toLowerCase()
  const brandPresent = lower.includes(brandName.toLowerCase())
  if (!brandPresent) return 'neutral'
  const positive = ['recommend', 'best', 'excellent', 'top', 'great', 'leading', 'trusted']
  const negative = ['avoid', 'poor', 'bad', 'worst', 'unreliable', 'scam', 'overpriced']
  if (positive.some(w => lower.includes(w))) return 'positive'
  if (negative.some(w => lower.includes(w))) return 'negative'
  return 'neutral'
}

function nextRunDate(frequency) {
  const ms = frequency === 'daily' ? 86_400_000 : 7 * 86_400_000
  return new Date(Date.now() + ms).toISOString()
}

// ── Core processor ────────────────────────────────────────────────────────────
async function processKeyword(keyword, company) {
  console.log(`[worker] Processing "${keyword.phrase}" for ${company.name}`)

  // Lock the row
  await supabase
    .from('keywords')
    .update({ status: 'processing' })
    .eq('id', keyword.id)

  try {
    const prompt =
      `You are a helpful AI assistant. A user just asked: "${keyword.phrase}". ` +
      `Give a realistic, detailed recommendation as you normally would. ` +
      `Mention specific brands, tools, or services by name.`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    const brandMentioned = responseText
      .toLowerCase()
      .includes(company.name.toLowerCase())

    const competitorMentioned = (company.competitors ?? []).some(c =>
      responseText.toLowerCase().includes(c.toLowerCase())
    )

    const sentiment = detectSentiment(responseText, company.name)

    await supabase.from('geo_snapshots').insert({
      keyword_id:           keyword.id,
      engine:               'gemini',
      brand_mentioned:      brandMentioned,
      rank_position:        brandMentioned ? 1 : 0,
      full_response:        responseText,
      source_citations:     [],
      competitor_mentioned: competitorMentioned,
      sentiment
    })

    // Only reschedule if not a manual keyword
    const updates = {
      status:      'done',
      last_run_at: new Date().toISOString()
    }
    if (keyword.frequency !== 'manual') {
      updates.next_run_at = nextRunDate(keyword.frequency)
    }

    await supabase.from('keywords').update(updates).eq('id', keyword.id)

    console.log(
      `[worker] Done — brand_mentioned=${brandMentioned} ` +
      `competitor_mentioned=${competitorMentioned} sentiment=${sentiment}`
    )

  } catch (err) {
    console.error(`[worker] Error on keyword ${keyword.id}:`, err.message)
    // Reset so it retries on next poll
    await supabase
      .from('keywords')
      .update({ status: 'pending' })
      .eq('id', keyword.id)
  }
}

// ── Poll loop ─────────────────────────────────────────────────────────────────
async function poll() {
  console.log(`[worker] Poll at ${new Date().toISOString()}`)

  const { data: keywords, error } = await supabase
    .from('keywords')
    .select(`
      id, phrase, frequency, next_run_at,
      companies ( id, name, domain, competitors )
    `)
    .eq('status', 'pending')
    .lte('next_run_at', new Date().toISOString())
    .limit(5)

  if (error) {
    console.error('[worker] Poll query error:', error.message)
    return
  }

  if (!keywords?.length) {
    console.log('[worker] Nothing to process.')
    return
  }

  for (const keyword of keywords) {
    // Supabase returns the joined row as an object (not array) for many-to-one
    const company = keyword.companies
    if (!company) {
      console.warn(`[worker] No company found for keyword ${keyword.id}, skipping.`)
      continue
    }
    await processKeyword(keyword, company)
    // Respect Gemini rate limits — 2s between requests
    await new Promise(r => setTimeout(r, 2000))
  }
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
let shuttingDown = false
process.on('SIGTERM', () => {
  console.log('[worker] SIGTERM received, shutting down after current job...')
  shuttingDown = true
})

// ── Start ─────────────────────────────────────────────────────────────────────
console.log('[worker] Starting GEO Tracker worker...')
poll()
const interval = setInterval(() => {
  if (shuttingDown) {
    clearInterval(interval)
    console.log('[worker] Shutdown complete.')
    process.exit(0)
  }
  poll()
}, 5 * 60 * 1000)
