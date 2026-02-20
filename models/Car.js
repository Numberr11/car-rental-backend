const mongoose = require('mongoose');

const CarSchema = new mongoose.Schema({
  carName: {
    type: String,
    required: [true, 'Car name is required'],
    trim: true
  },
  brand: {
    type: String,
    required: [true, 'Brand is required'],
    trim: true
  },
  model: {
    type: String,
    required: [true, 'Model is required'],
    trim: true
  },
  year: {
    type: Number,
    required: [true, 'Year is required'],
    min: [2000, 'Year must be 2000 or later'],
    max: [new Date().getFullYear() + 1, 'Year cannot be in the future']
  },
  carType: {
    type: String,
    required: [true, 'Car type is required']
  },
  doors: {
    type: Number,
    required: [true, 'Number of doors is required'],
    min: [2, 'Minimum 2 doors'],
    max: [5, 'Maximum 5 doors']
  },
  passengers: {
    type: Number,
    required: [true, 'Passenger capacity is required'],
    min: [1, 'Minimum 1 passenger'],
    max: [15, 'Maximum 15 passengers']
  },
  suitcases: {
    type: Number,
    required: [true, 'Suitcase capacity is required'],
    min: [0, 'Minimum 0 suitcases']
  },
  transmission: {
    type: String,
    enum: ['manual', 'automatic'],
    default : 'manual',
    required: [true, 'Transmission type is required']
  },
  fuelType: {
    type: String,
    required: [true, 'Fuel type is required'],
  },
  pricePerDay: {
    type: Number,
    required: [true, 'Price per day is required'],
    min: [10, 'Minimum price is $10/day']
  },
  totalCarsAvailable: {
    type: Number,
    required: [true, 'Total cars available is required'],
    min: [0, 'Cannot have negative cars'],
    default: 1
  },
  images: [{
    type: String,
    required: [true, 'At least one image is required']
  }],
  features: [{
    type: String,
  }],
  pickupLocations: [{
    type: String,
    required: [true, 'At least one pickup location is required']
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  mileage: {
    type: Number,
    min: [0, 'Mileage cannot be negative']
  },
  insuranceIncluded: {
    type: Boolean,
    default: true
  },
  unlimitedMileage: {
    type: Boolean,
    default: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for faster queries
CarSchema.index({ carType: 1 });
CarSchema.index({ pickupLocations: 1 });
CarSchema.index({ pricePerDay: 1 });
CarSchema.index({ isAvailable: 1 });

module.exports = mongoose.model('Car', CarSchema);