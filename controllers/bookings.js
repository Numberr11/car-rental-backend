const Booking = require("../models/Booking");
const Car = require("../models/Car");
const User = require("../models/User");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const emailService = require("../utils/email");

// @desc    Create new booking
// @route   POST /api/v1/bookings
// @access  Private
exports.createBooking = asyncHandler(async (req, res, next) => {
  const {
    carId,
    pickupLocation,
    pickupDate,
    pickupTime,
    dropoffDate,
    dropoffTime,
    specialRequests,
    additionalDriver,
    insuranceSelected,
  } = req.body;

  // Validate required fields
  if (!carId || !pickupLocation || !pickupDate || !dropoffDate) {
    return next(new AppError("Missing required booking information", 400));
  }

  // Parse and combine date with time
  const parseDateTime = (dateStr, timeStr) => {
    const date = new Date(dateStr);
    const [time, period] = timeStr.split(" ");
    let [hours, minutes] = time.split(":").map(Number);

    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const pickupDateTime = parseDateTime(pickupDate, pickupTime || "10:00 AM");
  const dropoffDateTime = parseDateTime(dropoffDate, dropoffTime || "10:00 AM");

  // Check if dropoff is after pickup
  if (dropoffDateTime <= pickupDateTime) {
    return next(new AppError("Drop-off must be after pick-up", 400));
  }

  // Check if car exists and is available
  const car = await Car.findById(carId);
  if (!car) {
    return next(new AppError("Car not found", 404));
  }

  if (!car.isAvailable) {
    return next(new AppError("Car is not available for booking", 400));
  }

  // Check car availability for the selected dates
  const existingBooking = await Booking.findOne({
    car: carId,
    bookingStatus: { $in: ["confirmed", "pending"] },
    $or: [
      {
        pickupDate: { $lt: dropoffDateTime },
        dropoffDate: { $gt: pickupDateTime },
      },
    ],
  });

  if (existingBooking) {
    return next(
      new AppError("Car is already booked for the selected dates", 400),
    );
  }

  // Calculate total days
  const oneDay = 24 * 60 * 60 * 1000;
  const totalDays = Math.ceil((dropoffDateTime - pickupDateTime) / oneDay);

  if (totalDays < 1) {
    return next(new AppError("Minimum booking is 1 day", 400));
  }

  let totalPrice = car.pricePerDay * totalDays;

  // Add insurance cost if selected
  if (insuranceSelected) {
    totalPrice += 15 * totalDays;
  }

  // Add cost for additional driver
  if (additionalDriver) {
    totalPrice += 10 * totalDays;
  }

  // Create booking
  const booking = await Booking.create({
    user: req.user.id,
    car: carId,
    pickupLocation,
    pickupDate: pickupDateTime,
    pickupTime,
    dropoffDate: dropoffDateTime,
    dropoffTime,
    totalDays,
    pricePerDay: car.pricePerDay,
    totalPrice,
    specialRequests,
    additionalDriver: additionalDriver || false,
    insuranceSelected: insuranceSelected !== false,
    bookingStatus: "confirmed",
  });

  // Update car availability
  if (car.totalCarsAvailable === 1) {
    car.isAvailable = false;
  }
  car.totalCarsAvailable = Math.max(0, car.totalCarsAvailable - 1);
  await car.save();

  // Populate booking details
  const populatedBooking = await Booking.findById(booking._id)
    .populate("user", "name email")
    .populate("car", "brand carName images pricePerDay");

  // Send confirmation email
  emailService.sendBookingConfirmation(populatedBooking, car, req.user);

  res.status(201).json({
    status: "success",
    data: {
      booking: populatedBooking,
    },
  });
});

// @desc    Get user's bookings
// @route   GET /api/v1/bookings/my-bookings
// @access  Private
exports.getMyBookings = asyncHandler(async (req, res, next) => {
  const bookings = await Booking.find({ user: req.user.id })
    .populate("car", "brand carName images pricePerDay")
    .sort("-createdAt");

  res.status(200).json({
    status: "success",
    results: bookings.length,
    data: {
      bookings,
    },
  });
});

// @desc    Get single booking
// @route   GET /api/v1/bookings/:id
// @access  Private
exports.getBooking = asyncHandler(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id)
    .populate("user", "name email phone")
    .populate("car", "brand carName model year images features");

  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  // Check if user owns the booking or is admin
  if (
    booking.user._id.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new AppError("You are not authorized to view this booking", 403),
    );
  }

  res.status(200).json({
    status: "success",
    data: {
      booking,
    },
  });
});

