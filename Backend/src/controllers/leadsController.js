const { prisma } = require('../config/database');
const { getUserPermissions } = require('../controllers/authController'); // Import permission helper
const { createLeadAssignmentNotification } = require('./notificationController');

// Function to mask card number (show first 6 and last 4 digits)
function maskCardNumber(cardNumber) {
  if (!cardNumber || cardNumber.length < 10) {
    return cardNumber;
  }
  const first6 = cardNumber.substring(0, 6);
  const last4 = cardNumber.substring(cardNumber.length - 4);
  const middle = '*'.repeat(cardNumber.length - 10);
  return first6 + middle + last4;
}

// Function to generate unique confirmation number in series (A00001 to Z99999)
async function generateConfirmationNumber(organizationId) {
  // Find all confirmation numbers for this organization that match our format (Letter + 5 digits)
  const allLeads = await prisma.lead.findMany({
    where: { 
      organizationId,
      confirmationNumber: { not: null }
    },
    select: {
      confirmationNumber: true
    }
  });
  
  // Filter to only include valid format (1-2 letters followed by exactly 5 digits)
  const validConfirmationNumbers = allLeads
    .map(lead => lead.confirmationNumber)
    .filter(num => /^[A-Z]{1,2}\d{5}$/.test(num));
  
  let newConfirmationNumber;
  
  if (validConfirmationNumbers.length === 0) {
    // Start with A00001 if no previous confirmation number exists
    newConfirmationNumber = 'A00001';
  } else {
    // Parse and find the highest confirmation number
    let maxValue = 0;
    let maxConfirmationNumber = '';
    
    for (const confNum of validConfirmationNumbers) {
      // Calculate numeric value for sorting
      let value = 0;
      
      if (confNum.length === 6) {
        // Single letter format (A00001)
        const letter = confNum.charAt(0);
        const number = parseInt(confNum.substring(1));
        value = (letter.charCodeAt(0) - 65) * 100000 + number; // 'A' is 65
      } else if (confNum.length === 7) {
        // Double letter format (AA00001)
        const firstLetter = confNum.charAt(0);
        const secondLetter = confNum.charAt(1);
        const number = parseInt(confNum.substring(2));
        value = ((firstLetter.charCodeAt(0) - 65) * 26 + (secondLetter.charCodeAt(0) - 65) + 26) * 100000 + number;
      }
      
      if (value > maxValue) {
        maxValue = value;
        maxConfirmationNumber = confNum;
      }
    }
    
    const lastNumber = maxConfirmationNumber;
    
    // Extract letter and number parts
    if (lastNumber.length === 6) {
      // Single letter format (A00001)
      const letter = lastNumber.charAt(0);
      const number = parseInt(lastNumber.substring(1));
      
      if (number < 99999) {
        // Increment the number
        const nextNumber = (number + 1).toString().padStart(5, '0');
        newConfirmationNumber = letter + nextNumber;
      } else {
        // Roll over to next letter
        const nextLetterCode = letter.charCodeAt(0) + 1;
        
        if (nextLetterCode > 90) { // 'Z' is 90
          // Move to double letter format
          newConfirmationNumber = 'AA00001';
        } else {
          // Move to next letter with 00001
          newConfirmationNumber = String.fromCharCode(nextLetterCode) + '00001';
        }
      }
    } else {
      // Double letter format (AA00001)
      const firstLetter = lastNumber.charAt(0);
      const secondLetter = lastNumber.charAt(1);
      const number = parseInt(lastNumber.substring(2));
      
      if (number < 99999) {
        // Increment the number
        const nextNumber = (number + 1).toString().padStart(5, '0');
        newConfirmationNumber = firstLetter + secondLetter + nextNumber;
      } else {
        // Roll over letters
        if (secondLetter === 'Z') {
          // Roll over both letters (AZ -> BA)
          const nextFirstLetter = String.fromCharCode(firstLetter.charCodeAt(0) + 1);
          newConfirmationNumber = nextFirstLetter + 'A00001';
        } else {
          // Increment second letter
          const nextSecondLetter = String.fromCharCode(secondLetter.charCodeAt(0) + 1);
          newConfirmationNumber = firstLetter + nextSecondLetter + '00001';
        }
      }
    }
  }
  
  // Double-check uniqueness (in case of race conditions)
  const existingLead = await prisma.lead.findFirst({
    where: { 
      confirmationNumber: newConfirmationNumber,
      organizationId
    }
  });
  
  if (existingLead) {
    // Recursively generate next number if conflict exists
    return await generateConfirmationNumber(organizationId);
  }
  
  return newConfirmationNumber;
}


const stepFieldMap = [
  { key: 'LEAD_FORM_CUSTOMER_INFO', fields: ['firstName', 'lastName', 'email', 'phone', 'alternatePhone', 'serviceAddress', 'previousAddress'] },
  { key: 'LEAD_FORM_SERVICE', fields: ['serviceTypeIds', 'customerTypeId', 'agentTeamId', 'comment', 'packageTypeIds', 'providerBeingSoldIds'] },
  { key: 'LEAD_FORM_PAYMENT', fields: ['cardType', 'cardholderName', 'cardNumber', 'expiryDate', 'billingAddressPayment', 'otc'] },
  { key: 'LEAD_FORM_SECURITY', fields: ['ssnLastFour', 'stateId', 'dlNumberMasked', 'dlState', 'dlExpiration', 'securityQuestion', 'dateOfBirth', 'securityPin'] },
];


async function canCreateLead(user) {
  const permissions = await getUserPermissions(user);
  return permissions.some(
    perm => perm.resource === 'LEAD_FORM' && (perm.action === 'CREATE' || perm.action === 'POST')
  );
}

async function canPostLead(user) {
  const permissions = await getUserPermissions(user);
  return permissions.some(
    perm => perm.resource === 'LEAD_FORM' && perm.action === 'POST'
  );
}

async function canAccessStep(user, stepKey, action = 'READ') {
  const permissions = await getUserPermissions(user);
  return permissions.some(
    perm => perm.resource === stepKey && perm.action === action
  );
}

async function getAllowedSteps(user, action = 'READ') {
  const permissions = await getUserPermissions(user);
  return stepFieldMap
    .filter(step => permissions.some(perm => perm.resource === step.key && perm.action === action))
    .map(step => step.key);
}

async function convertDisplayNamesToIds(data, organizationId) {
  const lookupFields = [
    { field: 'customerTypeId', type: 'customerType' },
    { field: 'cardTypeId', type: 'cardType' },
    { field: 'clientId', type: 'client' },
    { field: 'providerBeingSoldId', type: 'providerBeingSold' } 
  ];


  for (const lookupField of lookupFields) {
    const value = data[lookupField.field];
    if (value && typeof value === 'string' && isNaN(parseInt(value))) {
     
      console.log(`Converting display name to ID for ${lookupField.field}: ${value}`);
      
      const lookupValue = await prisma.lookupValue.findFirst({
        where: {
          displayName: value,
          type: lookupField.type,
          organizationId: organizationId,
          isActive: true
        }
      });
      
      if (lookupValue) {
        data[lookupField.field] = lookupValue.id;
        console.log(`Converted ${value} to ID: ${lookupValue.id}`);
      } else {
        console.warn(`Lookup value not found for ${lookupField.field}: ${value} - removing from data`);
        delete data[lookupField.field];
      }
    } else if (value && typeof value === 'string' && !isNaN(parseInt(value))) {
      data[lookupField.field] = parseInt(value);
    }
  }

  const arrayFields = [
    { field: 'serviceTypeIds', type: 'serviceType' },
    { field: 'packageTypeIds', type: 'packageType' },
    { field: 'providerBeingSoldIds', type: 'providerBeingSold' }
  ];

  for (const arrayField of arrayFields) {
    const values = data[arrayField.field];
    if (values && Array.isArray(values)) {
      const convertedIds = [];
      for (const value of values) {
        if (typeof value === 'string' && isNaN(parseInt(value))) {
          console.log(`Converting display name to ID for ${arrayField.field}: ${value}`);
          
          const lookupValue = await prisma.lookupValue.findFirst({
            where: {
              displayName: value,
              type: arrayField.type,
              organizationId: organizationId,
              isActive: true
            }
          });
          
          if (lookupValue) {
            convertedIds.push(lookupValue.id);
            console.log(`Converted ${value} to ID: ${lookupValue.id}`);
          } else {
            console.log(`Lookup value not found for ${arrayField.field}: ${value}`);
          }
        } else if (typeof value === 'string' && !isNaN(parseInt(value))) {
          convertedIds.push(parseInt(value));
        } else if (typeof value === 'number') {
          convertedIds.push(value);
        }
      }
      data[arrayField.field] = convertedIds;
    }
  }


  if (data.agentTeamId && typeof data.agentTeamId === 'string' && !isNaN(parseInt(data.agentTeamId))) {
    data.agentTeamId = parseInt(data.agentTeamId);
  }

  return data;
}

