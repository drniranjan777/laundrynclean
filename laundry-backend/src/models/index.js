// Model associations registry
const User = require('./user.model');
const Address = require('./address.model');
const { Wallet, WalletPackage, WalletTransaction } = require('./wallet.model');
const { SubscriptionPlan, UserSubscription } = require('./subscription.model');
const { PromoCode, UserPromoCode } = require('./promocode.model');
const { Category, SubCategory, Item } = require('./category.model');
const { CartItem, Favorite } = require('./cart.model');
const { TimeSlot, Booking, BookingItem } = require('./booking.model');
const BookingEvent = require('./booking-event.model');
const Review = require('./review.model');
const { Content, FAQ } = require('./content.model');
const OnboardingSlide = require('./onboarding.model');
const ServiceablePincode = require('./serviceable-pincode.model');
const Driver = require('./driver.model');
const Notification = require('./notification.model');
const { Location, LocationItemPrice, LocationTimeSlot } = require('./location.model');
const { PickupSettings, PickupDateException, SlotDateOverride, DeliveryChargeRule, AdminAuditLog } = require('./pickup.model');

// User associations
User.hasMany(Address, { foreignKey: 'user_id', as: 'addresses' });
Address.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasOne(Wallet, { foreignKey: 'user_id', as: 'wallet' });
Wallet.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(UserSubscription, { foreignKey: 'user_id', as: 'subscriptions' });
UserSubscription.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Booking, { foreignKey: 'user_id', as: 'bookings' });
Booking.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
Booking.belongsTo(User, { foreignKey: 'driver_id', as: 'driver' });

User.hasMany(Review, { foreignKey: 'user_id', as: 'reviews' });
Review.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// Review - Item
Review.belongsTo(Item, { foreignKey: 'item_id', as: 'item' });
Item.hasMany(Review, { foreignKey: 'item_id', as: 'reviews' });

// Booking - Address
Booking.belongsTo(Address, { foreignKey: 'address_id', as: 'address' });

// Locations
Location.hasMany(Booking, { foreignKey: 'location_id', as: 'bookings' });
Booking.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });
Booking.hasMany(BookingEvent, { foreignKey: 'booking_id', as: 'events' });
BookingEvent.belongsTo(Booking, { foreignKey: 'booking_id', as: 'booking' });
BookingEvent.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });
BookingEvent.belongsTo(User, { foreignKey: 'partner_id', as: 'partner' });
Location.hasMany(ServiceablePincode, { foreignKey: 'location_id', as: 'pincodes' });
ServiceablePincode.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });
Location.hasMany(User, { foreignKey: 'location_id', as: 'staff' });
User.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });
Location.hasMany(LocationItemPrice, { foreignKey: 'location_id', as: 'itemPrices' });
LocationItemPrice.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });
LocationItemPrice.belongsTo(Item, { foreignKey: 'item_id', as: 'item' });
Location.hasMany(LocationTimeSlot, { foreignKey: 'location_id', as: 'slotCapacities' });
LocationTimeSlot.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });
LocationTimeSlot.belongsTo(TimeSlot, { foreignKey: 'time_slot_id', as: 'timeSlot' });
TimeSlot.hasMany(LocationTimeSlot, { foreignKey: 'time_slot_id', as: 'locationCapacities' });
SlotDateOverride.belongsTo(TimeSlot, { foreignKey: 'time_slot_id', as: 'timeSlot' });
SlotDateOverride.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });
PickupDateException.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });
DeliveryChargeRule.belongsTo(Location, { foreignKey: 'location_id', as: 'location' });
AdminAuditLog.belongsTo(User, { foreignKey: 'actor_id', as: 'actor' });

module.exports = {
  User,
  Address,
  Wallet,
  WalletPackage,
  WalletTransaction,
  SubscriptionPlan,
  UserSubscription,
  PromoCode,
  UserPromoCode,
  Category,
  SubCategory,
  Item,
  CartItem,
  Favorite,
  TimeSlot,
  Booking,
  BookingItem,
  Review,
  Content,
  FAQ,
  OnboardingSlide,
  ServiceablePincode,
  Driver,
  Notification,
  Location,
  LocationItemPrice,
  LocationTimeSlot,
  PickupSettings,
  PickupDateException,
  SlotDateOverride,
  DeliveryChargeRule,
  AdminAuditLog,
  BookingEvent,
};
