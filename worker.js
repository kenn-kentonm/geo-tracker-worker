import { createClient } from '@supabase/supabase-js'
import { GoogleGenerativeAI } from '@google/generative-ai'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

async function processKeyword(keyword, company) {
  console.log(`Processing: "${keyword.phrase}" for ${company.name}`)

  // Mark as processing
  await supabase
    .from('keywords')
    .update({ status: 'processing' })
    .eq('id', keyword.id)

  try {
    // Query Gemini
    const prompt = `You are a user searching for products or services. 
Search query: "${keyword.phrase}"
Give a helpful, realistic recommendation response as if you are an AI assistant answering this query right now. 
Include specific brand or product names you would recommend.`

    const result = await model.generateContent(prompt)
    const response = result.response.text()

    // Analyse response
    const brandMentioned = response.toLowerCase().includes(company.name.toLowerCase())
    const competitorMentioned = company.competitors?.some(c =>
      response.toLowerCase().includes(c.toLowerCase())
    )

    // Simple sentiment
    const positiveWords = ['recommend', 'best', 'excellent', 'top', 'great', 'leading']
    const negativeWords = ['avoid', 'poor', 'bad', 'worst', 'unreliable']
    const lower = response.toLowerCase()
    const sentiment = positiveWords.some(w => lower.includes(w)) && brandMentioned
      ? 'positive'
      : negativeWords.some(w => lower.includes(w)) && brandMentioned
      ? 'negative'
      : 'neutral'

    // Save snapshot
    await supabase.from('geo_snapshots').insert({
      keyword_id: keyword.id,
      engine: 'gemini',
      brand_mentioned: brandMentioned,
      rank_position: brandMentioned ? 1 : 0,
      full_response: response,
      source_citations: [],
      competitor_mentioned: competitorMentioned,
      sentiment
    })

    // Schedule next run
    const nextRun = keyword.frequency === 'daily'
      ? new Date(Date.now() + 86400000)
      : new Date(Date.now() + 604800000) // weekly

    await supabase
      .from('keywords')
      .update({
        status: 'done',
        last_run_at: new Date().toISOString(),
        next_run_at: nextRun.toISOString()
      })
      .eq('id', keyword.id)

    console.log(`Done: brand_mentioned=${brandMentioned}, sentiment=${sentiment}`)

  } catch (err) {
    console.error(`Failed for keyword ${keyword.id}:`, err.message)
    // Reset to pending so it retries next poll
    await supabase
      .from('keywords')
      .update({ status: 'pending' })
      .eq('id', keyword.id)
  }
}

async function poll() {
  console.log('Polling for pending keywords...')

  const { data: keywords, error } = await supabase
    .from('keywords')
    .select('*, companies(*)')
    .eq('status', 'pending')
    .lte('next_run_at', new Date().toISOString())
    .limit(5) // process 5 at a time to stay within rate limits

  if (error) {
    console.error('Poll error:', error.message)
    return
  }

  if (!keywords || keywords.length === 0) {
    console.log('No pending keywords.')
    return
  }

  for (const keyword of keywords) {
    await processKeyword(keyword, keyword.companies)
    await new Promise(r => setTimeout(r, 2000)) // 2s between requests
  }
}

// Poll every 5 minutes
poll()
setInterval(poll, 5 * 60 * 1000)
