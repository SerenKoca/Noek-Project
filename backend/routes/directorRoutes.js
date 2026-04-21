const express = require('express')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const {
  listMyEditors,
  generateEditorCode,
  listMyEditorCodes
} = require('../controllers/directorController')

const router = express.Router()

router.use(requireAuth)
router.use(requireRole('funeral_director'))

router.get('/editors', listMyEditors)
router.get('/editor-codes', listMyEditorCodes)
router.post('/editor-codes', generateEditorCode)

module.exports = router
