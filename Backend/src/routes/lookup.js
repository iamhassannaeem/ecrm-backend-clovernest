const express = require('express');
const router = express.Router();
const leadsController = require('../controllers/leadsController');
const { authenticateToken } = require('../middleware/auth');

// Get lookup values (optionally filtered by type) - requires authentication only
router.get('/', authenticateToken, leadsController.getLookupValues);

// Get package types filtered by service type - requires authentication only
router.get('/package-types/:serviceTypeId', authenticateToken, leadsController.getPackageTypesByServiceType);

// Get service types with their associated package types - requires authentication only
router.get('/service-types-with-packages', authenticateToken, leadsController.getServiceTypesWithPackages);

// Create a new lookup value - requires authentication only
router.post('/', authenticateToken, leadsController.createLookupValue);

// Create a new lookup value with parent relationship - requires authentication only
router.post('/with-parent', authenticateToken, leadsController.createLookupValueWithParent);

// Update a lookup value - requires authentication only
router.put('/:id', authenticateToken, leadsController.updateLookupValue);

// Delete a lookup value - requires authentication only
router.delete('/:id', authenticateToken, leadsController.deleteLookupValue);

module.exports = router; 