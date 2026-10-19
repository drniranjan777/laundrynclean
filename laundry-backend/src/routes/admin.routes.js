const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const adminManage = require('../controllers/admin-manage.controller');
const driverController = require('../controllers/driver.controller');
const adminWallet = require('../controllers/admin-wallet.controller');
const gstController = require('../controllers/gst.controller');
const posController = require('../controllers/pos.controller');
const locationAdmin = require('../controllers/location-admin.controller');
const orderWorkflow = require('../controllers/order-workflow.controller');
const pickupAdmin = require('../controllers/pickup-admin.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');
const { body } = require('express-validator');
const { validate } = require('../middlewares/validation.middleware');

// Public - Admin login
router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
], validate, adminController.adminLogin);

// ===== Admins and branch managers (managers only see their own location) =====
router.use(authenticate, authorize('admin', 'manager'));

router.get('/dashboard', adminController.getDashboardStats);
router.get('/users', adminController.getAllUsers); // customer lookup for POS
router.get('/gst', gstController.getGstSettings);
router.get('/locations', locationAdmin.getLocations);

// Delivery Boys CRUD
router.post('/delivery-boys', driverController.createDeliveryBoy);
router.get('/delivery-boys', driverController.getDeliveryBoys);
router.put('/delivery-boys/:id', driverController.updateDeliveryBoy);
router.delete('/delivery-boys/:id', driverController.deleteDeliveryBoy);

// Assign driver to booking
router.post('/bookings/:id/assign-driver', driverController.assignDriverToBooking);
// Order history: driver-app actions, staff status changes, driver assignment
// Order Management: tab counts, delivery / collection confirmation, corrections (admins only)
router.get('/bookings/status-counts', orderWorkflow.statusCounts);
router.post('/bookings/:id/deliver', orderWorkflow.confirmDelivered);
router.post('/bookings/:id/collect', orderWorkflow.confirmCollected);
router.post('/bookings/:id/correct-status', authorize('admin'), orderWorkflow.correctStatus);
router.get('/bookings/:id/events', require('../controllers/booking-event.controller').getBookingEvents);
// Bill a bulk pickup once its clothes are counted
router.put('/bookings/:id/bill', pickupAdmin.billBooking);

// Schedule Pickup: managers can read (their own store); changes are admin-only below
router.get('/pickup/summary', pickupAdmin.pickupSummary);
router.get('/pickup/settings', pickupAdmin.getPickupSettings);
router.get('/pickup/slots', pickupAdmin.listSlotsAdmin);
router.get('/pickup/slot-overrides', pickupAdmin.listSlotOverrides);
router.get('/pickup/date-exceptions', pickupAdmin.listDateExceptions);
router.get('/pickup/delivery-charges', pickupAdmin.listChargeRules);
router.get('/pickup/locations', pickupAdmin.listPickupLocations);

// POS (Offline Orders)
router.post('/pos/create-order', posController.createOfflineOrder);
router.get('/pos/orders', posController.getOfflineOrders);
router.get('/pos/orders/:id', posController.getOfflineOrderDetail);
router.patch('/pos/orders/:id/barcode-printed', posController.markBarcodePrinted);
router.post('/pos/scan-barcode', posController.scanBarcode);
router.get('/pos/stats', posController.getOfflineStats);

// ===== Admin only =====
router.use(authorize('admin'));

// Locations, branch managers, per-location prices and pickup slot capacity
router.post('/locations', locationAdmin.createLocation);
router.put('/locations/:id', locationAdmin.updateLocation);
router.delete('/locations/:id', locationAdmin.deleteLocation);
router.post('/locations/:id/managers', locationAdmin.createManager);
router.put('/managers/:id', locationAdmin.updateManager);
router.get('/locations/:id/prices', locationAdmin.getLocationPrices);
router.put('/locations/:id/prices', locationAdmin.updateLocationPrices);
router.get('/locations/:id/time-slots', locationAdmin.getLocationTimeSlots);
router.put('/locations/:id/time-slots', locationAdmin.updateLocationTimeSlots);
router.patch('/bookings/:id/location', locationAdmin.moveBooking);