exports.createLead = async (req, res, next) => {
  try {
    let data = req.body;
    console.log(' lead data from controller', data);
    
    const fieldMappings = {
      first_name: 'firstName',
      last_name: 'lastName',
      alternate_phone: 'alternatePhone',
      service_address: 'serviceAddress',
      previous_address: 'previousAddress',
      shipping_address: 'shippingAddress',
      service_types: 'serviceTypeIds',
      customer_type: 'customerTypeId',
      agent_team: 'agentTeamId',
      comment: 'comment',
      provider_sold: 'providerBeingSoldIds',
      package_types: 'packageTypeIds',
      card_type: 'cardType',
      cardholder_name: 'cardholderName',
      card_number: 'cardNumber',
      expiry_date: 'expiryDate',
      billing_address_payment: 'billingAddressPayment',
      otc: 'otc',
      ssn_last_four: 'ssnLastFour',
      state_id: 'stateId',
      dl_number_masked: 'dlNumberMasked',
      dl_state: 'dlState',
      dl_expiration: 'dlExpiration',
      security_question: 'securityQuestion',
      security_pin: 'securityPin',
      installation_type: 'installationType',
      installation_datetime: 'installationDatetime',
      assign_to: 'assignedToId',
      status: 'status',
      external_id: 'externalId',
      cvv: 'cvv'
    };

    const mappedData = {};
    for (const [key, value] of Object.entries(data)) {
      const mappedKey = fieldMappings[key] || key;
      mappedData[mappedKey] = value;
    }
    data = mappedData;
    data = await convertDisplayNamesToIds(data, req.user.organizationId);
    if (data.assignedToId && typeof data.assignedToId === 'string' && !isNaN(parseInt(data.assignedToId))) {
      data.assignedToId = parseInt(data.assignedToId);
    } 
    const paymentFields = [
      'cardType',
      'cardholderName',
      'cardNumber',
      'expiryDate',
      'cvv',
      'billingAddressPayment',
      'otc'
    ];
    const paymentData = {};
    for (const field of paymentFields) {
      if (typeof data[field] !== 'undefined' && data[field] !== null && data[field] !== '') {
        paymentData[field] = data[field];
        delete data[field];
      } else if (typeof data[field] !== 'undefined') {
        delete data[field];
      }
    }

    const securityFields = [
      'ssnLastFour',
      'stateId',
      'dlNumberMasked',
      'dlState',
      'dlExpiration',
      'securityQuestion',
      'dateOfBirth'
    ];
    const securityData = {};
    for (const field of securityFields) {
      if (typeof data[field] !== 'undefined' && data[field] !== null && data[field] !== '') {
        securityData[field] = data[field];
        delete data[field];
      } else if (typeof data[field] !== 'undefined') {
        delete data[field];
      }
    }


    const manyToManyFields = ['serviceTypeIds', 'packageTypeIds', 'providerBeingSoldIds'];
    const manyToManyData = {};
    for (const field of manyToManyFields) {
      if (typeof data[field] !== 'undefined' && data[field] !== null && Array.isArray(data[field]) && data[field].length > 0) {
        manyToManyData[field] = data[field];
        delete data[field];
      } else if (typeof data[field] !== 'undefined') {
        delete data[field];
      }
    }
 
    const validLeadFields = [
      'firstName', 'lastName', 'email', 'phone', 'alternatePhone', 'dateOfBirth',
      'serviceAddress', 'previousAddress', 'shippingAddress', 'customerTypeId',
      'agentTeamId', 'comment', 'cardTypeId', 
      'status', 'installationType', 'installationDatetime', 'securityPin', 'assignedToId',
      'externalId'
    ];
    
    const filteredData = {};
    for (const [key, value] of Object.entries(data)) {
      if (validLeadFields.includes(key)) {
        filteredData[key] = value;
      } else {
        console.log(`Filtering out field: ${key} (not in validLeadFields)`);
      }
    }
    data = filteredData;
    
    const requiredFields = ['firstName', 'lastName', 'email', 'phone', 'serviceAddress'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        error: 'Missing required fields', 
        missingFields,
        message: `The following fields are required: ${missingFields.join(', ')}`
      });
    }
    const hasCreatePermission = await canCreateLead(req.user);
    const isOrgAdmin = req.user.roles && req.user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
    const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
    
    if (!hasCreatePermission && !isOrgAdmin && !isSuperAdmin) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You do not have permission to create leads. You need CREATE or POST permission. Contact your administrator for access.'
      });
    }
    
    if (isOrgAdmin || isSuperAdmin) {
      console.log('User is admin - bypassing step permission checks for lead creation');
    } else {
      for (const step of stepFieldMap) {
        const hasPermission = await canAccessStep(req.user, step.key, 'MANAGE');
        console.log(`Step ${step.key}: ${hasPermission ? 'ALLOWED' : 'BLOCKED'}`);
        
        if (!hasPermission) {
          for (const field of step.fields) {
            if (field in data) {
              console.log(`Removing field: ${field} (no permission for ${step.key})`);
              delete data[field];
            }
          }
        }
      }
    }
      
    const dateFields = ['installationDatetime'];
    for (const field of dateFields) {
      if (data[field] && typeof data[field] === 'string' && data[field].trim() !== '') {
        try {
          const date = new Date(data[field]);
          if (!isNaN(date.getTime())) {
            data[field] = date.toISOString();
          } else {
            delete data[field];
          }
        } catch (error) {
          delete data[field];
        }
      } else if (data[field] === '' || data[field] === null || data[field] === undefined) {
        delete data[field];
      }
    }
    const optionalFieldsToClean = [
      'alternatePhone', 'previousAddress', 'shippingAddress',
      'installationType'
    ];
    
    for (const field of optionalFieldsToClean) {
      if (data[field] === '' || data[field] === null || data[field] === undefined) {
        delete data[field];
      }
    }

    if (data.assignedToId === '' || data.assignedToId === null || data.assignedToId === undefined) {
      data.assignedToId = null;
    } else if (typeof data.assignedToId === 'string' && !isNaN(parseInt(data.assignedToId))) {
      data.assignedToId = parseInt(data.assignedToId);
    }
    
    if (req.user && req.user.organizationId) {
      data.organizationId = req.user.organizationId;
    }
    if (req.user && req.user.id) {
      data.createdById = req.user.id;
    }
    if (data.assignedToId) {
      data.assignedToId = data.assignedToId;
    }
    
    if (!data.status) {
      data.status = 'OPEN';
    }


    if (data.customerTypeId) {
      const customerType = await prisma.lookupValue.findFirst({
        where: { id: data.customerTypeId, organizationId: req.user.organizationId }
      });
      if (!customerType) {
        return res.status(400).json({ error: 'Invalid customer type ID' });
      }
    }
    if (data.agentTeamId) {
      const agentTeam = await prisma.role.findFirst({
        where: { 
          id: data.agentTeamId, 
          organizationId: req.user.organizationId
        }
      });
      if (!agentTeam) {
        return res.status(400).json({ error: 'Invalid agent team ID - role not found' });
      }
    }
    
    const lead = await prisma.lead.create({ data });
    
    if (data.assignedToId && data.assignedToId !== req.user.id) {
      try {
        await createLeadAssignmentNotification(
          lead.id,
          data.assignedToId,
          req.user.id,
          req.user.organizationId
        );
      } catch (notificationError) {
        console.error('Error creating lead assignment notification:', notificationError);
      }
    }


    if (manyToManyData.serviceTypeIds && Array.isArray(manyToManyData.serviceTypeIds) && manyToManyData.serviceTypeIds.length > 0) {
      try {
        const serviceTypeRelations = manyToManyData.serviceTypeIds.map(serviceTypeId => ({
          leadId: lead.id,
          serviceTypeId: serviceTypeId,
          organizationId: req.user.organizationId
        }));
        await prisma.leadServiceType.createMany({
          data: serviceTypeRelations
        });
        console.log(`Created ${serviceTypeRelations.length} service type relations`);
      } catch (serviceTypeError) {
        console.error('Error creating service type relations:', serviceTypeError);
      }
    }
    if (manyToManyData.packageTypeIds && Array.isArray(manyToManyData.packageTypeIds) && manyToManyData.packageTypeIds.length > 0) {
      try {
        const packageTypeRelations = manyToManyData.packageTypeIds.map(packageTypeId => ({
          leadId: lead.id,
          packageTypeId: packageTypeId,
          organizationId: req.user.organizationId
        }));
        await prisma.leadPackageType.createMany({
          data: packageTypeRelations
        });
        console.log(`Created ${packageTypeRelations.length} package type relations`);
      } catch (packageTypeError) {
        console.error('Error creating package type relations:', packageTypeError);
      }
    }
    if (manyToManyData.providerBeingSoldIds && Array.isArray(manyToManyData.providerBeingSoldIds) && manyToManyData.providerBeingSoldIds.length > 0) {
      try {
        const providerRelations = manyToManyData.providerBeingSoldIds.map(providerId => ({
          leadId: lead.id,
          providerBeingSoldId: providerId,
          organizationId: req.user.organizationId
        }));
        await prisma.leadProviderBeingSold.createMany({
          data: providerRelations
        });
        console.log(`Created ${providerRelations.length} provider being sold relations`);
      } catch (providerError) {
        console.error('Error creating provider being sold relations:', providerError);
      }
    }
    
    if (Object.keys(paymentData).length > 0) {
      console.log('Creating payment record with data:', paymentData);
      try {
        const payment = await prisma.payment.create({
          data: {
            ...paymentData,
            leadId: lead.id,
            organizationId: req.user.organizationId
          }
        });
        console.log('Payment record created successfully:', payment.id);
      } catch (paymentError) {
        console.error('Error creating payment record:', paymentError);  
      }
    } else {
      console.log('No payment data to create - paymentData is empty');
    }
    if (Object.keys(securityData).length > 0) {
      if (securityData.dateOfBirth && typeof securityData.dateOfBirth === 'string' && securityData.dateOfBirth.trim() !== '') {
        try {
          const date = new Date(securityData.dateOfBirth);
          if (!isNaN(date.getTime())) {
            securityData.dateOfBirth = date.toISOString();
          } else {
            delete securityData.dateOfBirth;
          }
        } catch (error) {
          delete securityData.dateOfBirth;
        }
      } else if (securityData.dateOfBirth === '' || securityData.dateOfBirth === null || securityData.dateOfBirth === undefined) {
        delete securityData.dateOfBirth;
      }
      
      if (securityData.dlExpiration && typeof securityData.dlExpiration === 'string' && securityData.dlExpiration.trim() !== '') {
        try {
          const date = new Date(securityData.dlExpiration);
          if (!isNaN(date.getTime())) {
            securityData.dlExpiration = date.toISOString();
          } else {
            delete securityData.dlExpiration;
          }
        } catch (error) {
          delete securityData.dlExpiration;
        }
      } else if (securityData.dlExpiration === '' || securityData.dlExpiration === null || securityData.dlExpiration === undefined) {
        delete securityData.dlExpiration;
      }
      
      await prisma.security.create({
        data: {
          ...securityData,
          leadId: lead.id,
          organizationId: req.user.organizationId
        }
      });
    }
    const completeLead = await prisma.lead.findUnique({
      where: { id: lead.id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        customerType: {
          select: {
            id: true,
            displayName: true,
            value: true
          }
        },
        agentTeam: {
          select: {
            id: true,
            name: true,
            description: true,
            isAgent: true
          }
        },
        cardType: {
          select: {
            id: true,
            displayName: true,
            value: true
          }
        },
        payments: true,
        securities: true,
        leadServiceTypes: {
          include: {
            serviceType: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            }
          }
        },
        leadPackageTypes: {
          include: {
            packageType: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            }
          }
        },
        leadProviderBeingSold: {
          include: {
            providerBeingSold: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            }
          }
        }
      }
    });

    res.status(201).json(completeLead);
  } catch (error) {
    next(error);
  }
};


