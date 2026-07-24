export type SoundCue = 'round' | 'vote' | 'success' | 'goal' | 'spin'

let audioContext: AudioContext | null = null

const cueNotes: Record<SoundCue, Array<[number, number, number]>> = {
  round: [[440, 0, .11], [660, .12, .14]],
  vote: [[520, 0, .08]],
  success: [[523, 0, .12], [659, .12, .12], [784, .24, .2]],
  goal: [[392, 0, .12], [523, .1, .12], [784, .2, .28]],
  spin: [[330, 0, .08], [392, .08, .08], [466, .16, .1]],
}

export function playSoundCue(cue: SoundCue, volume = .45) {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return
  try {
    audioContext ||= new AudioContext()
    const context = audioContext
    if (context.state === 'suspended') void context.resume()
    const start = context.currentTime + .01
    for (const [frequency, delay, duration] of cueNotes[cue]) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = cue === 'goal' ? 'sawtooth' : cue === 'spin' ? 'triangle' : 'sine'
      oscillator.frequency.setValueAtTime(frequency, start + delay)
      gain.gain.setValueAtTime(0, start + delay)
      gain.gain.linearRampToValueAtTime(Math.max(.01, Math.min(1, volume)) * .13, start + delay + .01)
      gain.gain.exponentialRampToValueAtTime(.001, start + delay + duration)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(start + delay)
      oscillator.stop(start + delay + duration + .03)
    }
  } catch {
    // Ses desteği olmayan tarayıcı kaynaklarında oyun sessiz devam eder.
  }
}