// @desc    Cancel booking
// @route   PATCH /api/v1/bookings/:id/cancel
// @access  Private
exports.cancelBooking = asyncHandler(async (req, res, next) => {
  const { cancellationReason } = req.body;

  const booking = await Booking.findById(req.params.id)
    .populate("car")
    .populate("user", "name email");

  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  if(!cancellationReason){
    return next(new AppError("Please Provide Cancellation Reason", 400));
  }

  // Check if user owns the booking
  if (
    booking.user._id.toString() !== req.user.id &&
    req.user.role !== "admin"
  ) {
    return next(
      new AppError("You are not authorized to cancel this booking", 403),
    );
  }

  // Check if booking can be cancelled
  if (booking.bookingStatus === "cancelled") {
    return next(new AppError("Booking is already cancelled", 400));
  }

  if (booking.bookingStatus === "completed") {
    return next(new AppError("Cannot cancel completed booking", 400));
  }

  // Update booking status
  booking.bookingStatus = "cancelled";
  booking.cancellationReason = cancellationReason;
  await booking.save();

  // Update car availability
  const car = await Car.findById(booking.car);
  car.totalCarsAvailable += 1;

  if (!car.isAvailable && car.totalCarsAvailable > 0) {
    car.isAvailable = true;
  }

  await car.save();

  // Send cancellation email
  emailService.sendBookingCancellation(booking, req.user);

  res.status(200).json({
    status: "success",
    message: "Booking cancelled successfully",
    data: {
      booking,
    },
  });
});

// @desc    Get all bookings (Admin)
// @route   GET /api/v1/bookings
// @access  Private/Admin
exports.getAllBookings = asyncHandler(async (req, res, next) => {
  const {
    status,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sort = "-createdAt",
  } = req.query;

  const query = {};

  // Filter by status
  if (status) {
    query.bookingStatus = status;
  }

  // Filter by date range
  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  // Pagination
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const skip = (pageNum - 1) * limitNum;

  const bookings = await Booking.find(query)
    .populate("user", "name email")
    .populate("car", "brand carName pricePerDay model")
    .sort(sort)
    .skip(skip)
    .limit(limitNum);

  const total = await Booking.countDocuments(query);

  res.status(200).json({
    status: "success",
    results: bookings.length,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
    data: {
      bookings,
    },
  });
});

// @desc    Update booking status (Admin)
// @route   PATCH /api/v1/bookings/:id
// @access  Private/Admin
exports.updateBooking = asyncHandler(async (req, res, next) => {
  const { status } = req.body;
  const bookingId = req.params.id;

  if (!status) {
    return next(new AppError("Please provide booking status", 400));
  }

  // Validate status
  const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
  if (!validStatuses.includes(status)) {
    return next(new AppError("Invalid booking status", 400));
  }

  // Find booking
  const booking = await Booking.findById(bookingId)
    .populate("user", "name email")
    .populate("car", "brand carName totalCarsAvailable isAvailable");

  if (!booking) {
    return next(new AppError("Booking not found", 404));
  }

  // Store old status for logic
  const oldStatus = booking.bookingStatus;

  // Update booking status
  booking.bookingStatus = status;
  booking.updatedAt = Date.now();
  
  // If status changed to cancelled
  if (status === "cancelled" && oldStatus !== "cancelled") {
    booking.cancellationReason =
      req.body.cancellationReason || "Cancelled by admin";

    // Update car availability
    const car = await Car.findById(booking.car);
    if (car) {
      car.totalCarsAvailable += 1;
      if (!car.isAvailable && car.totalCarsAvailable > 0) {
        car.isAvailable = true;
      }
      await car.save();
    }
  }

  // If status changed from cancelled to confirmed
  if (status === "confirmed" && oldStatus === "cancelled") {
    // Check if car is available
    const car = await Car.findById(booking.car);
    if (car && car.totalCarsAvailable <= 0) {
      return next(new AppError("Car is no longer available", 400));
    }

    // Update car availability
    if (car) {
      car.totalCarsAvailable -= 1;
      if (car.totalCarsAvailable === 0) {
        car.isAvailable = false;
      }
      await car.save();
    }
  }

  // If status changed to completed
  if (status === "completed" && oldStatus !== "completed") {
     emailService.sendBookingCompletion(
      booking,
      booking.car,
      booking.user,
    );
  }

  await booking.save();

  // Send email notification based on status change
  try {
    if (status === "confirmed") {
      emailService.sendBookingConfirmation(booking, booking.car, booking.user);
    } else if (status === "cancelled") {
      emailService.sendBookingCancellation(booking, booking.user);
    } else if (status === "completed") {
      // Send completion email
      emailService.sendBookingCompletion(booking, booking.user);
    }
  } catch (error) {
    console.error("Email sending failed:", error);
    // Don't fail the request if email fails
  }

  res.status(200).json({
    status: "success",
    message: `Booking status updated to ${status}`,
    data: {
      booking,
    },
  });
});