exports.postLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id); 
    if (isNaN(leadId)) {
      return res.status(400).json({ error: 'Invalid lead ID' });
    }
    const hasPostPermission = await canPostLead(req.user);
    const isOrgAdmin = req.user.roles && req.user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
    const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
    
    if (!hasPostPermission && !isOrgAdmin && !isSuperAdmin) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You do not have permission to post/submit leads. You need POST permission. Contact your administrator for access.'
      });
    }

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        organization: true
      }
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    } 
    if (lead.organizationId !== req.user.organizationId && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access denied to this lead' });
    }
    if (lead.status !== 'OPEN') {
      return res.status(400).json({ 
        error: 'Invalid lead status for posting',
        message: `Lead must be in OPEN status to be posted. Current status: ${lead.status}`
      });
    }
    let data = req.body;
    
    if (data && Object.keys(data).length > 0) {
      const fieldMappings = {
        first_name: 'firstName',
        last_name: 'lastName',
        alternate_phone: 'alternatePhone',
        service_address: 'serviceAddress',
        previous_address: 'previousAddress',
        shipping_address: 'shippingAddress',
        service_types: 'serviceTypeIds',
        customer_type: 'customerTypeId',
        agent_team: 'agentTeamId',
        provider_sold: 'providerBeingSoldIds',
        package_types: 'packageTypeIds',
        card_type: 'cardType',
        cardholder_name: 'cardholderName',
        card_number: 'cardNumber',
        expiry_date: 'expiryDate',
        billing_address_payment: 'billingAddressPayment',
        otc: 'otc',
        ssn_last_four: 'ssnLastFour',
        state_id: 'stateId',
        dl_number_masked: 'dlNumberMasked',
        dl_state: 'dlState',
        dl_expiration: 'dlExpiration',
        security_question: 'securityQuestion',
        security_pin: 'securityPin',
        installation_type: 'installationType',
        installation_datetime: 'installationDatetime',
        assign_to: 'assignedToId',
        status: 'status',
        external_id: 'externalId',
        cvv: 'cvv'
      };

      const mappedData = {};
      for (const [key, value] of Object.entries(data)) {
        const mappedKey = fieldMappings[key] || key;
        mappedData[mappedKey] = value;
      }
      data = mappedData;
      
      // Process service_configurations if present
      if (data.service_configurations && Array.isArray(data.service_configurations)) {
        console.log('Processing service_configurations in postLead:', data.service_configurations);
        
        // Extract providerBeingSoldIds from service_configurations
        const providerIds = data.service_configurations
          .map(config => config.providerId)
          .filter(id => id && id !== '')
          .map(id => parseInt(id))
          .filter(id => !isNaN(id));
        
        // Extract serviceTypeIds from service_configurations  
        const serviceTypeIds = data.service_configurations
          .map(config => config.serviceTypeId)
          .filter(id => id && id !== '')
          .map(id => parseInt(id))
          .filter(id => !isNaN(id));
          
        // Extract packageTypeIds from service_configurations
        const packageTypeIds = data.service_configurations
          .map(config => config.packageTypeId)
          .filter(id => id && id !== '')
          .map(id => parseInt(id))
          .filter(id => !isNaN(id));
        
        // Set the extracted IDs, but only if the original fields are empty
        if (providerIds.length > 0 && (!data.providerBeingSoldIds || data.providerBeingSoldIds === '')) {
          data.providerBeingSoldIds = providerIds;
          console.log('Extracted providerBeingSoldIds from service_configurations in postLead:', providerIds);
        }
        
        if (serviceTypeIds.length > 0 && (!data.serviceTypeIds || data.serviceTypeIds === '')) {
          data.serviceTypeIds = serviceTypeIds;
          console.log('Extracted serviceTypeIds from service_configurations in postLead:', serviceTypeIds);
        }
        
        if (packageTypeIds.length > 0 && (!data.packageTypeIds || data.packageTypeIds === '')) {
          data.packageTypeIds = packageTypeIds;
          console.log('Extracted packageTypeIds from service_configurations in postLead:', packageTypeIds);
        }
        
        // Remove service_configurations from data as it's not a direct lead field
        delete data.service_configurations;
      }
      
      data = await convertDisplayNamesToIds(data, req.user.organizationId);
      
      if (data.assignedToId && typeof data.assignedToId === 'string' && !isNaN(parseInt(data.assignedToId))) {
        data.assignedToId = parseInt(data.assignedToId);
      }
      if (data.assignedToId === '' || data.assignedToId === null || data.assignedToId === undefined) {
        data.assignedToId = null;
      } else if (typeof data.assignedToId === 'string' && !isNaN(parseInt(data.assignedToId))) {
        data.assignedToId = parseInt(data.assignedToId);
      }

      const paymentFields = [
        'cardType',
        'cardholderName',
        'cardNumber',
        'expiryDate',
        'cvv',
        'billingAddressPayment',
        'otc'
      ];
      const paymentData = {};
      for (const field of paymentFields) {
        if (typeof data[field] !== 'undefined' && data[field] !== null && data[field] !== '') {
          paymentData[field] = data[field];
          delete data[field];
        } else if (typeof data[field] !== 'undefined') {
          delete data[field];
        }
      }
      const securityFields = [
        'ssnLastFour',
        'stateId',
        'dlNumberMasked',
        'dlState',
        'dlExpiration',
        'securityQuestion',
        'dateOfBirth'
      ];
      const securityData = {};
      for (const field of securityFields) {
        if (typeof data[field] !== 'undefined' && data[field] !== null && data[field] !== '') {
          securityData[field] = data[field];
          delete data[field];
        } else if (typeof data[field] !== 'undefined') {
          delete data[field];
        }
      }
      if (securityData.dlExpiration && typeof securityData.dlExpiration === 'string' && securityData.dlExpiration.trim() !== '') {
        try {
          const date = new Date(securityData.dlExpiration);
          if (!isNaN(date.getTime())) {
            securityData.dlExpiration = date.toISOString();
          } else {
            delete securityData.dlExpiration;
          }
        } catch (error) {
          delete securityData.dlExpiration;
        }
      } else if (securityData.dlExpiration === '' || securityData.dlExpiration === null) {
        delete securityData.dlExpiration;
      }
      
      if (securityData.dateOfBirth && typeof securityData.dateOfBirth === 'string' && securityData.dateOfBirth.trim() !== '') {
        try {
          const date = new Date(securityData.dateOfBirth);
          if (!isNaN(date.getTime())) {
            securityData.dateOfBirth = date.toISOString();
          } else {
            delete securityData.dateOfBirth;
          }
        } catch (error) {
          delete securityData.dateOfBirth;
        }
      } else if (securityData.dateOfBirth === '' || securityData.dateOfBirth === null) {
        delete securityData.dateOfBirth;
      }
      const validLeadFields = [
        'firstName', 'lastName', 'email', 'phone', 'alternatePhone',
        'serviceAddress', 'previousAddress', 'shippingAddress', 'customerTypeId',
        'agentTeamId', 'comment', 'cardTypeId', 
        'status', 'installationType', 'installationDatetime', 'assignedToId',
        'externalId', 'serviceTypeIds', 'packageTypeIds', 'providerBeingSoldIds',
        'service_configurations'
      ];
      
      const filteredData = {};
      for (const [key, value] of Object.entries(data)) {
        if (validLeadFields.includes(key)) {
          filteredData[key] = value;
        }
      }
      data = filteredData;
      const dateFields = ['installationDatetime'];
      for (const field of dateFields) {
        if (data[field] && typeof data[field] === 'string' && data[field].trim() !== '') {
          try {
            const date = new Date(data[field]);
            if (!isNaN(date.getTime())) {
              data[field] = date.toISOString();
            } else {
              delete data[field];
            }
          } catch (error) {
            delete data[field];
          }
        } else if (data[field] === '' || data[field] === null || data[field] === undefined) {
          delete data[field];
        }
      }
      const optionalFieldsToClean = [
        'alternatePhone', 'previousAddress', 'shippingAddress',
        'installationType'
      ];
      
      for (const field of optionalFieldsToClean) {
        if (data[field] === '' || data[field] === null || data[field] === undefined) {
          delete data[field];
        }
      }
      
      if (req.user && req.user.organizationId) {
        data.organizationId = req.user.organizationId;
      }
      if (req.user && req.user.id) {
        data.updatedById = req.user.id;
      }
      data.status = 'COMPLETED';
      
      // Generate confirmation number if not already present
      if (!lead.confirmationNumber) {
        data.confirmationNumber = await generateConfirmationNumber(req.user.organizationId);
      }
      
      const result = await prisma.$transaction(async (tx) => {
        // Filter out fields that shouldn't be passed to lead.update()
        const leadUpdateData = { ...data };
        delete leadUpdateData.serviceTypeIds;
        delete leadUpdateData.packageTypeIds;
        delete leadUpdateData.providerBeingSoldIds;
        
        // Convert agentTeamId to agentTeam relation if present
        if (leadUpdateData.agentTeamId) {
          leadUpdateData.agentTeam = {
            connect: { id: leadUpdateData.agentTeamId }
          };
          delete leadUpdateData.agentTeamId;
        }
        
        // Convert assignedToId to assignedTo relation if present
        if (leadUpdateData.assignedToId) {
          leadUpdateData.assignedTo = {
            connect: { id: leadUpdateData.assignedToId }
          };
          delete leadUpdateData.assignedToId;
        }

        // Convert lookup value IDs to relations if present
        if (leadUpdateData.customerTypeId) {
          leadUpdateData.customerType = {
            connect: { id: leadUpdateData.customerTypeId }
          };
          delete leadUpdateData.customerTypeId;
        }

        if (leadUpdateData.cardTypeId) {
          leadUpdateData.cardType = {
            connect: { id: leadUpdateData.cardTypeId }
          };
          delete leadUpdateData.cardTypeId;
        }
        
        const updatedLead = await tx.lead.update({
          where: { id: leadId },
          data: leadUpdateData,
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            agentTeam: {
              select: {
                id: true,
                name: true,
                description: true,
                isAgent: true
              }
            },
            cardType: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            },
            payments: true,
            securities: true,
            leadServiceTypes: {
              include: {
                serviceType: {
                  select: {
                    id: true,
                    displayName: true,
                    value: true
                  }
                }
              }
            },
            leadPackageTypes: {
              include: {
                packageType: {
                  select: {
                    id: true,
                    displayName: true,
                    value: true
                  }
                }
              }
            },
            leadProviderBeingSold: {
              include: {
                providerBeingSold: {
                  select: {
                    id: true,
                    displayName: true,
                    value: true
                  }
                }
              }
            }
          }
        });

        if (Object.keys(paymentData).length > 0) {
          const existingPayment = await tx.payment.findFirst({ where: { leadId: leadId } });
          if (existingPayment) {
            await tx.payment.update({
              where: { id: existingPayment.id },
              data: paymentData
            });
          } else {
            await tx.payment.create({
              data: {
                ...paymentData,
                leadId: leadId,
                organizationId: req.user.organizationId
              }
            });
          }
        }
        
        if (Object.keys(securityData).length > 0) {
          const existingSecurity = await tx.security.findFirst({ where: { leadId: leadId } });
          if (existingSecurity) {
            await tx.security.update({
              where: { id: existingSecurity.id },
              data: securityData
            });
          } else {
            await tx.security.create({
              data: {
                ...securityData,
                leadId: leadId,
                organizationId: req.user.organizationId
              }
            });
          }
        }
        
        // When marking as COMPLETED or CLOSED_LOST, delete security data and filter payment data
        if (data.status === 'COMPLETED' || data.status === 'CLOSED_LOST') {
          // Delete all security data
          await tx.security.deleteMany({
            where: { leadId: leadId }
          });

          // Update payment data to keep only cardholderName, masked cardNumber, and otc
          const existingPayments = await tx.payment.findMany({
            where: { leadId: leadId }
          });

          for (const payment of existingPayments) {
            const filteredPaymentData = {};
            if (payment.cardholderName) filteredPaymentData.cardholderName = payment.cardholderName;
            if (payment.cardNumber) filteredPaymentData.cardNumber = maskCardNumber(payment.cardNumber);
            if (payment.otc) filteredPaymentData.otc = payment.otc;
            
            // Clear sensitive fields
            filteredPaymentData.cvv = null;
            filteredPaymentData.expiryDate = null;
            filteredPaymentData.billingAddressPayment = null;
            filteredPaymentData.cardType = null;

            await tx.payment.update({
              where: { id: payment.id },
              data: filteredPaymentData
            });
          }
        }
        if (data.serviceTypeIds !== undefined) {
          await tx.leadServiceType.deleteMany({ where: { leadId: leadId } });
          
          if (Array.isArray(data.serviceTypeIds) && data.serviceTypeIds.length > 0) {
            const serviceTypeRelations = data.serviceTypeIds.map(serviceTypeId => ({
              leadId: leadId,
              serviceTypeId: serviceTypeId,
              organizationId: req.user.organizationId
            }));
            await tx.leadServiceType.createMany({ data: serviceTypeRelations });
            console.log(`Updated ${serviceTypeRelations.length} service type relations for lead ${leadId}`);
          }
        }
        
        // Handle package type relationships
        if (data.packageTypeIds !== undefined) {
          await tx.leadPackageType.deleteMany({ where: { leadId: leadId } });
          
          if (Array.isArray(data.packageTypeIds) && data.packageTypeIds.length > 0) {
            const packageTypeRelations = data.packageTypeIds.map(packageTypeId => ({
              leadId: leadId,
              packageTypeId: packageTypeId,
              organizationId: req.user.organizationId
            }));
            await tx.leadPackageType.createMany({ data: packageTypeRelations });
            console.log(`Updated ${packageTypeRelations.length} package type relations for lead ${leadId}`);
          }
        }
        
        // Handle provider being sold relationships
        if (data.providerBeingSoldIds !== undefined) {
          console.log(`Processing providerBeingSoldIds for lead ${leadId} in postLead:`, data.providerBeingSoldIds);
          console.log(`Type of providerBeingSoldIds:`, typeof data.providerBeingSoldIds);
          console.log(`Is array:`, Array.isArray(data.providerBeingSoldIds));
          
          // Convert empty string to empty array
          if (data.providerBeingSoldIds === "" || data.providerBeingSoldIds === null) {
            data.providerBeingSoldIds = [];
            console.log(`Converted empty string/null to empty array for providerBeingSoldIds in postLead`);
          }
          
          // Only process if it's an array
          if (Array.isArray(data.providerBeingSoldIds)) {
            await tx.leadProviderBeingSold.deleteMany({ where: { leadId: leadId } });
            console.log(`Deleted existing provider relationships for lead ${leadId} in postLead`);
            
            // Only create new ones if array is not empty
            if (data.providerBeingSoldIds.length > 0) {
              const providerRelations = data.providerBeingSoldIds.map(providerId => ({
                leadId: leadId,
                providerBeingSoldId: providerId,
                organizationId: req.user.organizationId
              }));
              await tx.leadProviderBeingSold.createMany({ data: providerRelations });
              console.log(`Updated ${providerRelations.length} provider being sold relations for lead ${leadId} in postLead`);
            } else {
              console.log(`Empty providerBeingSoldIds array - relationships deleted but not recreated for lead ${leadId} in postLead`);
            }
          } else {
            console.log(`providerBeingSoldIds is not an array, skipping provider relationship updates for lead ${leadId} in postLead`);
          }
        } else {
          console.log(`providerBeingSoldIds not provided - skipping provider relationship updates for lead ${leadId} in postLead`);
        }
        return updatedLead;
      });
      await req.createAuditLog({
        action: 'POST',
        resource: 'LEAD_FORM',
        resourceId: leadId,
        oldValues: { status: 'OPEN' },
        newValues: { 
          status: 'COMPLETED',
          updatedFields: Object.keys(data).filter(key => key !== 'status')
        },
        organizationId: req.user.organizationId
      });

      res.json({
        message: 'Lead updated and posted successfully',
        lead: result
      });

    } else {
      const result = await prisma.$transaction(async (tx) => {
        // Generate confirmation number if not already present
        const existingLead = await tx.lead.findUnique({
          where: { id: leadId },
          select: { confirmationNumber: true }
        });
        
        let confirmationNumber = existingLead.confirmationNumber;
        if (!confirmationNumber) {
          confirmationNumber = await generateConfirmationNumber(req.user.organizationId);
        }

        const updatedLead = await tx.lead.update({
          where: { id: leadId },
          data: { 
            status: 'COMPLETED',
            confirmationNumber: confirmationNumber,
            updatedAt: new Date()
          },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true
              }
            },

            agentTeam: {
              select: {
                id: true,
                name: true,
                description: true,
                isAgent: true
              }
            },
            leadPackageTypes: {
              include: {
                packageType: {
                  select: {
                    id: true,
                    displayName: true,
                    value: true
                  }
                }
              }
            },
            leadProviderBeingSold: {
              include: {
                providerBeingSold: {
                  select: {
                    id: true,
                    displayName: true,
                    value: true
                  }
                }
              }
            },
            cardType: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            },
            payments: true,
            securities: true,
            leadServiceTypes: {
              include: {
                serviceType: {
                  select: {
                    id: true,
                    displayName: true,
                    value: true
                  }
                }
              }
            }
          }
        });

        // When marking as COMPLETED, delete security data and filter payment data
        // Delete all security data
        await tx.security.deleteMany({
          where: { leadId: leadId }
        });

        // Update payment data to keep only cardholderName, masked cardNumber, and otc
        const existingPayments = await tx.payment.findMany({
          where: { leadId: leadId }
        });

        for (const payment of existingPayments) {
          const filteredPaymentData = {};
          if (payment.cardholderName) filteredPaymentData.cardholderName = payment.cardholderName;
          if (payment.cardNumber) filteredPaymentData.cardNumber = maskCardNumber(payment.cardNumber);
          if (payment.otc) filteredPaymentData.otc = payment.otc;
          
          // Clear sensitive fields
          filteredPaymentData.cvv = null;
          filteredPaymentData.expiryDate = null;
          filteredPaymentData.billingAddressPayment = null;
          filteredPaymentData.cardType = null;

          await tx.payment.update({
            where: { id: payment.id },
            data: filteredPaymentData
          });
        }

        return {
          updatedLead
        };
      });
      await req.createAuditLog({
        action: 'POST',
        resource: 'LEAD_FORM',
        resourceId: leadId,
        oldValues: { status: 'OPEN' },
        newValues: { 
          status: 'COMPLETED'
        },
        organizationId: req.user.organizationId
      });

      res.json({
        message: 'Lead posted successfully',
        lead: result.updatedLead
      });
    }

  } catch (error) {
    next(error);
  }
};

