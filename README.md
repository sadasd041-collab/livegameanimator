# Live Game Animator

YouTube ve TikTok canlı yayın yorumlarını OBS üzerinde oynanan etkileşimli oyunlara dönüştüren yerel yayın otomasyonu.

## Özellikler

- 9 oyun: Boss Raid, Ülke Çarkı, Halı Saha, Bilgi Yarışması, Emoji Bil, Kelime Avı, Sayı Kapışması, Falling Pickaxe ve Tetris
- YouTube canlı yorumları ve TikTok/harici webhook köprüsü
- OBS WebSocket ve Browser Source desteği
- 16:9 ve 9:16 yayın görünümü
- Otomatik rotasyon, sonsuz mod, XP/liderlik, moderasyon ve analiz
- Komutlarda `!` işareti isteğe bağlıdır

## Kurulum

Gereksinimler: Node.js 20+, OBS Studio 28+ ve Windows 10/11.

```bash
npm ci
npm run dev
```

- Kontrol paneli: `http://127.0.0.1:5173/`
- OBS Browser Source: `http://127.0.0.1:5173/?stage=1`

Üretim kontrolü:

```bash
npm run check:release
```

API anahtarları, OBS parolası ve yayın anahtarı yalnızca çalışan uygulamanın belleğinde tutulur. Gerçek kimlik bilgilerini veya `.live-game-animator/` klasörünü Git'e eklemeyin.

## Lisans

[Apache License 2.0](LICENSE). Üçüncü taraf bilgileri için [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) dosyasına bakın.
