import '@testing-library/jest-dom/vitest'

export class MockEventSource {
  static latest: MockEventSource | null = null
  listeners = new Map<string, Set<(event: MessageEvent) => void>>()

  constructor() {
    MockEventSource.latest = this
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  emit(type: string, payload: unknown) {
    const event = { data: JSON.stringify(payload) } as MessageEvent
    this.listeners.get(type)?.forEach((listener) => listener(event))
  }

  close() {}
}

Object.defineProperty(globalThis, 'EventSource', { value: MockEventSource, configurable: true })
