import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import type { CameraStatusResponse } from '../types/camera'

const status = ref<CameraStatusResponse | null>(null)
const isLoading = ref(false)
const error = ref<string | null>(null)
const lastUpdated = ref<number | null>(null)

let pollTimer: ReturnType<typeof setInterval> | null = null
let subscribers = 0
let inflight: Promise<void> | null = null
let pollInterval = 5000

async function fetchStatus() {
  if (inflight) {
    return inflight
  }

  inflight = (async () => {
    isLoading.value = true
    try {
      const response = await fetch('/api/camera/status')
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error ?? `HTTP ${response.status}`)
      }

      status.value = payload as CameraStatusResponse
      error.value = null
      lastUpdated.value = Date.now()
    } catch (err: any) {
      error.value = err?.message ?? 'Impossible de récupérer le statut de la caméra'
    } finally {
      isLoading.value = false
      inflight = null
    }
  })()

  return inflight
}

function startPolling() {
  if (pollTimer) {
    return
  }

  fetchStatus()
  pollTimer = setInterval(() => {
    void fetchStatus()
  }, pollInterval)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

export interface CameraStatusComposable {
  status: Ref<CameraStatusResponse | null>
  isLoading: Ref<boolean>
  error: Ref<string | null>
  lastUpdated: Ref<number | null>
  refresh: () => Promise<void>
}

export function useCameraStatus(interval = 5000): CameraStatusComposable {
  pollInterval = interval
  subscribers += 1
  startPolling()

  onMounted(() => {
    startPolling()
  })

  onUnmounted(() => {
    subscribers -= 1
    if (subscribers <= 0) {
      stopPolling()
    }
  })

  return {
    status,
    isLoading,
    error,
    lastUpdated,
    refresh: () => fetchStatus(),
  }
}
