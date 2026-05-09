import { Hono, Context } from 'hono'
import { jsx } from 'hono/jsx'
import { jsxRenderer } from 'hono/jsx-renderer'
import { Style } from 'hono/css'

import type { Bindings } from './types'
import { globalStyles } from './styles'

import { homePage } from './routes/home'
import { newConfigRoute } from './routes/new'
import { settingsPageRoute, settingsApiRoute, deleteApiRoute } from './routes/settings'
import { webhookRoute } from './routes/webhook'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', jsxRenderer(({ children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>DinkPlugin Webhook Filter</title>
      <Style>{globalStyles}</Style>
    </head>
    <body>
      <div class="container">
        {children}
      </div>
    </body>
  </html>
  )))

// Homepage
app.get('/', (c: Context) => homePage(c))

// Create new config
app.get('/new', async (c: Context) => {
  return newConfigRoute(c)
})

// Settings page (GET)
app.get('/settings/:secret', async (c: Context) => {
  return settingsPageRoute(c)
})

// Settings API (POST)
app.post('/api/settings', async (c: Context) => {
  return settingsApiRoute(c)
})

// Delete config API (POST)
app.post('/api/delete', async (c: Context) => {
  return deleteApiRoute(c)
})

// Webhook endpoint (POST)
app.post('/webhook/:hash', async (c: Context) => {
  return webhookRoute(c)
})

// 404 handler
app.notFound(() => {
  return new Response('Not found', { status: 404 })
})

export default app
