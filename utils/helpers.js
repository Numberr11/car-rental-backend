const helpers = {
  // Format date to readable string
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  },

  // Calculate total days between dates
  calculateTotalDays: (pickupDate, dropoffDate) => {
    const oneDay = 24 * 60 * 60 * 1000;
    const pickup = new Date(pickupDate);
    const dropoff = new Date(dropoffDate);
    return Math.ceil(Math.abs(dropoff - pickup) / oneDay);
  },

  // Generate booking ID
  generateBookingId: () => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `BK${timestamp}${random}`;
  },

  // Format currency
  formatCurrency: (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  },

  // Validate email
  validateEmail: (email) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  // Slugify string
  slugify: (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-');
  }
};

module.exports = helpers;