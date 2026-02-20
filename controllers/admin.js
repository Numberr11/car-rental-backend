const User = require('../models/User');
const Car = require('../models/Car');
const Booking = require('../models/Booking');
const AppError = require('../utils/appError');
const asyncHandler = require('../utils/asyncHandler');

// @desc    Get dashboard statistics
// @route   GET /api/v1/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = asyncHandler(async (req, res, next) => {
  const [
    totalUsers,
    totalCars,
    totalBookings,
    totalRevenue,
    recentBookings,
    popularCars
  ] = await Promise.all([
    // Total users
    User.countDocuments(),
    
    // Total cars
    Car.countDocuments(),
    
    // Total bookings
    Booking.countDocuments(),
    
    // Total revenue (sum of all confirmed bookings)
    Booking.aggregate([
      { $match: { bookingStatus: 'confirmed' } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ]),
    
    // Recent bookings (last 10)
    Booking.find()
      .populate('user', 'name email')
      .populate('car', 'brand carName')
      .sort('-createdAt')
      .limit(10),
    
    // Popular cars (most booked)
    Booking.aggregate([
      { $group: { _id: '$car', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ])
  ]);

  // Get car details for popular cars
  const popularCarIds = popularCars.map(car => car._id);
  const popularCarDetails = await Car.find({ _id: { $in: popularCarIds } })
    .select('brand carName images pricePerDay');

  const stats = {
    users: totalUsers,
    cars: totalCars,
    bookings: totalBookings,
    revenue: totalRevenue[0]?.total || 0,
    recentBookings,
    popularCars: popularCarDetails.map((car, index) => ({
      ...car.toObject(),
      bookingCount: popularCars[index]?.count || 0
    }))
  };

  res.status(200).json({
    status: 'success',
    data: stats
  });
});

// @desc    Get all users
// @route   GET /api/v1/admin/users
// @access  Private/Admin
exports.getAllUsers = asyncHandler(async (req, res, next) => {
  const { page = 1, limit = 20, search = '', role = '' } = req.query;

  const query = {};

  // Filter by role
  if (role) {
    query.role = role;
  }

  // Search by name or email
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const users = await User.find(query)
    .select('-password')
    .sort('-createdAt')
    .skip(skip)
    .limit(limitNum);

  const total = await User.countDocuments(query);

  res.status(200).json({
    status: 'success',
    results: users.length,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum)
    },
    data: {
      users
    }
  });
});

// @desc    Update user role
// @route   PATCH /api/v1/admin/users/:id/role
// @access  Private/Admin
exports.updateUserRole = asyncHandler(async (req, res, next) => {
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return next(new AppError('Invalid role', 400));
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// @desc    Delete user
// @route   DELETE /api/v1/admin/users/:id
// @access  Private/Admin
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return next(new AppError('User not found', 404));
  }

  // Check if user has bookings
  const userBookings = await Booking.countDocuments({ user: user._id });
  if (userBookings > 0) {
    return next(new AppError('Cannot delete user with existing bookings', 400));
  }

  await user.deleteOne();

  res.status(200).json({
    status: 'success',
    message: 'User deleted successfully'
  });
});

// @desc    Get booking analytics
// @route   GET /api/v1/admin/analytics/bookings
// @access  Private/Admin
exports.getBookingAnalytics = asyncHandler(async (req, res, next) => {
  const { startDate, endDate } = req.query;

  const matchStage = {};

  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const analytics = await Booking.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m', date: '$createdAt' }
        },
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$totalPrice' },
        averageBookingValue: { $avg: '$totalPrice' }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      analytics
    }
  });
});

// @desc    Get car analytics
// @route   GET /api/v1/admin/analytics/cars
// @access  Private/Admin
exports.getCarAnalytics = asyncHandler(async (req, res, next) => {
  const carTypes = await Booking.aggregate([
    {
      $lookup: {
        from: 'cars',
        localField: 'car',
        foreignField: '_id',
        as: 'carDetails'
      }
    },
    { $unwind: '$carDetails' },
    {
      $group: {
        _id: '$carDetails.carType',
        totalBookings: { $sum: 1 },
        totalRevenue: { $sum: '$totalPrice' }
      }
    },
    { $sort: { totalBookings: -1 } }
  ]);

  const popularLocations = await Booking.aggregate([
    {
      $group: {
        _id: '$pickupLocation',
        totalBookings: { $sum: 1 }
      }
    },
    { $sort: { totalBookings: -1 } },
    { $limit: 10 }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      carTypes,
      popularLocations
    }
  });
});