import { z } from 'zod'

const envSchema = z.object({
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default('/sign-in'),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default('/sign-up'),
  DATABASE_URL: z.string().min(1),
  DATABASE_POOLED_URL: z.string().min(1),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
})

export const env = envSchema.parse(process.env)
