import { isEnglish } from '../locale'

const raidBossesTr = [
  { id: 'korzar', name: 'Korzar', title: 'Lav Muhafızı', ability: 'Magma Yumruğu', color: '#ff684e', secondary: '#ffbe55', maxHp: 1100, image: '/bosses/korzar.png' },
  { id: 'vargul', name: 'Vargul', title: 'Buz Devi', ability: 'Donmuş Nefes', color: '#64d8ff', secondary: '#d8f7ff', maxHp: 1250, image: '/bosses/vargul.png' },
  { id: 'nyxara', name: 'Nyxara', title: 'Gölge Ejderi', ability: 'Gece Alevi', color: '#b774ff', secondary: '#ff70dc', maxHp: 1400, image: '/bosses/nyxara.png' },
  { id: 'thundrok', name: 'Thundrok', title: 'Fırtına Titanı', ability: 'Yıldırım Çağrısı', color: '#ffd351', secondary: '#75caff', maxHp: 1200, image: '/bosses/thundrok.png' },
  { id: 'morgath', name: 'Morgath', title: 'Bataklık Hidrası', ability: 'Zehir Seli', color: '#75df65', secondary: '#d5ff69', maxHp: 1350, image: '/bosses/morgath.png' },
  { id: 'omega', name: 'OMEGA-9', title: 'Mekanik Savaş Lordu', ability: 'Plazma Topu', color: '#ff526f', secondary: '#69f6ff', maxHp: 1500, image: '/bosses/omega.png' },
] as const

const raidBossesEn = [
  { id: 'korzar', name: 'Korzar', title: 'Lava Guardian', ability: 'Magma Fist', color: '#ff684e', secondary: '#ffbe55', maxHp: 1100, image: '/bosses/korzar.png' },
  { id: 'vargul', name: 'Vargul', title: 'Ice Giant', ability: 'Frozen Breath', color: '#64d8ff', secondary: '#d8f7ff', maxHp: 1250, image: '/bosses/vargul.png' },
  { id: 'nyxara', name: 'Nyxara', title: 'Shadow Dragon', ability: 'Night Flame', color: '#b774ff', secondary: '#ff70dc', maxHp: 1400, image: '/bosses/nyxara.png' },
  { id: 'thundrok', name: 'Thundrok', title: 'Storm Titan', ability: 'Lightning Call', color: '#ffd351', secondary: '#75caff', maxHp: 1200, image: '/bosses/thundrok.png' },
  { id: 'morgath', name: 'Morgath', title: 'Swamp Hydra', ability: 'Poison Flood', color: '#75df65', secondary: '#d5ff69', maxHp: 1350, image: '/bosses/morgath.png' },
  { id: 'omega', name: 'OMEGA-9', title: 'Mechanical Warlord', ability: 'Plasma Cannon', color: '#ff526f', secondary: '#69f6ff', maxHp: 1500, image: '/bosses/omega.png' },
] as const

export const raidBosses = isEnglish ? raidBossesEn : raidBossesTr
