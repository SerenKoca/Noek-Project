const express = require('express')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const {
  listFuneralDirectors,
  getFuneralDirectorDetails,
  createFuneralDirector,
  deleteFuneralDirector
} = require('../controllers/adminController')

const router = express.Router()

router.use(requireAuth)
router.use(requireRole('admin'))

router.get('/funeral-directors', listFuneralDirectors)
router.get('/funeral-directors/:id', getFuneralDirectorDetails)
router.get('/funeral-directors/:id/details', getFuneralDirectorDetails)
router.post('/funeral-directors', createFuneralDirector)
router.delete('/funeral-directors/:id', deleteFuneralDirector)

module.exports = router