exports.getLeadById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id);
    
    if (isNaN(leadId)) {
      return res.status(400).json({ error: 'Invalid lead ID' });
    }
    
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        alternatePhone: true,
        serviceAddress: true,
        previousAddress: true,
        shippingAddress: true,
        comment: true,
        status: true,
        installationType: true,
        installationDatetime: true,
        externalId: true,
        securityPin: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        customerType: {
          select: {
            id: true,
            displayName: true,
            value: true
          }
        },
        agentTeam: {
          select: {
            id: true,
            name: true,
            description: true,
            isAgent: true
          }
        },
        cardType: {
          select: {
            id: true,
            displayName: true,
            value: true
          }
        },
        payments: true,
        securities: true,
        leadServiceTypes: {
          include: {
            serviceType: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            }
          }
        },
        leadPackageTypes: {
          include: {
            packageType: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            }
          }
        },
        leadProviderBeingSold: {
          include: {
            providerBeingSold: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            }
          }
        }
      }
    });
    
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

exports.getLeads = async (req, res, next) => {
  try {
    const leads = await prisma.lead.findMany();
    res.json(leads);
  } catch (error) {
    next(error);
  }
};

exports.getLeadsByOrganization = async (req, res, next) => {
  try {
    const { organizationId } = req.params;
    const { page = 1, limit = 10, status, search } = req.query;
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }
    const where = {
      organizationId: parseInt(organizationId)
    };
 
    if (status) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { serviceAddress: { contains: search, mode: 'insensitive' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          alternatePhone: true,
          serviceAddress: true,
          previousAddress: true,
          shippingAddress: true,
          comment: true,
          status: true,
          installationType: true,
          externalId: true,
          securityPin: true,
          confirmationNumber: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          agentTeam: {
            select: {
              id: true,
              name: true,
              description: true,
              isAgent: true
            }
          },
          cardType: {
            select: {
              id: true,
              displayName: true,
              value: true
            }
          },
          payments: {
            select: {
              id: true,
              cardType: true,
              cardholderName: true,
              otc: true
            }
          },
          securities: {
            select: {
              id: true,
              ssnLastFour: true,
              dlState: true,
            }
          },
          leadServiceTypes: {
            include: {
              serviceType: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          },
          leadPackageTypes: {
            include: {
              packageType: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          },
          leadProviderBeingSold: {
            include: {
              providerBeingSold: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.lead.count({ where })
    ]);
    
    const totalPages = Math.ceil(total / take);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.json({
      leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: take,
        hasNextPage,
        hasPrevPage
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id);
    
    if (isNaN(leadId)) {
      return res.status(400).json({ error: 'Invalid lead ID' });
    }
    const hasUpdatePermission = await canCreateLead(req.user); 
    const isOrgAdmin = req.user.roles && req.user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
    const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
    
    if (!hasUpdatePermission && !isOrgAdmin && !isSuperAdmin) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You do not have permission to update leads. You need UPDATE permission. Contact your administrator for access.'
      });
    }
    let data = req.body;
    const fieldMappings = {
      first_name: 'firstName',
      last_name: 'lastName',
      alternate_phone: 'alternatePhone',
      service_address: 'serviceAddress',
      previous_address: 'previousAddress',
      shipping_address: 'shippingAddress',
      service_types: 'serviceTypeIds',
      agent_team: 'agentTeamId',
      provider_sold: 'providerBeingSoldIds',
      package_types: 'packageTypeIds',
      card_type: 'cardType',
      customer_type: 'customerTypeId',
      cardholder_name: 'cardholderName',
      card_number: 'cardNumber',
      expiry_date: 'expiryDate',
      billing_address_payment: 'billingAddressPayment',
      otc: 'otc',
      ssn_last_four: 'ssnLastFour',
      state_id: 'stateId',
      dl_number_masked: 'dlNumberMasked',
      dl_state: 'dlState',
      dl_expiration: 'dlExpiration',
      security_question: 'securityQuestion',
      security_pin: 'securityPin',
      installation_type: 'installationType',
      installation_datetime: 'installationDatetime',
      assign_to: 'assignedToId',  
      status: 'status',
      external_id: 'externalId',
      cvv: 'cvv'
    };

    const mappedData = {};
    for (const [key, value] of Object.entries(data)) {
      const mappedKey = fieldMappings[key] || key;
      mappedData[mappedKey] = value;
    }
    data = mappedData;
    
    // Process service_configurations if present
    if (data.service_configurations && Array.isArray(data.service_configurations)) {

      
      // Extract providerBeingSoldIds from service_configurations
      const providerIds = data.service_configurations
        .map(config => config.providerId)
        .filter(id => id && id !== '')
        .map(id => parseInt(id))
        .filter(id => !isNaN(id));
      
      // Extract serviceTypeIds from service_configurations  
      const serviceTypeIds = data.service_configurations
        .map(config => config.serviceTypeId)
        .filter(id => id && id !== '')
        .map(id => parseInt(id))
        .filter(id => !isNaN(id));
        
      // Extract packageTypeIds from service_configurations
      const packageTypeIds = data.service_configurations
        .map(config => config.packageTypeId)
        .filter(id => id && id !== '')
        .map(id => parseInt(id))
        .filter(id => !isNaN(id));
      
      // Set the extracted IDs, but only if the original fields are empty
      if (providerIds.length > 0 && (!data.providerBeingSoldIds || data.providerBeingSoldIds === '')) {
        data.providerBeingSoldIds = providerIds;
      }
      
      if (serviceTypeIds.length > 0 && (!data.serviceTypeIds || data.serviceTypeIds === '')) {
        data.serviceTypeIds = serviceTypeIds;

      }
      
      if (packageTypeIds.length > 0 && (!data.packageTypeIds || data.packageTypeIds === '')) {
        data.packageTypeIds = packageTypeIds;

      }
      
      // Remove service_configurations from data as it's not a direct lead field
      delete data.service_configurations;
    }
    
    data = await convertDisplayNamesToIds(data, req.user.organizationId);
    
    if (data.assignedToId && typeof data.assignedToId === 'string' && !isNaN(parseInt(data.assignedToId))) {
      data.assignedToId = parseInt(data.assignedToId);
    }    
    if (data.assignedToId === '' || data.assignedToId === null || data.assignedToId === undefined) {
      data.assignedToId = null;
    } else if (typeof data.assignedToId === 'string' && !isNaN(parseInt(data.assignedToId))) {
      data.assignedToId = parseInt(data.assignedToId);
    }
    const paymentFields = [
      'cardType',
      'cardholderName',
      'cardNumber',
      'expiryDate',
      'cvv',
      'billingAddressPayment',
      'otc'
    ];
    const paymentData = {};
    for (const field of paymentFields) {
      if (typeof data[field] !== 'undefined' && data[field] !== null && data[field] !== '') {
        paymentData[field] = data[field];
        delete data[field];
      } else if (typeof data[field] !== 'undefined') {
        delete data[field];
      }
    }
    const securityFields = [
      'ssnLastFour',
      'stateId',
      'dlNumberMasked',
      'dlState',
      'dlExpiration',
      'securityQuestion',
      'dateOfBirth'
    ];
    const securityData = {};
    for (const field of securityFields) {
      if (typeof data[field] !== 'undefined' && data[field] !== null && data[field] !== '') {
        securityData[field] = data[field];
        delete data[field];
      } else if (typeof data[field] !== 'undefined') {
        delete data[field];
      }
    }

    if (securityData.dlExpiration && typeof securityData.dlExpiration === 'string' && securityData.dlExpiration.trim() !== '') {
      try {
        const date = new Date(securityData.dlExpiration);
        if (!isNaN(date.getTime())) {
          securityData.dlExpiration = date.toISOString();
        } else {
          delete securityData.dlExpiration;
        }
      } catch (error) {
        delete securityData.dlExpiration;
      }
    } else if (securityData.dlExpiration === '' || securityData.dlExpiration === null) {
      delete securityData.dlExpiration;
    }
    
    if (securityData.dateOfBirth && typeof securityData.dateOfBirth === 'string' && securityData.dateOfBirth.trim() !== '') {
      try {
        const date = new Date(securityData.dateOfBirth);
        if (!isNaN(date.getTime())) {
          securityData.dateOfBirth = date.toISOString();
        } else {
          delete securityData.dateOfBirth;
        }
      } catch (error) {
        delete securityData.dateOfBirth;
      }
    } else if (securityData.dateOfBirth === '' || securityData.dateOfBirth === null) {
      delete securityData.dateOfBirth;
    }
    const validLeadFields = [
      'firstName', 'lastName', 'email', 'phone', 'alternatePhone',
      'serviceAddress', 'previousAddress', 'shippingAddress', 'customerTypeId',
      'agentTeamId', 'comment', 'cardTypeId', 'dateOfBirth',
      'status', 'installationType', 'installationDatetime', 'securityPin', 'assignedToId',
      'externalId', 'serviceTypeIds', 'packageTypeIds', 'providerBeingSoldIds',
      'service_configurations'
    ];
    
    const filteredData = {};
    for (const [key, value] of Object.entries(data)) {
      if (validLeadFields.includes(key)) {
        filteredData[key] = value;
      }
    }
    data = filteredData;
    const hasPostPermission = await canPostLead(req.user);
    if ((data.status === 'COMPLETED' || data.status === 'CLOSED_LOST') && !hasPostPermission && !isOrgAdmin && !isSuperAdmin) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        message: 'You do not have permission to mark leads as completed or closed lost. Use the POST endpoint instead.'
      });
    }
    const dateFields = ['installationDatetime'];
    for (const field of dateFields) {
      if (data[field] && typeof data[field] === 'string' && data[field].trim() !== '') {
        try {
          const date = new Date(data[field]);
          if (!isNaN(date.getTime())) {
            data[field] = date.toISOString();
          } else {
            delete data[field];
          }
        } catch (error) {
          delete data[field];
        }
      } else if (data[field] === '' || data[field] === null || data[field] === undefined) {
        delete data[field];
      }
    }
    const optionalFieldsToClean = [
      'alternatePhone', 'previousAddress', 'shippingAddress',
      'installationType'
    ];    
    for (const field of optionalFieldsToClean) {
      if (data[field] === '' || data[field] === null || data[field] === undefined) {
        delete data[field];
      }
    }

    if (data.status === 'CANCELLED') {
      const hasCancelPermission = req.user.permissions && req.user.permissions.some(
        perm => perm.action === 'UPDATE' && perm.resource === 'LEAD_FORM'
      );
      
      if (!hasCancelPermission && !isOrgAdmin && !isSuperAdmin) {
        return res.status(403).json({ error: 'You do not have permission to cancel leads.' });
      }
    }

    // Generate confirmation number if status is being set to COMPLETED or CLOSED_LOST and doesn't have one
    if (data.status === 'COMPLETED' || data.status === 'CLOSED_LOST') {
      const currentLead = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { confirmationNumber: true }
      });
      
      if (!currentLead.confirmationNumber) {
        data.confirmationNumber = await generateConfirmationNumber(req.user.organizationId);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Filter out fields that shouldn't be passed to lead.update()
      const leadUpdateData = { ...data };
      delete leadUpdateData.serviceTypeIds;
      delete leadUpdateData.packageTypeIds;
      delete leadUpdateData.providerBeingSoldIds;
      
     
      if (leadUpdateData.agentTeamId) {
        leadUpdateData.agentTeam = {
          connect: { id: leadUpdateData.agentTeamId }
        };
        delete leadUpdateData.agentTeamId;
      }
      
      // Convert assignedToId to assignedTo relation if present
      if (leadUpdateData.assignedToId) {
        leadUpdateData.assignedTo = {
          connect: { id: leadUpdateData.assignedToId }
        };
        delete leadUpdateData.assignedToId;
      }

      // Convert customerTypeId to customerType relation if present
      if (leadUpdateData.customerTypeId !== undefined) {
        if (leadUpdateData.customerTypeId) {
          leadUpdateData.customerType = {
            connect: { id: leadUpdateData.customerTypeId }
          };
        } else {
          leadUpdateData.customerType = {
            disconnect: true
          };
        }
        delete leadUpdateData.customerTypeId;
      }


      if (leadUpdateData.cardTypeId !== undefined) {
        if (leadUpdateData.cardTypeId) {
          leadUpdateData.cardType = {
            connect: { id: leadUpdateData.cardTypeId }
          };
        } else {
          leadUpdateData.cardType = {
            disconnect: true
          };
        }
        delete leadUpdateData.cardTypeId;
      }
      
      const lead = await tx.lead.update({ where: { id: leadId }, data: leadUpdateData });
      if (Object.keys(paymentData).length > 0) {
        const existingPayment = await tx.payment.findFirst({ where: { leadId: leadId } });
        if (existingPayment) {
          await tx.payment.update({
            where: { id: existingPayment.id },
            data: paymentData
          });
        } else {
          await tx.payment.create({
            data: {
              ...paymentData,
              leadId: leadId,
              organizationId: req.user.organizationId
            }
          });
        }
      }   

      if (Object.keys(securityData).length > 0) {
        const existingSecurity = await tx.security.findFirst({ where: { leadId: leadId } });
        if (existingSecurity) {
          await tx.security.update({
            where: { id: existingSecurity.id },
            data: securityData
          });
        } else {
          await tx.security.create({
            data: {
              ...securityData,
              leadId: leadId,
              organizationId: req.user.organizationId
            }
          });
        }
      }

      // When marking as COMPLETED or CLOSED_LOST, delete security data and filter payment data
      if (data.status === 'COMPLETED' || data.status === 'CLOSED_LOST') {
        // Delete all security data
        await tx.security.deleteMany({
          where: { leadId: leadId }
        });

        // Update payment data to keep only cardholderName, masked cardNumber, and otc
        const existingPayments = await tx.payment.findMany({
          where: { leadId: leadId }
        });

        for (const payment of existingPayments) {
          const filteredPaymentData = {};
          if (payment.cardholderName) filteredPaymentData.cardholderName = payment.cardholderName;
          if (payment.cardNumber) filteredPaymentData.cardNumber = maskCardNumber(payment.cardNumber);
          if (payment.otc) filteredPaymentData.otc = payment.otc;
          
          // Clear sensitive fields
          filteredPaymentData.cvv = null;
          filteredPaymentData.expiryDate = null;
          filteredPaymentData.billingAddressPayment = null;
          filteredPaymentData.cardType = null;

          await tx.payment.update({
            where: { id: payment.id },
            data: filteredPaymentData
          });
        }
      }
      // Handle service type relationships
      if (data.serviceTypeIds !== undefined) {
        console.log(`Processing serviceTypeIds for lead ${leadId}:`, data.serviceTypeIds);
        
        // Convert empty string to empty array
        if (data.serviceTypeIds === "" || data.serviceTypeIds === null) {
          data.serviceTypeIds = [];
          console.log(`Converted empty string/null to empty array for serviceTypeIds`);
        }
        
        // Only process if it's an array
        if (Array.isArray(data.serviceTypeIds)) {
          // Always delete existing relationships first
          await tx.leadServiceType.deleteMany({ where: { leadId: leadId } });
          
          // Only create new ones if array is not empty
          if (data.serviceTypeIds.length > 0) {
            const serviceTypeRelations = data.serviceTypeIds.map(serviceTypeId => ({
              leadId: leadId,
              serviceTypeId: serviceTypeId,
              organizationId: req.user.organizationId
            }));
            await tx.leadServiceType.createMany({ data: serviceTypeRelations });
            console.log(`Updated ${serviceTypeRelations.length} service type relations for lead ${leadId}`);
          } else {
            console.log(`Empty serviceTypeIds array - relationships deleted but not recreated for lead ${leadId}`);
          }
        } else {
          console.log(`serviceTypeIds is not an array, skipping service type relationship updates for lead ${leadId}`);
        }
      }

      // Handle package type relationships
      if (data.packageTypeIds !== undefined) {
        console.log(`Processing packageTypeIds for lead ${leadId}:`, data.packageTypeIds);
        
        // Convert empty string to empty array
        if (data.packageTypeIds === "" || data.packageTypeIds === null) {
          data.packageTypeIds = [];
          console.log(`Converted empty string/null to empty array for packageTypeIds`);
        }
        
        // Only process if it's an array
        if (Array.isArray(data.packageTypeIds)) {
          // Always delete existing relationships first
          await tx.leadPackageType.deleteMany({ where: { leadId: leadId } });
          
          // Only create new ones if array is not empty
          if (data.packageTypeIds.length > 0) {
            const packageTypeRelations = data.packageTypeIds.map(packageTypeId => ({
              leadId: leadId,
              packageTypeId: packageTypeId,
              organizationId: req.user.organizationId
            }));
            await tx.leadPackageType.createMany({ data: packageTypeRelations });
            console.log(`Updated ${packageTypeRelations.length} package type relations for lead ${leadId}`);
          } else {
            console.log(`Empty packageTypeIds array - relationships deleted but not recreated for lead ${leadId}`);
          }
        } else {
          console.log(`packageTypeIds is not an array, skipping package type relationship updates for lead ${leadId}`);
        }
      }

      // Handle provider being sold relationships
      if (data.providerBeingSoldIds !== undefined) {
        console.log(`Processing providerBeingSoldIds for lead ${leadId}:`, data.providerBeingSoldIds);
        console.log(`Type of providerBeingSoldIds:`, typeof data.providerBeingSoldIds);
        console.log(`Is array:`, Array.isArray(data.providerBeingSoldIds));
        
        // Convert empty string to empty array
        if (data.providerBeingSoldIds === "" || data.providerBeingSoldIds === null) {
          data.providerBeingSoldIds = [];
          console.log(`Converted empty string/null to empty array for providerBeingSoldIds`);
        }
        
        // Only process if it's an array
        if (Array.isArray(data.providerBeingSoldIds)) {
          // Always delete existing relationships first
          await tx.leadProviderBeingSold.deleteMany({ where: { leadId: leadId } });
          console.log(`Deleted existing provider relationships for lead ${leadId}`);
          
          // Only create new ones if array is not empty
          if (data.providerBeingSoldIds.length > 0) {
            const providerRelations = data.providerBeingSoldIds.map(providerId => ({
              leadId: leadId,
              providerBeingSoldId: providerId,
              organizationId: req.user.organizationId
            }));
            await tx.leadProviderBeingSold.createMany({ data: providerRelations });
            console.log(`Updated ${providerRelations.length} provider being sold relations for lead ${leadId}`);
          } else {
            console.log(`Empty providerBeingSoldIds array - relationships deleted but not recreated for lead ${leadId}`);
          }
        } else {
          console.log(`providerBeingSoldIds is not an array, skipping provider relationship updates for lead ${leadId}`);
        }
      } else {
        console.log(`providerBeingSoldIds not provided - skipping provider relationship updates for lead ${leadId}`);
      }

      return lead;
    });

    const completeLead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        alternatePhone: true,
        serviceAddress: true,
        previousAddress: true,
        shippingAddress: true,
        comment: true,
        status: true,
        installationType: true,
        installationDatetime: true,
        externalId: true,
        securityPin: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        customerType: {
          select: {
            id: true,
            displayName: true,
            value: true
          }
        },
        agentTeam: {
          select: {
            id: true,
            name: true,
            description: true,
            isAgent: true
          }
        },
        cardType: {
          select: {
            id: true,
            displayName: true,
            value: true
          }
        },
        payments: true,
        securities: true,
        leadServiceTypes: {
          include: {
            serviceType: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            }
          }
        },
        leadPackageTypes: {
          include: {
            packageType: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            }
          }
        },
        leadProviderBeingSold: {
          include: {
            providerBeingSold: {
              select: {
                id: true,
                displayName: true,
                value: true
              }
            }
          }
        }
      }
    });

    res.json(completeLead);
  } catch (error) {
    next(error);
  }
};

