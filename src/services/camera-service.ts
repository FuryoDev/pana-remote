import { PanasonicClient } from '../clients/panasonicClient.js'

export class CameraService {
    constructor(private client: PanasonicClient) {}

    // 1) I1: Zoom + Stop + Recall preset
    async zoom(dir: 'in'|'out'|'stop') {
        const cmd = dir === 'in' ? 'Z=1' : dir === 'out' ? 'Z=2' : 'Z50'
        return this.client.aw_ptz(cmd, '1')
    }

    async presetRecall(n: number) {
        const nn = String(n).padStart(2, '0')
        return this.client.aw_ptz(`R${nn}`, '1')
    }

    async ptzStop() {
        return this.client.aw_ptz('#PTS', '1')
    }

    // 2) Prochaines itérations (tu auras déjà la base prête)
    async colorBar(on: boolean) { return this.client.aw_cam(`DCB:${on?1:0}`, '1') }
    async autofocus(on: boolean){ return this.client.aw_cam(`OAF:${on?1:0}`, '1') }

    async stream(mode: 'rtmp'|'srt'|'ts', cmd: 'start'|'stop') {
        if (mode === 'rtmp') return this.client.rtmpCtrl(cmd)
        if (mode === 'srt')  return this.client.srtCtrl(cmd)
        return this.client.tsCtrl(cmd)
    }

    async status() {
        const uid = await this.client.getUid()
        const streaming = await this.client.getStreamStat(uid)
        return { uid, streaming }
    }
}
