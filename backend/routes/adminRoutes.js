const express = require('express')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')
const {
  listFuneralDirectors,
  getFuneralDirectorDetails,
  createFuneralDirector,
  deleteFuneralDirector,
  getTemplateRoom,
  updateTemplateRoom
} = require('../controllers/adminController')

const router = express.Router()

router.use(requireAuth)
router.use(requireRole('admin'))

router.get('/funeral-directors', listFuneralDirectors)
router.get('/funeral-directors/:id', getFuneralDirectorDetails)
router.get('/funeral-directors/:id/details', getFuneralDirectorDetails)
router.post('/funeral-directors', createFuneralDirector)
router.delete('/funeral-directors/:id', deleteFuneralDirector)
router.get('/template-room', getTemplateRoom)
router.put('/template-room', updateTemplateRoom)

module.exports = router
