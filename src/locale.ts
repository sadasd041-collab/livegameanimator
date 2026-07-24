export type AppLanguage = 'tr' | 'en'

const params = new URLSearchParams(window.location.search)
export const appLanguage: AppLanguage = params.get('lang') === 'en' ? 'en' : 'tr'
export const isEnglish = appLanguage === 'en'

export function switchLanguage(language: AppLanguage) {
  const url = new URL(window.location.href)
  if (language === 'en') url.searchParams.set('lang', 'en')
  else url.searchParams.delete('lang')
  window.location.assign(url)
}

const exact: Record<string, string> = {
  'Ana menü': 'Main menu', 'Türkçe sürüme geç': 'Switch to Turkish',
  'Kontrol merkezi': 'Control Center', 'Yayınlar': 'Broadcasts', 'Analizler': 'Analytics',
  'OYUN SAHNELERİ · 9': 'GAME SCENES · 9',
  'Yayın ayarları': 'Broadcast Settings', 'Takımları ayarla': 'Choose Teams',
  'Oyunları düzenle': 'Edit Games', 'Bağlantıları yapılandır': 'Configure Connections',
  'Bağlantıyı yönet': 'Manage Connection', 'Otomasyonu dene': 'Start Automation',
  'Yayını durdur': 'Stop Broadcast', 'Ayarları aç': 'Open Settings',
  'Yayın seslerini kapat': 'Mute Broadcast Sounds', 'Yayın seslerini aç': 'Enable Broadcast Sounds',
  'YORUMLAR KAPALI': 'COMMENTS OFF', 'YORUMLAR BAĞLI': 'COMMENTS CONNECTED',
  'OBS BAĞLI DEĞİL': 'OBS NOT CONNECTED', 'OBS BAĞLI': 'OBS CONNECTED',
  'İyi akşamlar,': 'Good evening,', 'yayına hazırız.': 'ready to broadcast.',
  'YAYIN KONTROLÜ': 'BROADCAST CONTROL', 'AKTİF SAHNE': 'ACTIVE SCENE',
  'YAYIN DURUMU': 'BROADCAST STATUS', 'OTOMASYON': 'AUTOMATION',
  'Başlatılmayı bekliyor': 'Waiting to start', 'Aktif ve çalışıyor': 'Active and running',
  'YouTube yayın': 'YouTube broadcast', 'Yorum motoru': 'Comment engine',
  'Oyun motoru': 'Game engine', 'Hazır': 'Ready', 'Bağlı': 'Connected',
  'Kapalı': 'Off', '9 oyun hazır': '9 games ready',
  'SON AKTİVİTE': 'RECENT ACTIVITY', 'CANLI YORUM MOTORU': 'LIVE COMMENT ENGINE',
  'Sahne hazır': 'Scene ready', 'Yayın motoru beklemede': 'Broadcast engine is waiting',
  'Soru havuzu yüklendi': 'Question pool loaded', '6 kategori aktif': '6 categories active',
  'Oyun kütüphanesi hazır': 'Game library ready', 'şimdi': 'now', '1 dk': '1 min', '2 dk': '2 min',
  'Yorum bağlantısı bekleniyor': 'Waiting for comment connection', 'Henüz yorum yok': 'No comments yet',
  'Yorumları bağla': 'Connect Comments', 'mesaj': 'messages', 'oyuncu': 'players',
  'Test için ayarlardan Demo yorumlarını başlatın.': 'Start demo comments from Settings to test the games.',
  'YORUM KOMUTLARI': 'COMMENT COMMANDS', 'isteğe bağlı': 'optional',
  'Yoruma doğrudan yaz': 'Type directly in chat', 'OYUN KÜTÜPHANESİ': 'GAME LIBRARY',
  'Otomatik geçiş': 'Auto rotation', 'ETKİLEŞİM': 'ENGAGEMENT',
  '9 sahneli rotasyon': '9-scene rotation', 'AKTİF': 'ACTIVE',
  'HAFTALIK LİG': 'WEEKLY LEAGUE', 'İlk puanları bekliyor': 'Waiting for the first points',
  'Gerçek etkileşim modu': 'Real engagement mode',
  'Tekrar oy açık · spam beklemesi aktif': 'Repeat votes enabled · anti-spam cooldown active',
  'SONRAKİ SAHNE': 'NEXT SCENE', 'ADMİN MODU': 'ADMIN MODE', 'Sonsuz döngü': 'Infinite mode',
  'ÖNİZLEME': 'PREVIEW', 'Yerel': 'Local', 'CANLI': 'LIVE',
  'YORUM GÜCÜ': 'COMMENT POWER', 'Takımını seç:': 'Choose your team:',
  'TUR SONU': 'ROUND OVER', 'Seviye puanı': 'Level points', 'Topluluk üyesi': 'Community member',
  'SONRAKİ OYUNU SEN SEÇ': 'CHOOSE THE NEXT GAME',
  'Yoruma oy 1, oy 2 veya oy 3 yaz': 'Type vote 1, vote 2 or vote 3 in chat',
  'YAYIN KURULUMU': 'BROADCAST SETUP', 'OBS, RTMP ve canlı yorumlar': 'OBS, RTMP and live comments',
  'OBS WebSocket': 'OBS WebSocket', 'Yayın hedefi ve bilgileri': 'Destination and broadcast details',
  'YouTube canlı yorumları': 'YouTube live comments', 'TikTok / harici yorum köprüsü': 'TikTok / external comment bridge',
  'Yayın başlığı': 'Broadcast title', 'Açıklama': 'Description', 'Etiketler': 'Tags',
  'RTMP(S) sunucusu': 'RTMP(S) server', 'Yayın anahtarı': 'Stream key',
  'YouTube yorumlarını bağla': 'Connect YouTube comments', 'Demo yorumlarını başlat': 'Start demo comments',
  'Demo yorumlarını durdur': 'Stop demo comments', 'OBS’ye bağlan': 'Connect to OBS',
  'OBS bağlantısını kes': 'Disconnect OBS', 'Ayarları kullan': 'Apply Settings',
  'Kapat': 'Close', 'Moderasyon': 'Moderation', 'Otomatik moderasyon açık': 'Automatic moderation enabled',
  'Yasaklı kelimeler': 'Blocked words', 'Kullanıcı bekleme süresi (ms)': 'User cooldown (ms)',
  'Azami mesaj uzunluğu': 'Maximum message length', 'Kaydet': 'Save',
  'YAYIN GEÇMİŞİ': 'BROADCAST HISTORY', 'KALICI ANALİZ': 'PERSISTENT ANALYTICS',
  'Yorum ve oyun performansı': 'Comment and game performance',
  'Toplam mesaj': 'Total messages', 'Geçerli komut': 'Valid commands',
  'Tekil izleyici': 'Unique viewers', 'Engellenen': 'Blocked',
  'OYUN DAĞILIMI': 'GAME DISTRIBUTION', 'En çok etkileşim alan oyunlar': 'Most engaging games',
  'SİSTEM': 'SYSTEM', 'Dayanıklılık durumu': 'Reliability status',
  'Çalışma süresi': 'Uptime', 'Bellek kullanımı': 'Memory usage', 'Kalıcı kayıt': 'Persistence',
  'Son güncelleme': 'Last update', 'XP ve seviye liderleri': 'XP and level leaders',
  'Takım seçimi': 'Team Selection', 'Ev sahibini seç': 'Choose Home Team',
  'Deplasman takımını seç': 'Choose Away Team', 'Eşleşmeyi kullan': 'Use Matchup',
  'Oyun sırası ve süreleri': 'Game Order and Durations',
  'Oyun sırası': 'Game order', 'Tur süresi': 'Round duration',
  'OYUN KOMUTLARI': 'GAME COMMANDS', 'BİR SONRAKİ OYUN': 'NEXT GAME',
  'SAYI KAPIŞMASI': 'NUMBER BATTLE', 'HANGİ TARAF KAZANACAK?': 'WHICH SIDE WILL WIN?',
  'Yoruma 1 veya 2 yaz': 'Type 1 or 2 in chat', 'İlk oyu bekliyor': 'Waiting for the first vote',
  'YORUMLARLA ORTAK OYUN': 'COMMUNITY-CONTROLLED GAME', 'TOPLULUK TETRİS': 'COMMUNITY TETRIS',
  'Tek tahta, binlerce oyuncu. Satırları birlikte tamamlayın.': 'One board, thousands of players. Complete the lines together.',
  'SKOR': 'SCORE', 'SATIR': 'LINES', 'SONRAKİ': 'NEXT', 'YORUM': 'COMMENTS',
  'DÜNYA DERBİSİ': 'WORLD DERBY', 'Ülke adını yaz, bayrağını çarka taşı': 'Type a country name and send its flag to the wheel',
  'SIRADAKİ ÜLKE': 'NEXT COUNTRY', 'EMOJİ ŞİFRESİ': 'EMOJI RIDDLE',
  'CEVAP': 'ANSWER', 'İlk doğru cevabı bekliyor': 'Waiting for the first correct answer',
  'KELİME AVI': 'WORD HUNT', 'DOĞRU CEVAP': 'CORRECT ANSWER',
  'YORUMA KELİMEYİ YAZ': 'TYPE THE WORD IN CHAT', 'Kazanan aranıyor': 'Waiting for a winner',
  'CEVAP SÜRESİ': 'ANSWER TIME', 'Cevabını sohbete yaz': 'Type your answer in chat',
  'TOPLULUK RAID’İ': 'COMMUNITY RAID', 'BOSS YENİLDİ!': 'BOSS DEFEATED!',
  'TOPLULUK YENİLDİ!': 'COMMUNITY DEFEATED!', 'BOSS YETENEĞİ': 'BOSS ABILITY',
  'BOSS CANI': 'BOSS HP', 'TOPLULUK CANI': 'COMMUNITY HP', 'BOSS SALDIRISI': 'BOSS ATTACK',
  'TOPLULUK İYİLEŞTİ': 'COMMUNITY HEALED', 'TOPLULUK GERİ DÖNDÜ': 'COMMUNITY REVIVED',
  'DERİNLİK': 'DEPTH', 'GANİMET': 'LOOT', 'HIZLI': 'FAST', 'YAVAŞ': 'SLOW',
  'NORMAL': 'NORMAL', 'BÜYÜK': 'GIANT', 'TAHTA': 'WOOD', 'TAŞ': 'STONE',
  'DEMİR': 'IRON', 'ALTIN': 'GOLD', 'ELMAS': 'DIAMOND',
}

