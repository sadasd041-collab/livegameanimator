const args = Object.fromEntries(process.argv.slice(2).map((item) => {
  const [key, value = 'true'] = item.replace(/^--/, '').split('=')
  return [key, value]
}))

const durationSeconds = Math.max(5, Number(args.seconds || Number(args.minutes || 30) * 60))
const intervalMs = Math.max(1000, Number(args.interval || 5000))
const healthUrl = args.url || 'http://127.0.0.1:8787/api/diagnostics'
const maxHeapGrowthMb = Math.max(10, Number(args['max-heap-growth'] || 100))
const startedAt = Date.now()
let firstHeap = null
let checks = 0

while ((Date.now() - startedAt) / 1000 < durationSeconds) {
  const response = await fetch(healthUrl)
  if (!response.ok) throw new Error(`Tanılama isteği başarısız: HTTP ${response.status}`)
  const diagnostics = await response.json()
  if (!diagnostics.ok || !diagnostics.persistence?.ready) throw new Error('API veya kalıcı kayıt hazır değil.')
  const heap = Number(diagnostics.memoryMb?.heapUsed || 0)
  if (firstHeap === null) firstHeap = heap
  if (heap - firstHeap > maxHeapGrowthMb) throw new Error(`Bellek büyümesi sınırı aştı: ${heap - firstHeap} MB`)
  checks += 1
  process.stdout.write(`\r${checks} kontrol · ${heap} MB heap · ${Math.round(diagnostics.uptimeSeconds)} sn çalışma`)
  await new Promise((resolve) => setTimeout(resolve, intervalMs))
}

process.stdout.write('\n')
console.log(`Dayanıklılık testi geçti: ${checks} kontrol, ${durationSeconds} saniye.`)
