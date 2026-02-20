const Car = require("../models/Car");
const Booking = require("../models/Booking");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { deleteImageFromS3 } = require("../config/aws");

// @desc    Get all cars with filtering
// @route   GET /api/v1/cars
// @access  Public
exports.getCars = asyncHandler(async (req, res) => {
  const {
    location,
    pickupDate,
    pickupTime = "10:00 AM",
    dropoffDate,
    dropoffTime = "10:00 AM",
    passengers,
    carType,
    transmission,
    minPrice,
    maxPrice,
    brand,
    sort = "-createdAt",
    page = 1,
    limit = 10,
  } = req.query;

  // Build query object
  const queryObj = { isAvailable: true };

  // Filter by pickup location
  if (location) {
    queryObj.pickupLocations = { $in: [location] };
  }

  // Filter by car type
  if (carType) {
    queryObj.carType = carType;
  }

  // Filter by transmission
  if (transmission) {
    queryObj.transmission = transmission;
  }

  // Filter by brand
  if (brand) {
    queryObj.brand = { $regex: brand, $options: "i" };
  }

  // Filter by passengers
  if (passengers) {
    queryObj.passengers = { $gte: Number(passengers) };
  }

  // Filter by price range
  if (minPrice || maxPrice) {
    queryObj.pricePerDay = {};
    if (minPrice) queryObj.pricePerDay.$gte = Number(minPrice);
    if (maxPrice) queryObj.pricePerDay.$lte = Number(maxPrice);
  }

  // Date and time availability filtering (check bookings)
  if (pickupDate && dropoffDate) {
    // Helper function to parse time
    const parseTime = (timeStr) => {
      if (timeStr === "Any" || !timeStr) {
        return { hours: 10, minutes: 0, period: "AM" }; // Default 10:00 AM
      }

      const [time, period] = timeStr.split(" ");
      const [hours, minutes] = time.split(":").map(Number);
      return { hours, minutes, period };
    };

    const pickupTimeObj = parseTime(pickupTime);
    const dropoffTimeObj = parseTime(dropoffTime);

    // Create Date objects with time
    const pickupDateTime = new Date(pickupDate);
    const dropoffDateTime = new Date(dropoffDate);

    // Set hours based on time
    let pickupHour = pickupTimeObj.hours;
    if (pickupTimeObj.period === "PM" && pickupHour < 12) pickupHour += 12;
    if (pickupTimeObj.period === "AM" && pickupHour === 12) pickupHour = 0;

    let dropoffHour = dropoffTimeObj.hours;
    if (dropoffTimeObj.period === "PM" && dropoffHour < 12) dropoffHour += 12;
    if (dropoffTimeObj.period === "AM" && dropoffHour === 12) dropoffHour = 0;

    pickupDateTime.setHours(pickupHour, pickupTimeObj.minutes, 0, 0);
    dropoffDateTime.setHours(dropoffHour, dropoffTimeObj.minutes, 0, 0);

    // Find cars that have no overlapping bookings
    const bookedCarIds = await Booking.find({
      $or: [
        {
          pickupDate: { $lt: dropoffDateTime },
          dropoffDate: { $gt: pickupDateTime },
          bookingStatus: { $in: ["confirmed", "pending"] },
        },
      ],
    }).distinct("car");

    if (bookedCarIds.length > 0) {
      queryObj._id = { $nin: bookedCarIds };
    }
  }

  // Execute query with pagination
  const pageNum = Number(page);
  const limitNum = Number(limit);
  const skip = (pageNum - 1) * limitNum;

  const cars = await Car.find(queryObj)
    .sort(sort)
    .skip(skip)
    .limit(limitNum)
    .populate("createdBy", "name email");

  const total = await Car.countDocuments(queryObj);

  res.status(200).json({
    status: "success",
    results: cars.length,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
    data: cars,
  });
});