exports.deleteLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id);
    
    if (isNaN(leadId)) {
      return res.status(400).json({ error: 'Invalid lead ID' });
    }
    
    await prisma.lead.delete({ where: { id: leadId } });
    res.json({ message: 'Lead deleted successfully' });
  } catch (error) {
    next(error);
  }
};


exports.approveLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id);
    
    if (isNaN(leadId)) {
      return res.status(400).json({ error: 'Invalid lead ID' });
    }
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    if (lead.assignedToId !== req.user.id) {
      return res.status(403).json({ error: 'Only the assigned team lead can approve this lead.' });
    }
    const hasApprovePermission = req.user.permissions && req.user.permissions.some(
      perm => perm.action === 'UPDATE' && perm.resource === 'LEAD_FORM'
    );
    const isOrgAdmin = req.user.roles && req.user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
    const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
    
    if (!hasApprovePermission && !isOrgAdmin && !isSuperAdmin) {
      return res.status(403).json({ error: 'You do not have permission to approve leads.' });
    }
    
    const updatedLead = await prisma.lead.update({ where: { id: leadId }, data: { status: 'APPROVED' } });
    res.json(updatedLead);
  } catch (error) {
    next(error);
  }
};

exports.cancelLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id);
    
    if (isNaN(leadId)) {
      return res.status(400).json({ error: 'Invalid lead ID' });
    }
    const hasCancelPermission = req.user.permissions && req.user.permissions.some(
      perm => perm.action === 'UPDATE' && perm.resource === 'LEAD_FORM'
    );
    const isOrgAdmin = req.user.roles && req.user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
    const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
    
    if (!hasCancelPermission && !isOrgAdmin && !isSuperAdmin) {
      return res.status(403).json({ error: 'You do not have permission to cancel leads.' });
    }
    
    const lead = await prisma.lead.update({ where: { id: leadId }, data: { status: 'CANCELLED' } });
    res.json(lead);
  } catch (error) {
    next(error);
  }
};

