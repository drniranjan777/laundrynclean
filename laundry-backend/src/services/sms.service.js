const env = require('../config/env');
const logger = require('../utils/logger');

/**
 * Generate a 4-digit OTP (as per UI design)
 */
const generateOtp = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

/**
 * Send OTP via SMS provider
 * TODO: Replace with actual SMS provider (MSG91, Twilio, AWS SNS)
 */
const sendOtp = async (phone, otp) => {
  try {
    if (env.NODE_ENV === 'development') {
      // In development, log OTP to console instead of sending SMS
      logger.info(`[DEV] OTP for ${phone}: ${otp}`);
      return { success: true, provider: 'console' };
    }

    // Production: Integrate with your SMS provider
    // Example with MSG91:
    // const response = await axios.get('https://api.msg91.com/api/v5/otp', {
    //   params: {
    //     authkey: env.SMS_API_KEY,
    //     mobile: `91${phone}`,
    //     otp,
    //     sender: env.SMS_SENDER_ID,
    //     template_id: env.SMS_TEMPLATE_ID,
    //   },
    // });

    // Example with Twilio:
    // const client = require('twilio')(env.TWILIO_SID, env.TWILIO_AUTH_TOKEN);
    // await client.messages.create({
    //   body: `Your NClean verification code is: ${otp}. Valid for 5 minutes.`,
    //   from: env.TWILIO_PHONE,
    //   to: `+91${phone}`,
    // });

    logger.info(`OTP sent to ${phone}`);
    return { success: true, provider: 'sms' };
  } catch (error) {
    logger.error(`Failed to send OTP to ${phone}: ${error.message}`);
    throw new Error('Failed to send OTP. Please try again.');
  }
};

/**
 * Verify OTP via SMS provider (if using provider-side verification)
 * For our implementation, we verify against DB so this is not needed
 */
const verifyOtpViaProvider = async (phone, otp) => {
  // Only needed if using provider-side OTP verification (e.g., MSG91 verify API)
  return true;
};

module.exports = { generateOtp, sendOtp, verifyOtpViaProvider };
