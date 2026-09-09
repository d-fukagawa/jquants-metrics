import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ],
  test: {
    exclude: [...configDefaults.exclude, 'tmp/**']
  }
})