// Users
router.get('/users/:id', adminController.getUserDetail);
router.patch('/users/:id/block', adminController.toggleBlockUser);
router.get('/drivers', adminController.getAllDrivers);
router.post('/assign-driver', adminController.assignDriver);
router.get('/reports/revenue', adminController.getRevenueReport);

// Category CRUD
router.post('/categories', adminManage.createCategory);
router.put('/categories/:id', adminManage.updateCategory);
router.delete('/categories/:id', adminManage.deleteCategory);

// Sub-category CRUD
router.post('/subcategories', adminManage.createSubCategory);
router.put('/subcategories/:id', adminManage.updateSubCategory);
router.delete('/subcategories/:id', adminManage.deleteSubCategory);

// Catalogue (Items) CRUD
router.post('/items', adminManage.createItem);
router.put('/items/:id', adminManage.updateItem);
router.delete('/items/:id', adminManage.deleteItem);

// Subscription Plans CRUD
router.post('/plans', adminManage.createPlan);
router.put('/plans/:id', adminManage.updatePlan);
router.delete('/plans/:id', adminManage.deletePlan);

// Wallet Packages CRUD
router.post('/packages', adminManage.createPackage);
router.put('/packages/:id', adminManage.updatePackage);
router.delete('/packages/:id', adminManage.deletePackage);

// Promo Codes CRUD
router.post('/promos', adminManage.createPromo);
router.put('/promos/:id', adminManage.updatePromo);
router.delete('/promos/:id', adminManage.deletePromo);

// Serviceable Pincodes CRUD
router.post('/pincodes', adminManage.createPincode);
router.put('/pincodes/:id', adminManage.updatePincode);
router.delete('/pincodes/:id', adminManage.deletePincode);

// Content Pages CRUD (Terms, Disclaimer, Privacy, About)
router.post('/content', adminManage.createContent);
router.put('/content/:id', adminManage.updateContent);
router.delete('/content/:id', adminManage.deleteContent);

// FAQ CRUD
router.post('/faqs', adminManage.createFaq);
router.put('/faqs/:id', adminManage.updateFaq);
router.delete('/faqs/:id', adminManage.deleteFaq);

// Wallet Credits (Admin offer system)
router.post('/wallet/credit-user', adminWallet.creditUser);
router.post('/wallet/credit-bulk', adminWallet.creditBulk);
router.post('/wallet/debit-user', adminWallet.debitUser);
router.get('/wallet/credit-history', adminWallet.getCreditHistory);

// GST Settings
router.put('/gst', gstController.updateGstSettings);

// Schedule Pickup configuration (every change is written to the audit log)
router.put('/pickup/settings', pickupAdmin.updatePickupSettings);
router.post('/pickup/slots', pickupAdmin.createSlot);
router.put('/pickup/slots/:id', pickupAdmin.updateSlot);
router.delete('/pickup/slots/:id', pickupAdmin.deleteSlot);
router.put('/pickup/slot-overrides', pickupAdmin.saveSlotOverride);
router.delete('/pickup/slot-overrides/:id', pickupAdmin.deleteSlotOverride);
router.put('/pickup/date-exceptions', pickupAdmin.saveDateException);
router.delete('/pickup/date-exceptions/:id', pickupAdmin.deleteDateException);
router.post('/pickup/delivery-charges', pickupAdmin.createChargeRule);
router.put('/pickup/delivery-charges/:id', pickupAdmin.updateChargeRule);
router.delete('/pickup/delivery-charges/:id', pickupAdmin.deleteChargeRule);
router.put('/pickup/locations/:id', pickupAdmin.updatePickupLocation);
router.get('/pickup/audit-logs', pickupAdmin.listAuditLogs);

module.exports = router;
