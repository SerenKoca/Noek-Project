import { staticRouter } from '../../src/server/polyStatic/routes/staticRoutes.js'

export default async function handler(req, res) {
  await staticRouter(req, res)
}
