const nodemailer = require('nodemailer');

// TODO: Configure email transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@laundry.com',
      to,
      subject,
      html,
    });
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error('Email send error:', error.message);
  }
};

const sendOrderConfirmation = async (email, order) => {
  await sendEmail({
    to: email,
    subject: `Order Confirmed - #${order.id}`,
    html: `<h1>Order Confirmed</h1><p>Your order #${order.id} has been confirmed.</p>`,
  });
};

const sendPickupScheduled = async (email, pickup) => {
  await sendEmail({
    to: email,
    subject: 'Pickup Scheduled',
    html: `<h1>Pickup Scheduled</h1><p>Your pickup is scheduled for ${pickup.scheduledAt}.</p>`,
  });
};

module.exports = { sendEmail, sendOrderConfirmation, sendPickupScheduled };
