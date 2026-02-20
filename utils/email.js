const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: process.env.EMAIL_SECURE === "true", // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  pool: true,
  maxConnections: 5,
  rateLimit: 10,
});

// Email templates
const emailTemplates = {
  welcome: (name) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #FF4E00;">Welcome to BookUSAutoRentals!</h1>
      <p>Hello ${name},</p>
      <p>Thank you for joining BookUSAutoRentals. We're excited to have you on board!</p>
      <p>You can now browse our wide selection of cars and make bookings.</p>
      <br>
      <p>Best regards,</p>
      <p>The BookUSAutoRentals Team</p>
    </div>
  `,

  bookingConfirmation: (booking, car, user) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #FF4E00;">Booking Confirmed!</h1>
      <p>Hello ${user.name},</p>
      <p>Your booking has been confirmed. Here are the details:</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Booking Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;"><strong>Car:</strong></td>
            <td style="padding: 8px 0;">${car.brand} ${car.carName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Pickup Location:</strong></td>
            <td style="padding: 8px 0;">${booking.pickupLocation}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Pickup Date:</strong></td>
            <td style="padding: 8px 0;">${new Date(booking.pickupDate).toLocaleDateString()} at ${booking.pickupTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Dropoff Date:</strong></td>
            <td style="padding: 8px 0;">${new Date(booking.dropoffDate).toLocaleDateString()} at ${booking.dropoffTime}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Total Days:</strong></td>
            <td style="padding: 8px 0;">${booking.totalDays}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Total Price:</strong></td>
            <td style="padding: 8px 0; font-weight: bold; color: #FF4E00;">$${booking.totalPrice}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Booking ID:</strong></td>
            <td style="padding: 8px 0; font-family: monospace;">${booking._id}</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #e3f2fd; padding: 15px; border-radius: 10px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #1976d2;">Important Information</h4>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Please bring your driver's license and credit card for pickup</li>
          <li>Arrive 15 minutes before your scheduled pickup time</li>
          <li>Cancellation policy: Free cancellation up to 24 hours before pickup</li>
        </ul>
      </div>
      
      <p>Thank you for choosing BookUSAutoRentals!</p>
      <br>
      <p>Best regards,</p>
      <p>The BookUSAutoRentals Team</p>
    </div>
  `,

  bookingCancellation: (booking, user) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #FF4E00;">Booking Cancelled</h1>
      <p>Hello ${user.name},</p>
      <p>Your booking has been cancelled. Here are the details:</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Cancellation Details</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0;"><strong>Booking ID:</strong></td>
            <td style="padding: 8px 0; font-family: monospace;">${booking._id}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Cancellation Date:</strong></td>
            <td style="padding: 8px 0;">${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Refund Amount:</strong></td>
            <td style="padding: 8px 0; font-weight: bold; color: #2e7d32;">$${booking.totalPrice}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Reason:</strong></td>
            <td style="padding: 8px 0;">${booking.cancellationReason || 'No reason provided'}</td>
          </tr>
        </table>
      </div>
      
      <div style="background: #fff3e0; padding: 15px; border-radius: 10px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #ed6c02;">Refund Information</h4>
        <p style="margin: 0;">Your refund of <strong>$${booking.totalPrice}</strong> will be processed within 5-7 business days to your original payment method.</p>
      </div>
      
      <p>We hope to serve you again in the future!</p>
      <br>
      <p>Best regards,</p>
      <p>The BookUSAutoRentals Team</p>
    </div>
  `,

  bookingCompletion: (booking, car, user) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #FF4E00;">Trip Completed! Thank You for Renting with Us</h1>
      <p>Hello ${user?.name},</p>
      <p>We hope you enjoyed your rental experience! Your trip has been marked as completed.</p>
      
      <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #2e7d32;">✓ Trip Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; width: 40%;"><strong>Car:</strong></td>
            <td style="padding: 8px 0;">${car?.brand} ${car?.carName} (${car?.year})</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Pickup Location:</strong></td>
            <td style="padding: 8px 0;">${booking?.pickupLocation}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Rental Period:</strong></td>
            <td style="padding: 8px 0;">${new Date(booking?.pickupDate).toLocaleDateString()} - ${new Date(booking?.dropoffDate).toLocaleDateString()}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Total Days:</strong></td>
            <td style="padding: 8px 0;">${booking?.totalDays} days</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Total Paid:</strong></td>
            <td style="padding: 8px 0; font-weight: bold; color: #2e7d32;">$${booking?.totalPrice}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0;"><strong>Booking ID:</strong></td>
            <td style="padding: 8px 0; font-family: monospace;">${booking?._id}</td>
          </tr>
        </table>
      </div>
      
      <!-- Rate Your Experience Section -->
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 25px; border-radius: 10px; margin: 20px 0; color: white;">
        <h3 style="margin-top: 0; text-align: center;">How was your experience?</h3>
        <p style="text-align: center; margin-bottom: 20px;">Your feedback helps us improve our service</p>
        
        <!-- Star Rating Display -->
        <div style="text-align: center; margin-bottom: 20px;">
          <span style="font-size: 30px; margin: 0 2px;">★</span>
          <span style="font-size: 30px; margin: 0 2px;">★</span>
          <span style="font-size: 30px; margin: 0 2px;">★</span>
          <span style="font-size: 30px; margin: 0 2px;">★</span>
          <span style="font-size: 30px; margin: 0 2px;">★</span>
        </div>
        
        <div style="text-align: center;">
          <a href="${process.env.APP_URL}/bookings/${booking._id}/review" 
             style="background: white; color: #764ba2; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; display: inline-block;">
            Write a Review
          </a>
        </div>
      </div>
      
      <!-- Rental Tips -->
      <div style="margin: 20px 0;">
        <h4 style="color: #FF4E00;">📋 Rental Tips for Next Time:</h4>
        <ul style="padding-left: 20px;">
          <li>Book in advance for better availability and rates</li>
          <li>Check our special offers and loyalty program</li>
          <li>Refer a friend and both get $20 off your next rental</li>
        </ul>
      </div>
      
      <!-- Next Rental Offer -->
      <div style="background: #fff3e0; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
        <h4 style="margin-top: 0; color: #ed6c02;">🎉 Special Offer for Your Next Rental!</h4>
        <p style="font-size: 24px; font-weight: bold; margin: 10px 0;">15% OFF</p>
        <p style="margin-bottom: 15px;">on your next booking with code: <strong style="background: #ed6c02; color: white; padding: 5px 10px; border-radius: 5px;">WELCOME15</strong></p>
        <p style="font-size: 12px; color: #666;">Valid for 30 days. Terms and conditions apply.</p>
      </div>
      
      <p style="margin-top: 30px;">We look forward to serving you again!</p>
      <br>
      <p>Best regards,</p>
      <p>The BookUSAutoRentals Team</p>
      
      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center;">
        <p>© ${new Date().getFullYear()} BookUSAutoRentals. All rights reserved.</p>
        <p>
          <a href="${process.env.APP_URL}/privacy" style="color: #666; text-decoration: none;">Privacy Policy</a> |
          <a href="${process.env.APP_URL}/terms" style="color: #666; text-decoration: none;">Terms of Service</a> |
          <a href="${process.env.APP_URL}/contact" style="color: #666; text-decoration: none;">Contact Us</a>
        </p>
      </div>
    </div>
  `
};

const emailService = {
  // Send welcome email
  sendWelcomeEmail: async (user) => {
    try {
      const mailOptions = {
        from: `"BookUSAutoRentals" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: 'Welcome to BookUSAutoRentals!',
        html: emailTemplates.welcome(user.name)
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Welcome email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending welcome email:', error);
      return false;
    }
  },

  // Send booking confirmation
  sendBookingConfirmation: async (booking, car, user) => {
    try {
      const mailOptions = {
        from: `"BookUSAutoRentals" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: `✅ Booking Confirmed - ${booking._id}`,
        html: emailTemplates.bookingConfirmation(booking, car, user)
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Booking confirmation sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending booking confirmation:', error);
      return false;
    }
  },

  // Send booking cancellation
  sendBookingCancellation: async (booking, user) => {
    try {
      const mailOptions = {
        from: `"BookUSAutoRentals" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: `❌ Booking Cancelled - ${booking._id}`,
        html: emailTemplates.bookingCancellation(booking, user)
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Booking cancellation sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending booking cancellation:', error);
      return false;
    }
  },

  // Send booking completion
  sendBookingCompletion: async (booking, car, user) => {
    try {
      const mailOptions = {
        from: `"BookUSAutoRentals" <${process.env.EMAIL_USER}>`,
        to: user?.email,
        subject: `✨ Trip Completed - Thank You for Renting with Us!`,
        html: emailTemplates.bookingCompletion(booking, car, user)
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Booking completion email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending booking completion email:', error);
      return false;
    }
  },

  // Send password reset email
  sendPasswordResetEmail: async (user, resetToken) => {
    try {
      const resetUrl = `${process.env.APP_URL}/reset-password/${resetToken}`;
      
      const mailOptions = {
        from: `"BookUSAutoRentals" <${process.env.EMAIL_USER}>`,
        to: user.email,
        subject: '🔐 Password Reset Request',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #FF4E00;">Password Reset</h1>
            <p>Hello ${user.name},</p>
            <p>You requested to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: #FF4E00; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Reset Password
              </a>
            </div>
            <p style="margin-top: 20px;">Or copy this link: <br><a href="${resetUrl}" style="color: #FF4E00; word-break: break-all;">${resetUrl}</a></p>
            <p style="color: #666; font-size: 14px;">This link will expire in 1 hour.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this, please ignore this email.</p>
            <br>
            <p>Best regards,</p>
            <p>The BookUSAutoRentals Team</p>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Password reset email sent to ${user.email}`);
      return true;
    } catch (error) {
      console.error('❌ Error sending password reset email:', error);
      return false;
    }
  },

  // Verify email configuration
  verifyConnection: async () => {
    try {
      await transporter.verify();
      console.log('✅ Email service is ready to send emails');
      return true;
    } catch (error) {
      console.error('❌ Email service configuration error:', error);
      return false;
    }
  }
};

// Auto-verify connection when module loads
emailService.verifyConnection();

module.exports = emailService;