import { polyRouter } from '../../src/server/polyApi/routes/polyRoutes.js'

export default async function handler(req, res) {
  await polyRouter(req, res)
}