const replacements: Array<[RegExp, string]> = [
  [/OYUN SAHNELERİ/g, 'GAME SCENES'], [/YORUM GÜCÜ/g, 'COMMENT POWER'],
  [/Takımını seç:/g, 'Choose your team:'], [/yorum komutları/g, 'comment commands'],
  [/oyun hazır/g, 'games ready'], [/sahneli rotasyon/g, '-scene rotation'],
  [/\bveya\b/gi, 'or'],
  [/\bTur (\d+)/gi, 'Round $1'], [/\bTUR (\d+)/g, 'ROUND $1'],
  [/(\d+) oyun hazır/g, '$1 games ready'], [/(\d+) oyun rotasyonda/g, '$1 games in rotation'],
  [/(\d+) sahneli rotasyon/g, '$1-scene rotation'], [/(\d+) mesaj/g, '$1 messages'],
  [/(\d+) oyuncu/g, '$1 players'], [/(\d+) oy/g, '$1 votes'], [/(\d+) cevap/g, '$1 answers'],
  [/(\d+) deneme/g, '$1 attempts'], [/(\d+) tahmin/g, '$1 guesses'],
  [/(\d+) saldırı/g, '$1 attacks'], [/(\d+) iyileştirme/g, '$1 heals'], [/(\d+) boss vuruşu/g, '$1 boss hits'],
  [/ yorum yaptı/g, ' commented'], [/ oyunu kullandı/g, ' voted'], [/ oyunu kullandı!/g, ' voted!'],
  [/ saniye/g, ' seconds'], [/ sn\b/g, ' sec'], [/ puan\b/g, ' points'],
  [/Seviye (\d+)/g, 'Level $1'], [/Tekil oyuncu:/g, 'Unique players:'],
  [/Yorumların oyuna dönüştüğü interaktif canlı yayın\./g, 'An interactive live stream where comments become gameplay.'],
  [/canlı yayın, interaktif oyun, yarışma/g, 'live stream, interactive game, quiz'],
]

export function translateText(value: string) {
  const trimmed = value.trim()
  let translated = exact[trimmed] ?? value
  for (const [pattern, replacement] of replacements) translated = translated.replace(pattern, replacement)
  return translated
}

function translateElement(root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (node.nodeValue?.trim()) node.nodeValue = translateText(node.nodeValue)
    node = walker.nextNode()
  }
  root.querySelectorAll?.<HTMLElement>('[aria-label],[title],[placeholder]').forEach((element) => {
    for (const attribute of ['aria-label', 'title', 'placeholder']) {
      const value = element.getAttribute(attribute)
      if (value) element.setAttribute(attribute, translateText(value))
    }
  })
}

export function installEnglishLocale() {
  document.documentElement.lang = appLanguage
  if (!isEnglish) return
  translateElement(document)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData' && record.target.nodeValue?.trim()) {
        const translated = translateText(record.target.nodeValue)
        if (translated !== record.target.nodeValue) record.target.nodeValue = translated
      }
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE && node.nodeValue?.trim()) node.nodeValue = translateText(node.nodeValue)
        else if (node instanceof HTMLElement) translateElement(node)
      })
    }
  })
  observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true })
}
