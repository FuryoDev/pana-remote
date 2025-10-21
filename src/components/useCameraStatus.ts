import { onMounted, onUnmounted, ref, type Ref } from 'vue'

export interface CameraStatus {
  uid: string
  streaming: string
}

export interface CameraStatusState {
  status: Ref<CameraStatus | null>
  isLoading: Ref<boolean>
  isRefreshing: Ref<boolean>
  error: Ref<string | null>
  lastUpdated: Ref<Date | null>
  refresh: () => Promise<void>
}

interface CameraStatusSuccess {
  reachable: true
  status: CameraStatus
  timestamp: string
}

interface CameraStatusFailure {
  reachable: false
  error?: string
  details?: string
  timestamp: string
}

type CameraStatusResponse = CameraStatusSuccess | CameraStatusFailure

type FetchMode = 'initial' | 'refresh'

const DEFAULT_POLL_INTERVAL = 5000

export function useCameraStatus(pollInterval = DEFAULT_POLL_INTERVAL): CameraStatusState {
  const status = ref<CameraStatus | null>(null)
  const isLoading = ref(true)
  const isRefreshing = ref(false)
  const error = ref<string | null>(null)
  const lastUpdated = ref<Date | null>(null)

  let timer: ReturnType<typeof setInterval> | undefined
  let inFlight = false

  const handleResponse = (data: CameraStatusResponse) => {
    lastUpdated.value = new Date(data.timestamp)

    if (data.reachable) {
      status.value = data.status
      error.value = null
    } else {
      status.value = null
      const detail = data.details ? ` (${data.details})` : ''
      error.value = (data.error ?? 'Camera unreachable') + detail
    }
  }

  const runFetch = async (mode: FetchMode) => {
    if (inFlight) return
    inFlight = true

    if (mode === 'initial') {
      isLoading.value = true
    } else {
      isRefreshing.value = true
    }

    try {
      const response = await fetch('/api/status', {
        headers: { 'Cache-Control': 'no-cache' },
      })
      const data = (await response.json()) as CameraStatusResponse

      if (!response.ok) {
        const message = data && 'error' in data && data.error ? data.error : response.statusText
        throw new Error(message)
      }

      handleResponse(data)
    } catch (err) {
      status.value = null
      lastUpdated.value = new Date()
      error.value = err instanceof Error ? err.message : 'Unknown error while fetching camera status'
    } finally {
      inFlight = false
      isLoading.value = false
      isRefreshing.value = false
    }
  }

  const refresh = async () => {
    if (inFlight) return
    await runFetch('refresh')
  }

  onMounted(() => {
    runFetch('initial').catch((err) => {
      console.error('Failed to fetch camera status', err)
    })

    timer = setInterval(() => {
      runFetch('refresh').catch((err) => {
        console.error('Failed to refresh camera status', err)
      })
    }, pollInterval)
  })

  onUnmounted(() => {
    if (timer) {
      clearInterval(timer)
      timer = undefined
    }
  })

  return {
    status,
    isLoading,
    isRefreshing,
    error,
    lastUpdated,
    refresh,
  }
}
