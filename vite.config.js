import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const clean = (v = '') => v.trim().replace(/^["']|["']$/g, '')
// .env is re-read on every request, so editing it needs no restart
const env = () => loadEnv('development', process.cwd(), '')
const mapKey = () => clean(env().FIRMS_MAP_KEY)
const token = () => clean(env().EARTHDATA_TOKEN)

// /keycheck tells the browser exactly why the key fails (never returns the key itself)
const keyCheck = () => ({
  name: 'keycheck',
  configureServer(server) {
    const k = mapKey()
    console.log(k ? `FIRMS_MAP_KEY loaded (${k.length} chars)` : 'FIRMS_MAP_KEY is EMPTY - fix .env')
    server.middlewares.use('/keycheck', async (_req, res) => {
      const key = mapKey()
      let message
      if (!key) {
        message = 'FIRMS_MAP_KEY is empty. Make a file named exactly ".env" (not ".env.txt") in the project folder with one line: FIRMS_MAP_KEY=yourkey'
      } else {
        try {
          const r = await fetch(`https://firms.modaps.eosdis.nasa.gov/mapserver/mapkey_status/?MAP_KEY=${key}`)
          const t = (await r.text()).slice(0, 200)
          message = `Key loaded (${key.length} chars; FIRMS keys are 32). NASA says: ${t}`
        } catch (e) {
          message = `Could not reach NASA to check key: ${e.message}`
        }
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ message }))
    })
  },
})

export default defineConfig({
  plugins: [react(), keyCheck()],
  server: {
    proxy: {
      '/firms': {
        target: 'https://firms.modaps.eosdis.nasa.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/firms/, `/api/area/csv/${mapKey()}`),
      },
      '/nrt3': {
        target: 'https://nrt3.modaps.eosdis.nasa.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nrt3/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (req) => req.setHeader('Authorization', `Bearer ${token()}`))
        },
      },
    },
  },
})
