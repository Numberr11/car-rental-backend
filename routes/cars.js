const express = require('express');
const {
  getCars,
  getCar,
  createCar,
  updateCar,
  deleteCar,
  uploadCarImages,
  getFilterOptions,
  getSimilarCars,
} = require('../controllers/cars.js');
const { protect, restrictTo } = require('../middleware/auth.js');
const { uploadCarImages: uploadMiddleware } = require('../config/aws.js');

const router = express.Router();

// Public routes
router.get('/', getCars);
router.get('/:id', getCar);
router.get('/filters/options', getFilterOptions);
router.get('/:id/similar', getSimilarCars);

// Protected routes (Admin only)
router.use(protect, restrictTo('admin'));

router.post('/',  uploadMiddleware.array('images', 10), createCar);
router.put('/:id', uploadMiddleware.array('images', 10), updateCar);
router.delete('/:id', deleteCar);
router.post(
  '/:id/images',
  uploadMiddleware.array('images', 10),
  uploadCarImages
);

module.exports = router;