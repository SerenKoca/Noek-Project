const express = require('express')
const { authHandler } = require('../controllers/authController')

const router = express.Router()

router.post('/', authHandler)

module.exports = router
