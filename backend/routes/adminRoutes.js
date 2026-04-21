const express = require('express')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const {
  listFuneralDirectors,
  createFuneralDirector,
  deleteFuneralDirector
} = require('../controllers/adminController')

const router = express.Router()

router.use(requireAuth)
router.use(requireRole('admin'))

router.get('/funeral-directors', listFuneralDirectors)
router.post('/funeral-directors', createFuneralDirector)
router.delete('/funeral-directors/:id', deleteFuneralDirector)

module.exports = router