// @desc    Get single car
// @route   GET /api/v1/cars/:id
// @access  Public
exports.getCar = asyncHandler(async (req, res, next) => {
  const car = await Car.findById(req.params.id).populate(
    "createdBy",
    "name email",
  );

  if (!car) {
    return next(new AppError("Car not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: car,
  });
});

// @desc    Create car (Admin only)
// @route   POST /api/v1/cars
// @access  Private/Admin
exports.createCar = asyncHandler(async (req, res, next) => {
  // Explicitly define all fields for security
  const {
    carName,
    brand,
    model,
    year,
    carType,
    doors,
    passengers,
    suitcases,
    transmission,
    fuelType,
    pricePerDay,
    totalCarsAvailable,
    description,
    mileage,
    insuranceIncluded,
    unlimitedMileage,
    features,
    pickupLocations,
  } = req.body;

  // Validate required fields
  if (!carName || !brand || !model || !year || !pricePerDay) {
    return next(new AppError("Missing required fields", 400));
  }

  // Get uploaded file URLs
  let imageUrls = [];
  if (req.files && req.files.length > 0) {
    imageUrls = req.files.map((file) => file.location);
  } else {
    return next(new AppError("At least one image is required", 400));
  }

  // Parse arrays if they're strings
  let featuresArray = features;
  if (typeof features === "string") {
    featuresArray = JSON.parse(features);
  }

  let pickupLocationsArray = pickupLocations;
  if (typeof pickupLocations === "string") {
    pickupLocationsArray = JSON.parse(pickupLocations);
  }

  // Create car with explicit fields
  const carData = {
    carName,
    brand,
    model,
    year: parseInt(year),
    carType,
    doors: parseInt(doors),
    passengers: parseInt(passengers),
    suitcases: parseInt(suitcases),
    transmission,
    fuelType,
    pricePerDay: parseFloat(pricePerDay),
    totalCarsAvailable: parseInt(totalCarsAvailable) || 1,
    description: description || "",
    mileage: mileage ? parseInt(mileage) : undefined,
    insuranceIncluded:
      insuranceIncluded === "true" || insuranceIncluded === true,
    unlimitedMileage: unlimitedMileage === "true" || unlimitedMileage === true,
    features: featuresArray || [],
    pickupLocations: pickupLocationsArray || [],
    images: imageUrls,
    createdBy: req.user._id,
    isAvailable: parseInt(totalCarsAvailable) > 0,
  };

  const car = await Car.create(carData);

  res.status(201).json({
    status: "success",
    data: car,
  });
});

// @desc    Update car (Admin only)
// @route   PUT /api/v1/cars/:id
// @access  Private/Admin
exports.updateCar = asyncHandler(async (req, res, next) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    return next(new AppError("Car not found", 404));
  }

  // Explicitly define all fields
  const {
    carName,
    brand,
    model,
    year,
    carType,
    doors,
    passengers,
    suitcases,
    transmission,
    fuelType,
    pricePerDay,
    totalCarsAvailable,
    description,
    mileage,
    insuranceIncluded,
    unlimitedMileage,
    isAvailable,
    features,
    pickupLocations,
  } = req.body;

  // Get new uploaded file URLs
  let newImageUrls = [];
  if (req.files && req.files.length > 0) {
    newImageUrls = req.files.map((file) => file.location);
  }

  // Parse arrays if they're strings
  let featuresArray = car.features;
  if (features) {
    if (typeof features === "string") {
      featuresArray = JSON.parse(features);
    } else {
      featuresArray = features;
    }
  }

  let pickupLocationsArray = car.pickupLocations;
  if (pickupLocations) {
    if (typeof pickupLocations === "string") {
      pickupLocationsArray = JSON.parse(pickupLocations);
    } else {
      pickupLocationsArray = pickupLocations;
    }
  }

  // Update car with explicit fields
  const updateData = {
    carName: carName || car.carName,
    brand: brand || car.brand,
    model: model || car.model,
    year: year ? parseInt(year) : car.year,
    carType: carType || car.carType,
    doors: doors ? parseInt(doors) : car.doors,
    passengers: passengers ? parseInt(passengers) : car.passengers,
    suitcases: suitcases ? parseInt(suitcases) : car.suitcases,
    transmission: transmission || car.transmission,
    fuelType: fuelType || car.fuelType,
    pricePerDay: pricePerDay ? parseFloat(pricePerDay) : car.pricePerDay,
    totalCarsAvailable: totalCarsAvailable
      ? parseInt(totalCarsAvailable)
      : car.totalCarsAvailable,
    description: description !== undefined ? description : car.description,
    mileage: mileage ? parseInt(mileage) : car.mileage,
    insuranceIncluded:
      insuranceIncluded !== undefined
        ? insuranceIncluded === "true" || insuranceIncluded === true
        : car.insuranceIncluded,
    unlimitedMileage:
      unlimitedMileage !== undefined
        ? unlimitedMileage === "true" || unlimitedMileage === true
        : car.unlimitedMileage,
    isAvailable:
      isAvailable !== undefined
        ? isAvailable === "true" || isAvailable === true
        : car.isAvailable,
    features: featuresArray,
    pickupLocations: pickupLocationsArray,
    images: [...car.images, ...newImageUrls],
  };

  const updatedCar = await Car.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    status: "success",
    data: updatedCar,
  });
});

// @desc    Delete car (Admin only)
// @route   DELETE /api/v1/cars/:id
// @access  Private/Admin
exports.deleteCar = asyncHandler(async (req, res, next) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    return next(new AppError("Car not found", 404));
  }

  // Delete images from S3
  if (car.images && car.images.length > 0) {
    for (const imageUrl of car.images) {
      await deleteImageFromS3(imageUrl);
    }
  }

  await car.deleteOne();

  res.status(204).json({
    status: "success",
    data: null,
  });
});

// @desc    Upload car images
// @route   POST /api/v1/cars/:id/images
// @access  Private/Admin
exports.uploadCarImages = asyncHandler(async (req, res, next) => {
  const car = await Car.findById(req.params.id);

  if (!car) {
    return next(new AppError("Car not found", 404));
  }

  // Get uploaded file URLs from req.files
  const files = req.files;
  const imageUrls = files.map((file) => file.location);

  // Add new images to car
  car.images = [...car.images, ...imageUrls];
  await car.save();

  res.status(200).json({
    status: "success",
    data: car.images,
  });
});