exports.requestRevision = async (req, res, next) => {
  try {
    const { id } = req.params;
    const leadId = parseInt(id);
    
    if (isNaN(leadId)) {
      return res.status(400).json({ error: 'Invalid lead ID' });
    }
    
    const { revisionNotes } = req.body;
    const hasRevisionPermission = req.user.permissions && req.user.permissions.some(
      perm => perm.action === 'UPDATE' && perm.resource === 'LEAD_FORM'
    );
    const isOrgAdmin = req.user.roles && req.user.roles.some(role => role.name === 'ORGANIZATION_ADMIN');
    const isSuperAdmin = req.user.roles && req.user.roles.some(role => role.name === 'Super Admin' || role.name === 'SUPER_ADMIN');
    
    if (!hasRevisionPermission && !isOrgAdmin && !isSuperAdmin) {
      return res.status(403).json({ error: 'You do not have permission to request revisions for leads.' });
    }

    const existingLead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!existingLead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    const lead = await prisma.lead.update({ 
      where: { id: leadId },
      data: { 
        status: 'REVISION_REQUESTED', 
        reassignmentNotes: revisionNotes,
        assignedToId: existingLead.createdById, 
        reassignedById: req.user.id, 
        reassignedAt: new Date() 
      } 
    });
    res.json(lead);
  } catch (error) {
    next(error);
  }
}; 

