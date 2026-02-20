const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  car: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Car',
    required: [true, 'Car is required']
  },
  pickupLocation: {
    type: String,
    required: [true, 'Pickup location is required']
  },
  pickupDate: {
    type: Date,
    required: [true, 'Pickup date is required'],
  },
  pickupTime: {
    type: String,
    required: [true, 'Pickup time is required']
  },
  dropoffDate: {
    type: Date,
    required: [true, 'Dropoff date is required'],
  },
  dropoffTime: {
    type: String,
    required: [true, 'Dropoff time is required']
  },
  totalDays: {
    type: Number,
    required: true,
    min: [1, 'Minimum booking is 1 day']
  },
  pricePerDay: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  bookingStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'completed'],
    default: 'pending'
  },
  // paymentStatus: {
  //   type: String,
  //   enum: ['pending', 'paid', 'refunded', 'failed'],
  //   default: 'pending'
  // },
  // paymentMethod: {
  //   type: String,
  //   enum: ['credit_card', 'paypal', 'stripe']
  // },
  // transactionId: String,
  specialRequests: {
    type: String,
    maxlength: [500, 'Special requests cannot exceed 500 characters']
  },
  // driverLicenseNumber: String,
  // driverLicenseImage: String,
  additionalDriver: {
    type: Boolean,
    default: false
  },
  insuranceSelected: {
    type: Boolean,
    default: true
  },
  cancellationReason: String
}, {
  timestamps: true,
  versionKey: false
});

// Calculate total days before saving
BookingSchema.pre('save', function(next) {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.ceil(
    Math.abs(this.dropoffDate.getTime() - this.pickupDate.getTime()) / oneDay
  );
  this.totalDays = diffDays;
  this.totalPrice = this.pricePerDay * diffDays;
  
  // Add insurance cost if selected
  if (this.insuranceSelected) {
    this.totalPrice += 15 * diffDays; // $15/day for insurance
  }
  
  // Add cost for additional driver
  if (this.additionalDriver) {
    this.totalPrice += 10 * diffDays; // $10/day for additional driver
  }
  
  next();
});

// Indexes for optimized queries
BookingSchema.index({ user: 1 });
BookingSchema.index({ car: 1 });
BookingSchema.index({ bookingStatus: 1 });
BookingSchema.index({ pickupDate: 1, dropoffDate: 1 });

module.exports = mongoose.model('Booking', BookingSchema);