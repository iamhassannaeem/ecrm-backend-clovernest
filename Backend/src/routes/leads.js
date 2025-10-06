const express = require('express');
const router = express.Router();
const leadsController = require('../controllers/leadsController');
const { authenticateToken, requireOrgUserAccess } = require('../middleware/auth');

router.post('/', authenticateToken, leadsController.createLead);
router.get('/', authenticateToken, leadsController.getLeads);
router.get('/organization/:organizationId', authenticateToken, leadsController.getLeadsByOrganization);
router.get('/user/:userId', authenticateToken, leadsController.getLeadsByUser);
router.get('/getAllowedFormSteps', authenticateToken, requireOrgUserAccess, leadsController.getAllowedFormSteps);
router.get('/sales-report', authenticateToken, leadsController.getSalesReport);
router.get('/final-report', authenticateToken, leadsController.getFinalReport);
router.get('/:id', authenticateToken, leadsController.getLeadById);
router.put('/:id', authenticateToken, leadsController.updateLead);
router.delete('/:id', authenticateToken, leadsController.deleteLead);
router.patch('/:id/approve', authenticateToken, leadsController.approveLead);
router.patch('/:id/cancel', authenticateToken, leadsController.cancelLead);
router.patch('/:id/request-revision', authenticateToken, leadsController.requestRevision);
router.post('/:id/post', authenticateToken, leadsController.postLead);
router.get('/phone/:phone', authenticateToken, leadsController.getLeadByPhone);


module.exports = router; 