exports.getLeadsByUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { 
      page = 1, 
      limit = 10, 
      status, 
      search,
      firstName,
      lastName,
      phone,
      fromDate,
      toDate
    } = req.query;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const where = {
      OR: [
        { createdById: parseInt(userId) },
        { assignedToId: parseInt(userId) }
      ]
    };
    
    if (status) {
      where.status = status;
    }
    
    if (firstName && firstName.trim() !== '') {
      where.firstName = { contains: firstName.trim(), mode: 'insensitive' };
    }
    
    if (lastName && lastName.trim() !== '') {
      where.lastName = { contains: lastName.trim(), mode: 'insensitive' }
    }
    
    if (phone && phone.trim() !== '') {
      where.phone = { contains: phone.trim(), mode: 'insensitive' };
    }
    
    if (fromDate || toDate) {
      where.createdAt = {};
      
      if (fromDate) {
        const fromDateObj = new Date(fromDate + 'T00:00:00');
        if (!isNaN(fromDateObj.getTime())) {
          where.createdAt.gte = fromDateObj.toISOString();
        }
      }
      
      if (toDate) {
        const toDateObj = new Date(toDate + 'T23:59:59.999');
        if (!isNaN(toDateObj.getTime())) {
          where.createdAt.lte = toDateObj.toISOString();
        }
      }
    }
    
    if (search) {
      where.AND = [
        {
          OR: [
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { serviceAddress: { contains: search, mode: 'insensitive' } }
          ]
        }
      ];
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          alternatePhone: true,
          serviceAddress: true,
          previousAddress: true,
          shippingAddress: true,
          comment: true,
          status: true,
          installationType: true,
          installationDatetime: true,
          externalId: true,
          securityPin: true,
          confirmationNumber: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          agentTeam: {
            select: {
              id: true,
              name: true,
              description: true,
              isAgent: true
            }
          },
          cardType: {
            select: {
              id: true,
              displayName: true,
              value: true
            }
          },
          payments: {
            select: {
              id: true,
              cardType: true,
              cardholderName: true,
              otc: true
            }
          },
          securities: {
            select: {
              id: true,
              ssnLastFour: true,
              dlState: true,
            }
          },
          leadServiceTypes: {
            include: {
              serviceType: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          },
          leadPackageTypes: {
            include: {
              packageType: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          },
          leadProviderBeingSold: {
            include: {
              providerBeingSold: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.lead.count({ where })
    ]);
    
    const totalPages = Math.ceil(total / take);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.json({
      leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: take,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        status,
        firstName,
        lastName,
        phone,
        fromDate,
        toDate,
        search
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getLookupValues = async (req, res, next) => {
  try {
    const { type } = req.query;
    const where = {
      organizationId: req.user.organizationId,
      isActive: true
    };
    
    if (type) {
      where.type = type;
    }
    const typesWithChildren = ['providerBeingSold', 'serviceType'];  
    let queryOptions = { where };
    
    if (type && typesWithChildren.includes(type)) {
      queryOptions.include = {
        children: {
          where: { 
            organizationId: req.user.organizationId,
            isActive: true 
          },
          include: {
            children: {
              where: { 
                organizationId: req.user.organizationId,
                isActive: true 
              }
            }
          }
        }
      };
    } else if (!type) {
      queryOptions.include = {
        children: {
          where: { 
            organizationId: req.user.organizationId,
            isActive: true 
          }
        }
      };
    }
    
    const values = await prisma.lookupValue.findMany(queryOptions);
    
    res.json(values);
  } catch (error) {
    next(error);
  }
};

exports.createLookupValue = async (req, res, next) => {
  try {
    const { type, value, displayName, organizationId } = req.body;
    if (!type || !value || !displayName) {
      return res.status(400).json({ error: 'type, value, and displayName are required' });
    }
    let orgId = organizationId;
    if (!orgId && req.user && req.user.organizationId) {
      orgId = req.user.organizationId;
    }
    if (!orgId) {
      return res.status(400).json({ error: 'organizationId is required' });
    }
    const lookupValue = await prisma.lookupValue.create({
      data: {
        type,
        value,
        displayName,
        organization: {
          connect: { id: orgId }
        }
      }
    });
    res.status(201).json(lookupValue);
  } catch (error) {
    next(error);
  }
}; 

exports.getAllowedFormSteps = async (req, res, next) => {
  try {
    const allowedSteps = await getAllowedSteps(req.user, 'READ');
    res.json({ allowedSteps });
  } catch (error) {
    next(error);
  }
};

exports.updateLookupValue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type, value, displayName, isActive } = req.body;
    
    if (!type || !value || !displayName) {
      return res.status(400).json({ error: 'type, value, and displayName are required' });
    }

    const existingLookup = await prisma.lookupValue.findFirst({
      where: { 
        id: parseInt(id),
        organizationId: req.user.organizationId 
      }
    });

    if (!existingLookup) {
      return res.status(404).json({ error: 'Lookup value not found' });
    }

    const updatedLookup = await prisma.lookupValue.update({
      where: { id: parseInt(id) },
      data: {
        type,
        value,
        displayName,
        isActive: isActive !== undefined ? isActive : existingLookup.isActive,
        updatedAt: new Date()
      }
    });

    res.json(updatedLookup);
  } catch (error) {
    next(error);
  }
};

exports.deleteLookupValue = async (req, res, next) => {
  try {
    const { id } = req.params;
    const existingLookup = await prisma.lookupValue.findFirst({
      where: { 
        id: parseInt(id),
        organizationId: req.user.organizationId 
      },
      include: {
        leadServiceTypes: true,
        leadPackageTypes: true,
        leadProviderBeingSold: true,
        leadsAsCardType: true,
        leadsAsCustomerType: true
      }
    });

    if (!existingLookup) {
      return res.status(404).json({ error: 'Lookup value not found' });
    }

    const isUsed = existingLookup.leadServiceTypes.length > 0 ||
                   existingLookup.leadPackageTypes.length > 0 ||
                   existingLookup.leadProviderBeingSold.length > 0 ||
                   existingLookup.leadsAsCardType.length > 0 ||
                   existingLookup.leadsAsCustomerType.length > 0;
    await prisma.$transaction(async (tx) => {   
      if (existingLookup.leadServiceTypes.length > 0) {
        await tx.leadServiceType.deleteMany({
          where: { serviceTypeId: parseInt(id) }
        });
      }

      if (existingLookup.leadPackageTypes.length > 0) {
        await tx.leadPackageType.deleteMany({
          where: { packageTypeId: parseInt(id) }
        });
      }

      if (existingLookup.leadProviderBeingSold.length > 0) {
        await tx.leadProviderBeingSold.deleteMany({
          where: { providerBeingSoldId: parseInt(id) }
        });
      }

      if (existingLookup.leadsAsCardType.length > 0) {
        await tx.lead.updateMany({
          where: { cardTypeId: parseInt(id) },
          data: { cardTypeId: null }
        });
      }

      if (existingLookup.leadsAsCustomerType.length > 0) {
        await tx.lead.updateMany({
          where: { customerTypeId: parseInt(id) },
          data: { customerTypeId: null }
        });
      }

      await tx.lookupValue.delete({
        where: { id: parseInt(id) }
      });
    });

    const response = { message: 'Lookup value deleted successfully' };
    
    if (isUsed) {
      response.warning = 'This lookup value was being used by leads. The references have been cleared.';
      response.usage = {
        serviceTypeLeads: existingLookup.leadServiceTypes.length,
        packageTypeLeads: existingLookup.leadPackageTypes.length,
        providerLeads: existingLookup.leadProviderBeingSold.length,
        cardTypeLeads: existingLookup.leadsAsCardType.length,
        customerTypeLeads: existingLookup.leadsAsCustomerType.length
      };
    }

    res.json(response);
  } catch (error) {
    next(error);
  }
}; 

exports.getPackageTypesByServiceType = async (req, res, next) => {
  try {
    const { serviceTypeId } = req.params;
    
    if (!serviceTypeId) {
      return res.status(400).json({ error: 'Service type ID is required' });
    }
    const organizationId = req.user.organizationId; 
    const packageTypes = await prisma.lookupValue.findMany({
      where: {
        type: {
          in: ['packageType', 'PackageType', 'PACKAGETYPE']
        },
        parentId: parseInt(serviceTypeId),
        organizationId: organizationId,
        isActive: true
      },
      orderBy: {
        displayName: 'asc'
      }
    });
    
    res.json(packageTypes);
  } catch (error) {
    next(error);
  }
};

exports.getServiceTypesWithPackages = async (req, res, next) => {
  try {
    const organizationId = req.user.organizationId; 
    const serviceTypes = await prisma.lookupValue.findMany({
      where: {
        type: 'serviceType',
        organizationId: organizationId,
        isActive: true
      },
      include: {
        parent: {
          where: {
            organizationId: organizationId,
            isActive: true
          },
          select: {
            id: true,
            type: true,
            value: true,
            displayName: true
          }
        },
        children: {
          where: {
            type: {
              in: ['packageType', 'PackageType', 'PACKAGETYPE']
            },
            isActive: true
          },
          orderBy: {
            displayName: 'asc'
          }
        }
      },
      orderBy: {
        displayName: 'asc'
      }
    });
    
    res.json(serviceTypes);
  } catch (error) {
    next(error);
  }
};


exports.getSalesReport = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search,
      status,
      fromDate,
      toDate
    } = req.query;
    

    const where = {
      organizationId: req.user.organizationId
    };
    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      where.OR = [

        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
        { confirmationNumber: { contains: searchTerm, mode: 'insensitive' } },
        { alternatePhone: { contains: searchTerm, mode: 'insensitive' } },
        { serviceAddress: { contains: searchTerm, mode: 'insensitive' } },
        { previousAddress: { contains: searchTerm, mode: 'insensitive' } },
        { shippingAddress: { contains: searchTerm, mode: 'insensitive' } },
        { comment: { contains: searchTerm, mode: 'insensitive' } },
        { installationDatetime: { contains: searchTerm, mode: 'insensitive' } },
        { customerType: { displayName: { contains: searchTerm, mode: 'insensitive' } } },
        { cardType: { displayName: { contains: searchTerm, mode: 'insensitive' } } },
        { agentTeam: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { createdBy: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { createdBy: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
        { createdBy: { email: { contains: searchTerm, mode: 'insensitive' } } },
        { assignedTo: { firstName: { contains: searchTerm, mode: 'insensitive' } } },
        { assignedTo: { lastName: { contains: searchTerm, mode: 'insensitive' } } },
        { assignedTo: { email: { contains: searchTerm, mode: 'insensitive' } } },
        { payments: { some: { cardholderName: { contains: searchTerm, mode: 'insensitive' } } } },
        { payments: { some: { cardNumber: { contains: searchTerm, mode: 'insensitive' } } } },
        { securities: { some: { ssnLastFour: { contains: searchTerm, mode: 'insensitive' } } } },
        { securities: { some: { stateId: { contains: searchTerm, mode: 'insensitive' } } } },
        { securities: { some: { dlNumberMasked: { contains: searchTerm, mode: 'insensitive' } } } },
        { securities: { some: { dlState: { contains: searchTerm, mode: 'insensitive' } } } },
        { securities: { some: { securityQuestion: { contains: searchTerm, mode: 'insensitive' } } } },
        { securityPin: { contains: searchTerm, mode: 'insensitive' } },
        { leadServiceTypes: { some: { serviceType: { displayName: { contains: searchTerm, mode: 'insensitive' } } } } },
        { leadPackageTypes: { some: { packageType: { displayName: { contains: searchTerm, mode: 'insensitive' } } } } },
        { leadPackageTypes: { some: { packageType: { displayName: { contains: searchTerm, mode: 'insensitive' } } } } },
        { leadProviderBeingSold: { some: { providerBeingSold: { displayName: { contains: searchTerm, mode: 'insensitive' } } } } }
      ];
    }
    
    if (status && status.trim() !== '') {
      where.status = status;
    }
    
    if (fromDate || toDate) {
      where.createdAt = {};
      
      if (fromDate) {
        const fromDateObj = new Date(fromDate + 'T00:00:00');
        if (!isNaN(fromDateObj.getTime())) {
          where.createdAt.gte = fromDateObj.toISOString();
        }
      }
      
      if (toDate) {
        const toDateObj = new Date(toDate + 'T23:59:59.999');
        if (!isNaN(toDateObj.getTime())) {
          where.createdAt.lte = toDateObj.toISOString();
        }
      }
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          alternatePhone: true,
          serviceAddress: true,
          previousAddress: true,
          shippingAddress: true,
          comment: true,
          status: true,
          installationDatetime: true,
          externalId: true,
          securityPin: true,
          confirmationNumber: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          agentTeam: {
            select: {
              id: true,
              name: true,
              description: true,
              isAgent: true
            }
          },
          cardType: {
            select: {
              id: true,
              displayName: true,
              value: true
            }
          },
          payments: {
            select: {
              id: true,
              cardType: true,
              cardholderName: true,
              cardNumber: true,
              expiryDate: true,
              cvv: true,
              billingAddressPayment: true,
              otc: true
            }
          },
          securities: {
            select: {
              id: true,
              ssnLastFour: true,
              dlState: true,
            }
          },
          leadServiceTypes: {
            include: {
              serviceType: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          },
          leadPackageTypes: {
            include: {
              packageType: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          },
          customerType: {
            select: {
              id: true,
              displayName: true,
              value: true
            }
          },
          leadProviderBeingSold: {
            include: {
              providerBeingSold: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      }),
      prisma.lead.count({ where })
    ]);
    
    const totalPages = Math.ceil(total / take);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    const summaryStats = {
      totalLeads: total,
      openLeads: 0,
      completedLeads: 0,
      cancelledLeads: 0,
      totalValue: 0
    };
    
    leads.forEach(lead => {
      if (lead.status === 'OPEN' || lead.status === 'NEW' || lead.status === 'CONTACTED' || 
          lead.status === 'QUALIFIED' || lead.status === 'PROPOSAL' || lead.status === 'NEGOTIATION' ||
          lead.status === 'READY_FOR_PROCESSING' || lead.status === 'REASSIGNED' || lead.status === 'PROCESSING') {
        summaryStats.openLeads++;
      } else if (lead.status === 'COMPLETED' || lead.status === 'CLOSED_WON') {
        summaryStats.completedLeads++;
      } else if (lead.status === 'CANCELLED' || lead.status === 'CLOSED_LOST') {
        summaryStats.cancelledLeads++;
      }
      
      if (lead.price && !isNaN(parseFloat(lead.price))) {
        summaryStats.totalValue += parseFloat(lead.price);
      }
    });
    
    res.json({
      leads,
      summary: summaryStats,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: take,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        search,
        status,
        fromDate,
        toDate
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.createLookupValueWithParent = async (req, res, next) => {
  try {
    const { type, value, displayName, parentId } = req.body;
    
    if (!type || !value || !displayName) {
      return res.status(400).json({ error: 'type, value, and displayName are required' });
    }
    const organizationId = req.user.organizationId; 
    if (parentId) {
      const parent = await prisma.lookupValue.findFirst({
        where: {
          id: parseInt(parentId),
          organizationId: organizationId,
          isActive: true
        }
      });
      
      if (!parent) {
        return res.status(400).json({ error: 'Parent lookup value not found' });
      }
      const isPackageType = ['packageType', 'PackageType', 'PACKAGETYPE'].includes(type);
      const isServiceType = ['serviceType', 'ServiceType', 'SERVICETYPE'].includes(parent.type);
      
      if (isPackageType && !isServiceType) {
        return res.status(400).json({ error: 'Package types can only have service types as parents' });
      }
    }
    
    const lookupValue = await prisma.lookupValue.create({
      data: {
        type,
        value,
        displayName,
        parentId: parentId ? parseInt(parentId) : null,
        organizationId: organizationId
      },
      include: {
        parent: true,
        children: true
      }
    });
    
    res.status(201).json(lookupValue);
  } catch (error) {
    next(error);
  }
};

exports.getFinalReport = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      search,
      fromDate,
      toDate
    } = req.query;
    
    const where = {
      organizationId: req.user.organizationId,  
    };
    
    if (search && search.trim() !== '') {
      const searchTerm = search.trim();
      where.OR = [
        { firstName: { contains: searchTerm, mode: 'insensitive' } },
        { lastName: { contains: searchTerm, mode: 'insensitive' } },
        { email: { contains: searchTerm, mode: 'insensitive' } },
        { phone: { contains: searchTerm, mode: 'insensitive' } },
        { comment: { contains: searchTerm, mode: 'insensitive' } },
        { confirmationNumber: { contains: searchTerm, mode: 'insensitive' } }
      ];
    }
    
    if (fromDate || toDate) {
      where.createdAt = {};
      
      if (fromDate) {
        const fromDateObj = new Date(fromDate + 'T00:00:00');
        if (!isNaN(fromDateObj.getTime())) {
          where.createdAt.gte = fromDateObj.toISOString();
        }
      }
      
      if (toDate) {
        const toDateObj = new Date(toDate + 'T23:59:59.999');
        if (!isNaN(toDateObj.getTime())) {
          where.createdAt.lte = toDateObj.toISOString();
        }
      }
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);
    
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        orderBy: {
          createdAt: 'desc'
        },
        where,
        skip,
        take,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          alternatePhone: true,
          serviceAddress: true,
          previousAddress: true,
          shippingAddress: true,
          comment: true,
          status: true,
          installationType: true,
          installationDatetime: true,
          externalId: true,
          securityPin: true,
          confirmationNumber: true,
          createdAt: true,
          updatedAt: true,
          customerType: {
            select: {
              id: true,
              displayName: true,
              value: true
            }
          },
          securities: {
            select: {
              id: true,
              ssnLastFour: true,
              stateId: true,
              dlState: true,
              dlNumberMasked: true,
              dlExpiration: true,
              securityQuestion: true,
              dateOfBirth: true
            }
          },
          cardType: {
            select: {
              id: true,
              displayName: true,
              value: true
            }
          },
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          agentTeam: {
            select: {
              id: true,
              name: true,
              description: true,
              isAgent: true
            }
          },
          leadServiceTypes: {
            include: {
              serviceType: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          },
          leadPackageTypes: {
            include: {
              packageType: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          },
          leadProviderBeingSold: {
            include: {
              providerBeingSold: {
                select: {
                  id: true,
                  displayName: true,
                  value: true
                }
              }
            }
          },
          payments: {
            select: {
              id: true,
              cardType: true,
              cardholderName: true,
              cardNumber: true,
              expiryDate: true,
              otc: true,
              cvv: true,
              billingAddressPayment: true
            }
          }
        }
      }),
      prisma.lead.count({ where })
    ]);
    
    const totalPages = Math.ceil(total / take);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    res.json({
      leads,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: take,
        hasNextPage,
        hasPrevPage
      },
      filters: {
        search,
        fromDate,
        toDate
      }
    });
  } catch (error) {
    next(error);
  }
};




exports.getLeadByPhone = async(req , res , next) =>{
  try {
    const{phone} = req.params;

    if(!phone){
      return res.status(400).json({error : 'Phone is required'}); 
    }

    const lead = await prisma.lead.findFirst({
          where :{phone,
            organizationId : req.user.organizationId
          },
          select:{
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            alternatePhone: true,
            serviceAddress: true,
            previousAddress: true,
            shippingAddress: true,
            externalId: true,
            createdAt: true,
            updatedAt: true,
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phoneNumber: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'  
          }
        })
          if (!lead) {
            return res.status(404).json({error : 'Lead not found'});
          }
          res.json(lead);
    

  }catch (error){
    next(error);
  }
}