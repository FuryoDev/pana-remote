import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
    CAM_HOST: z.string().min(1),
    CAM_PORT: z.string().min(1),
    CAM_PROTO: z.enum(['http', 'https']).default('http'),
    CAM_USER: z.string().default('admin'),
    CAM_PASS: z.string().default(''),
    REQUEST_TIMEOUT_MS: z.coerce.number().default(3000),
    MIN_CMD_INTERVAL_MS: z.coerce.number().default(60),
})

const parsed = EnvSchema.safeParse(process.env)
if(!parsed.success) {
    console.error('Invalid env: ', parsed.error.flatten().fieldErrors)
    process.exit(1)
}

export const env = parsed.data
export const camBase = `${env.CAM_PROTO}://${env.CAM_HOST}:${env.CAM_PORT}`