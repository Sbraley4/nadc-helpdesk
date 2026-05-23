const { validationResult, body } = require('express-validator');

/**
 * Middleware wrapper that runs express-validator checks and returns
 * 422 with errors array if any validation fails.
 */
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    return res.status(422).json({
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
      })),
    });
  };
};

// Validation rules for login
const loginValidation = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

// Validation rules for creating an agent
const createAgentValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim(),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('role')
    .isIn(['ADMIN', 'AGENT', 'VIEWER'])
    .withMessage('Role must be one of: ADMIN, AGENT, VIEWER'),
];

// Validation rules for updating an agent
const updateAgentValidation = [
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Name cannot be empty')
    .trim(),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['ADMIN', 'AGENT', 'VIEWER'])
    .withMessage('Role must be one of: ADMIN, AGENT, VIEWER'),
  body('availability')
    .optional()
    .isIn(['ONLINE', 'BUSY', 'AWAY', 'OFFLINE'])
    .withMessage('Availability must be one of: ONLINE, BUSY, AWAY, OFFLINE'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

// Validation rules for updating availability
const updateAvailabilityValidation = [
  body('availability')
    .isIn(['ONLINE', 'BUSY', 'AWAY', 'OFFLINE'])
    .withMessage('Availability must be one of: ONLINE, BUSY, AWAY, OFFLINE'),
];

// Validation rules for creating a group
const createGroupValidation = [
  body('name')
    .notEmpty()
    .withMessage('Group name is required')
    .trim(),
  body('description')
    .optional()
    .trim(),
  body('agentIds')
    .optional()
    .isArray()
    .withMessage('agentIds must be an array'),
];

// Validation rules for creating a ticket
const createTicketValidation = [
  body('subject')
    .notEmpty()
    .withMessage('Subject is required')
    .trim(),
  body('description')
    .notEmpty()
    .withMessage('Description is required'),
  body('requesterId')
    .notEmpty()
    .withMessage('Requester ID is required'),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
  body('type')
    .optional()
    .isIn(['QUESTION', 'INCIDENT', 'PROBLEM', 'FEATURE_REQUEST'])
    .withMessage('Type must be one of: QUESTION, INCIDENT, PROBLEM, FEATURE_REQUEST'),
  body('status')
    .optional()
    .isIn(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'])
    .withMessage('Status must be one of: OPEN, PENDING, RESOLVED, CLOSED'),
  body('tagIds')
    .optional()
    .isArray()
    .withMessage('tagIds must be an array'),
  body('customFields')
    .optional()
    .isArray()
    .withMessage('customFields must be an array'),
];

// Validation rules for updating a ticket
const updateTicketValidation = [
  body('subject')
    .optional()
    .notEmpty()
    .withMessage('Subject cannot be empty')
    .trim(),
  body('description')
    .optional()
    .notEmpty()
    .withMessage('Description cannot be empty'),
  body('priority')
    .optional()
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('Priority must be one of: LOW, MEDIUM, HIGH, URGENT'),
  body('type')
    .optional()
    .isIn(['QUESTION', 'INCIDENT', 'PROBLEM', 'FEATURE_REQUEST'])
    .withMessage('Type must be one of: QUESTION, INCIDENT, PROBLEM, FEATURE_REQUEST'),
  body('status')
    .optional()
    .isIn(['OPEN', 'PENDING', 'RESOLVED', 'CLOSED'])
    .withMessage('Status must be one of: OPEN, PENDING, RESOLVED, CLOSED'),
  body('tagIds')
    .optional()
    .isArray()
    .withMessage('tagIds must be an array'),
];

// Validation rules for creating a tag
const createTagValidation = [
  body('name')
    .notEmpty()
    .withMessage('Tag name is required')
    .trim(),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color (e.g., #FF0000)'),
];

// Validation rules for updating a tag
const updateTagValidation = [
  body('name')
    .optional()
    .notEmpty()
    .withMessage('Tag name cannot be empty')
    .trim(),
  body('color')
    .optional()
    .matches(/^#[0-9A-Fa-f]{6}$/)
    .withMessage('Color must be a valid hex color (e.g., #FF0000)'),
];

// Validation rules for creating a custom field
const createCustomFieldValidation = [
  body('label')
    .notEmpty()
    .withMessage('Label is required')
    .trim(),
  body('fieldKey')
    .notEmpty()
    .withMessage('Field key is required')
    .matches(/^[a-z][a-z0-9_]*$/)
    .withMessage('Field key must start with a letter and contain only lowercase letters, numbers, and underscores'),
  body('fieldType')
    .isIn(['TEXT', 'DROPDOWN', 'CHECKBOX', 'DATE'])
    .withMessage('Field type must be one of: TEXT, DROPDOWN, CHECKBOX, DATE'),
  body('options')
    .optional()
    .isArray()
    .withMessage('Options must be an array'),
  body('isRequired')
    .optional()
    .isBoolean()
    .withMessage('isRequired must be a boolean'),
  body('order')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Order must be a non-negative integer'),
];

// Validation rules for creating an SLA policy
const createSLAPolicyValidation = [
  body('name')
    .notEmpty()
    .withMessage('Name is required')
    .trim(),
  body('firstResponseHours')
    .isInt({ min: 1 })
    .withMessage('First response hours must be a positive integer'),
  body('resolutionHours')
    .isInt({ min: 1 })
    .withMessage('Resolution hours must be a positive integer'),
  body('appliesTo')
    .isIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
    .withMessage('appliesTo must be one of: LOW, MEDIUM, HIGH, URGENT'),
  body('businessHoursOnly')
    .optional()
    .isBoolean()
    .withMessage('businessHoursOnly must be a boolean'),
];

module.exports = {
  validate,
  loginValidation,
  createAgentValidation,
  updateAgentValidation,
  updateAvailabilityValidation,
  createGroupValidation,
  createTicketValidation,
  updateTicketValidation,
  createTagValidation,
  updateTagValidation,
  createCustomFieldValidation,
  createSLAPolicyValidation,
};
