import { Hono } from 'hono'
import { renderer } from './renderer'
import type { Bindings } from './types'
import { homeRoute }   from './routes/home'
import { stockRoute }  from './routes/stock'
import { syncRoute }   from './routes/sync'
import { screenRoute } from './routes/screen'

const app = new Hono<{ Bindings: Bindings }>()

app.use(renderer)

app.route('/',         homeRoute)
app.route('/stock',    stockRoute)
app.route('/api/sync', syncRoute)
app.route('/screen',   screenRoute)

export default app
