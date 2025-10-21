import 'dotenv/config'
import { z } from 'zod'

const EnvSchema = z.object({
  CAM_HOST: z.string().min(1),
  CAM_PORT: z.coerce.number().int().nonnegative(),
  CAM_PROTO: z.enum(['http', 'https']).default('http'),
  CAM_USER: z.string().default('admin'),
  CAM_PASS: z.string().default(''),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  MIN_CMD_INTERVAL_MS: z.coerce.number().int().nonnegative().default(60),
})

type EnvShape = z.infer<typeof EnvSchema>

const parsed = EnvSchema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env: EnvShape = parsed.data
export const camBaseUrl = `${env.CAM_PROTO}://${env.CAM_HOST}:${env.CAM_PORT}`
