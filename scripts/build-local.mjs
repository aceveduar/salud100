// Build the local-storage version for browser tests, even with .env.local present.
process.env.VITE_SUPABASE_URL = ''
process.env.VITE_SUPABASE_PUBLISHABLE_KEY = ''
const { build } = await import('vite')
await build()