// @desc    Get all filter options from cars
// @route   GET /api/v1/cars/filters/options
// @access  Public
exports.getFilterOptions = asyncHandler(async (req, res) => {
  try {
    // Get distinct values using aggregation for better sorting and filtering
    const [
      carTypesResult,
      pickupLocationsResult,
      brandsResult,
      transmissionsResult,
      fuelTypesResult,
      passengerCountsResult,
    ] = await Promise.all([
      // Car Types
      Car.aggregate([
        { $match: { isAvailable: true } },
        { $group: { _id: "$carType" } },
        { $sort: { _id: 1 } },
      ]),

      // Pickup Locations (flatten array and get unique values)
      Car.aggregate([
        { $match: { isAvailable: true } },
        { $unwind: "$pickupLocations" },
        { $group: { _id: "$pickupLocations" } },
        { $sort: { _id: 1 } },
      ]),

      // Brands
      Car.aggregate([
        { $match: { isAvailable: true } },
        { $group: { _id: "$brand" } },
        { $sort: { _id: 1 } },
      ]),

      // Transmissions
      Car.aggregate([
        { $match: { isAvailable: true } },
        { $group: { _id: "$transmission" } },
        { $sort: { _id: 1 } },
      ]),

      // Fuel Types
      Car.aggregate([
        { $match: { isAvailable: true } },
        { $group: { _id: "$fuelType" } },
        { $sort: { _id: 1 } },
      ]),

      // Passenger Counts (numeric sorting)
      Car.aggregate([
        { $match: { isAvailable: true } },
        { $group: { _id: "$passengers" } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Get price ranges
    const priceStats = await Car.aggregate([
      { $match: { isAvailable: true } },
      {
        $group: {
          _id: null,
          minPrice: { $min: "$pricePerDay" },
          maxPrice: { $max: "$pricePerDay" },
          avgPrice: { $avg: "$pricePerDay" },
        },
      },
    ]);

    // Extract values from aggregation results
    const carTypes = carTypesResult.map((item) => item._id).filter(Boolean);
    const pickupLocations = pickupLocationsResult
      .map((item) => item._id)
      .filter(Boolean);
    const brands = brandsResult.map((item) => item._id).filter(Boolean);
    const transmissions = transmissionsResult
      .map((item) => item._id)
      .filter(Boolean);
    const fuelTypes = fuelTypesResult.map((item) => item._id).filter(Boolean);
    const passengerCounts = passengerCountsResult
      .map((item) => item._id)
      .filter((count) => count != null)
      .sort((a, b) => a - b);

    res.status(200).json({
      status: "success",
      data: {
        carTypes,
        pickupLocations,
        brands,
        transmissions,
        fuelTypes,
        passengerCounts,
        priceRange: priceStats[0] || {
          minPrice: 10,
          maxPrice: 1000,
          avgPrice: 100,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching filter options:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch filter options",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// @desc    Get similar cars with fallback strategy
// @route   GET /api/v1/cars/:id/similar
// @access  Public
exports.getSimilarCars = asyncHandler(async (req, res, next) => {
  try {
    const currentCar = await Car.findById(req.params.id);

    if (!currentCar) {
      return next(new AppError("Car not found", 404));
    }

    let similarCars = [];
    let strategy = "exact_location";

    // First try: Cars with matching pickup locations
    if (currentCar.pickupLocations && currentCar.pickupLocations.length > 0) {
      similarCars = await Car.find({
        _id: { $ne: currentCar._id },
        isAvailable: true,
        pickupLocations: { $in: currentCar.pickupLocations },
        $or: [
          { brand: currentCar.brand },
          { carType: currentCar.carType },
          { transmission: currentCar.transmission },
          { 
            pricePerDay: { 
              $gte: currentCar.pricePerDay * 0.7,
              $lte: currentCar.pricePerDay * 1.3 
            }
          }
        ]
      })
      .limit(3)
      .select("carName brand model year pricePerDay images transmission passengers suitcases fuelType pickupLocations rating reviewCount")
      .sort({ rating: -1, pricePerDay: 1 });
    }

    // Second try: If no cars found with matching locations, try without location constraint
    if (similarCars.length === 0) {
      strategy = "similar_features";
      similarCars = await Car.find({
        _id: { $ne: currentCar._id },
        isAvailable: true,
        $or: [
          { brand: currentCar.brand },
          { carType: currentCar.carType },
          { transmission: currentCar.transmission },
          { 
            pricePerDay: { 
              $gte: currentCar.pricePerDay * 0.7,
              $lte: currentCar.pricePerDay * 1.3 
            }
          },
          { 
            passengers: { 
              $gte: Math.max(1, currentCar.passengers - 1),
              $lte: currentCar.passengers + 1
            }
          }
        ]
      })
      .limit(3)
      .select("carName brand model year pricePerDay images transmission passengers suitcases fuelType pickupLocations rating reviewCount")
      .sort({ rating: -1, pricePerDay: 1 });
    }

    res.status(200).json({
      status: "success",
      count: similarCars.length,
      strategy: strategy,
      data: similarCars,
    });
  } catch (error) {
    console.error("Error fetching similar cars:", error);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch similar cars",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});