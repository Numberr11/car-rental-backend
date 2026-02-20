const express = require('express');
const {
  createBooking,
  getMyBookings,
  getBooking,
  cancelBooking,
  getAllBookings,
  updateBooking
} = require('../controllers/bookings.js');
const { protect, restrictTo } = require('../middleware/auth.js');

const router = express.Router();

// Protected routes (user only)
router.use(protect);

router.post('/', restrictTo('user'), createBooking);
router.get('/my-bookings', getMyBookings);
router.get('/:id', getBooking);
router.patch('/:id/cancel', cancelBooking);

// Admin only routes
router.get('/', restrictTo('admin'), getAllBookings);
router.patch('/:id', restrictTo('admin'), updateBooking);

module.exports = router;