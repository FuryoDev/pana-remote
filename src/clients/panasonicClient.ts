import { env, camBase} from '../config.ts'
import { log } from '../logger.ts'


function authHeader() {
    if(!env.CAM_USER) return {}
    const t = Buffer.from(`${env.CAM_USER}:${env.CAM_PASS}`).toString('base64')
    return { Authorization: `Basic ${t}` }
}

function buildUrl(path: string, params: Record<string, string>) {
    const u = new URL(path, camBase)
    for(const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
    return u.toString()
}

export class PanasonicClient {
    #lastSent = 0

    private async get(path: string, params: Record<string, string>) {
        const now = Date.now()
        const delta = now - this.#lastSent
        if (delta < env.MIN_CMD_INTERVAL_MS) {
            await new Promise(r => setTimeout(r, env.MIN_CMD_INTERVAL_MS - delta))
        }
        const url = buildUrl(path, params)
        log.debug({ url }, 'GET')

        const ctrl = new AbortController()
        const to = setTimeout(() => ctrl.abort('timeout'), env.REQUEST_TIMEOUT_MS)

        try {
            const res = await fetch(url, { headers: authHeader(), signal: ctrl.signal as any })
            const text = await res.text()
            log.debug({ status: res.status, text }, 'RES')
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`)
            return text.trim()
        } finally {
            clearTimeout(to)
            this.#lastSent = Date.now()
        }
    }

    // === Bas niveau “brut” ===
    aw_ptz(cmd: string, res: string = '1') {
        return this.get('/cgi-bin/aw_ptz', { cmd, res })
    }
    aw_cam(cmd: string, res: string = '1') {
        return this.get('/cgi-bin/aw_cam', { cmd, res })
    }

    // === Endpoints utilitaires ===
    rtmpCtrl(cmd: 'start'|'stop') { return this.get('/cgi-bin/rtmp_ctrl', { cmd }) }
    srtCtrl(cmd: 'start'|'stop')  { return this.get('/cgi-bin/srt_ctrl',  { cmd }) }
    tsCtrl(cmd: 'start'|'stop')   { return this.get('/cgi-bin/ts_ctrl',   { cmd }) }

    getUid()       { return this.get('/cgi-bin/getuid', { t: Date.now().toString() }) }
    getStreamStat(uid: string) { return this.get('/cgi-bin/get_streaming_status', { UID: uid }) }
}

