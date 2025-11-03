import { ref, watch } from 'vue'

const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

type Serializer<T> = {
  read(raw: string): T
  write(value: T): string
}

const defaultSerializer: Serializer<unknown> = {
  read(raw) {
    try {
      return JSON.parse(raw)
    } catch (error) {
      console.warn('[storage] Failed to parse value from localStorage:', error)
      return null
    }
  },
  write(value) {
    return JSON.stringify(value)
  },
}

export function usePersistentRef<T>(
  key: string,
  defaultValue: T,
  serializer: Serializer<T> = defaultSerializer as Serializer<T>,
) {
  const state = ref<T>(defaultValue)

  if (isBrowser) {
    const raw = window.localStorage.getItem(key)
    if (raw !== null) {
      try {
        state.value = serializer.read(raw)
      } catch (error) {
        console.warn(`[storage] Unable to read key "${key}" from localStorage`, error)
        state.value = defaultValue
      }
    }

    watch(
      state,
      (value) => {
        try {
          window.localStorage.setItem(key, serializer.write(value))
        } catch (error) {
          console.warn(`[storage] Unable to persist key "${key}" to localStorage`, error)
        }
      },
      { deep: true },
    )
  }

  return state
}
