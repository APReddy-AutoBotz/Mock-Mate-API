import { body } from 'express-validator';

export const validateUser = () => {
    return [
        body('email')
            .notEmpty()
            .withMessage('Email is required')
            .isEmail()
            .withMessage('Email must be a valid email address')
            .normalizeEmail(),
        
        body('password')
            .notEmpty()
            .withMessage('Password is required')
            .isLength({ min: 8, max: 128 })
            .withMessage('Password must be between 8 and 128 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
        
        body('name')
            .notEmpty()
            .withMessage('Name is required')
            .isString()
            .withMessage('Name must be a string')
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters')
            .matches(/^[a-zA-Z\s'-]+$/)
            .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
        
        body('phone')
            .optional()
            .isString()
            .withMessage('Phone must be a string')
            .matches(/^\+?[\d\s\-\(\)]+$/)
            .withMessage('Phone must contain only digits, spaces, hyphens, and parentheses'),
        
        body('location')
            .optional()
            .isString()
            .withMessage('Location must be a string')
            .isLength({ min: 2, max: 100 })
            .withMessage('Location must be between 2 and 100 characters'),
        
        body('role')
            .optional()
            .isString()
            .withMessage('Role must be a string')
            .isIn(['user', 'premium', 'enterprise', 'admin', 'superadmin'])
            .withMessage('Role must be one of: user, premium, enterprise, admin, superadmin'),
        
        body('permissions')
            .optional()
            .isArray()
            .withMessage('Permissions must be an array')
            .custom((value) => {
                const validPermissions = [
                    'read:profile', 'write:profile', 'delete:profile',
                    'read:sessions', 'write:sessions', 'delete:sessions',
                    'read:analytics', 'write:analytics',
                    'read:reports', 'write:reports',
                    'manage:users', 'manage:billing',
                    'admin:system', 'admin:analytics'
                ];
                return value.every((permission: string) => validPermissions.includes(permission));
            })
            .withMessage('Invalid permissions'),
        
        body('profile.skills')
            .optional()
            .isArray()
            .withMessage('Skills must be an array')
            .custom((value) => {
                return value.every((skill: any) => 
                    typeof skill === 'string' && skill.length >= 2 && skill.length <= 50
                );
            })
            .withMessage('Each skill must be a string between 2 and 50 characters'),
        
        body('profile.experience')
            .optional()
            .isString()
            .withMessage('Experience must be a string')
            .isIn(['entry', 'junior', 'mid', 'senior', 'executive'])
            .withMessage('Experience must be one of: entry, junior, mid, senior, executive'),
        
        body('profile.industry')
            .optional()
            .isString()
            .withMessage('Industry must be a string')
            .isLength({ min: 2, max: 50 })
            .withMessage('Industry must be between 2 and 50 characters'),
        
        body('profile.goals')
            .optional()
            .isArray()
            .withMessage('Goals must be an array')
            .custom((value) => {
                return value.every((goal: any) => 
                    typeof goal === 'string' && goal.length >= 5 && goal.length <= 200
                );
            })
            .withMessage('Each goal must be a string between 5 and 200 characters'),
        
        body('profile.learningStyle')
            .optional()
            .isString()
            .withMessage('Learning style must be a string')
            .isIn(['visual', 'auditory', 'kinesthetic', 'mixed'])
            .withMessage('Learning style must be one of: visual, auditory, kinesthetic, mixed'),
        
        body('preferences.language')
            .optional()
            .isString()
            .withMessage('Language must be a string')
            .isLength({ min: 2, max: 10 })
            .withMessage('Language must be between 2 and 10 characters'),
        
        body('preferences.timezone')
            .optional()
            .isString()
            .withMessage('Timezone must be a string')
            .matches(/^[A-Za-z_\/]+$/)
            .withMessage('Invalid timezone format'),
        
        body('preferences.notifications')
            .optional()
            .isObject()
            .withMessage('Notifications must be an object'),
        
        body('preferences.notifications.email')
            .optional()
            .isBoolean()
            .withMessage('Email notifications must be a boolean'),
        
        body('preferences.notifications.push')
            .optional()
            .isBoolean()
            .withMessage('Push notifications must be a boolean'),
        
        body('preferences.notifications.sms')
            .optional()
            .isBoolean()
            .withMessage('SMS notifications must be a boolean'),
        
        body('preferences.privacy')
            .optional()
            .isObject()
            .withMessage('Privacy settings must be an object'),
        
        body('preferences.privacy.profileVisibility')
            .optional()
            .isString()
            .withMessage('Profile visibility must be a string')
            .isIn(['public', 'private', 'connections'])
            .withMessage('Profile visibility must be one of: public, private, connections'),
        
        body('preferences.privacy.dataSharing')
            .optional()
            .isBoolean()
            .withMessage('Data sharing preference must be a boolean'),
        
        body('subscription.plan')
            .optional()
            .isString()
            .withMessage('Subscription plan must be a string')
            .isIn(['free', 'basic', 'premium', 'enterprise'])
            .withMessage('Subscription plan must be one of: free, basic, premium, enterprise'),
        
        body('subscription.status')
            .optional()
            .isString()
            .withMessage('Subscription status must be a string')
            .isIn(['active', 'trial', 'active', 'cancelled', 'expired'])
            .withMessage('Subscription status must be one of: active, trial, cancelled, expired'),
        
        body('subscription.expiresAt')
            .optional()
            .isISO8601()
            .withMessage('Subscription expiry must be a valid ISO 8601 date'),
        
        body('metadata')
            .optional()
            .isObject()
            .withMessage('Metadata must be an object'),
        
        body('metadata.referral')
            .optional()
            .isString()
            .withMessage('Referral must be a string')
            .isLength({ min: 5, max: 50 })
            .withMessage('Referral must be between 5 and 50 characters'),
        
        body('metadata.source')
            .optional()
            .isString()
            .withMessage('Source must be a string')
            .isIn(['web', 'mobile', 'api', 'referral', 'social'])
            .withMessage('Source must be one of: web, mobile, api, referral, social'),
        
        body('metadata.campaign')
            .optional()
            .isString()
            .withMessage('Campaign must be a string')
            .isLength({ min: 2, max: 50 })
            .withMessage('Campaign must be between 2 and 50 characters')
    ];
};

export const validateUserUpdate = () => {
    return [
        body('email')
            .optional()
            .isEmail()
            .withMessage('Email must be a valid email address')
            .normalizeEmail(),
        
        body('name')
            .optional()
            .isString()
            .withMessage('Name must be a string')
            .isLength({ min: 2, max: 100 })
            .withMessage('Name must be between 2 and 100 characters')
            .matches(/^[a-zA-Z\s'-]+$/)
            .withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
        
        body('phone')
            .optional()
            .isString()
            .withMessage('Phone must be a string')
            .matches(/^\+?[\d\s\-\(\)]+$/)
            .withMessage('Phone must contain only digits, spaces, hyphens, and parentheses'),
        
        body('location')
            .optional()
            .isString()
            .withMessage('Location must be a string')
            .isLength({ min: 2, max: 100 })
            .withMessage('Location must be between 2 and 100 characters'),
        
        body('profile')
            .optional()
            .isObject()
            .withMessage('Profile must be an object'),
        
        body('preferences')
            .optional()
            .isObject()
            .withMessage('Preferences must be an object'),
        
        body('subscription')
            .optional()
            .isObject()
            .withMessage('Subscription must be an object'),
        
        body('metadata')
            .optional()
            .isObject()
            .withMessage('Metadata must be an object')
    ];
};

export const validatePasswordChange = () => {
    return [
        body('currentPassword')
            .notEmpty()
            .withMessage('Current password is required')
            .isString()
            .withMessage('Current password must be a string'),
        
        body('newPassword')
            .notEmpty()
            .withMessage('New password is required')
            .isLength({ min: 8, max: 128 })
            .withMessage('New password must be between 8 and 128 characters')
            .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
            .withMessage('New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
        
        body('confirmPassword')
            .notEmpty()
            .withMessage('Password confirmation is required')
            .custom((value, { req }) => {
                if (value !== req.body.newPassword) {
                    throw new Error('Password confirmation does not match new password');
                }
                return true;
            })
    ];
};

export const validateUserQuery = () => {
    return [
        body('role')
            .optional()
            .isString()
            .withMessage('Role must be a string')
            .isIn(['user', 'premium', 'enterprise', 'admin', 'superadmin'])
            .withMessage('Role must be one of: user, premium, enterprise, admin, superadmin'),
        
        body('status')
            .optional()
            .isString()
            .withMessage('Status must be a string')
            .isIn(['active', 'inactive', 'suspended'])
            .withMessage('Status must be one of: active, inactive, suspended'),
        
        body('subscription.plan')
            .optional()
            .isString()
            .withMessage('Subscription plan must be a string')
            .isIn(['free', 'basic', 'premium', 'enterprise'])
            .withMessage('Subscription plan must be one of: free, basic, premium, enterprise'),
        
        body('subscription.status')
            .optional()
            .isString()
            .withMessage('Subscription status must be a string')
            .isIn(['active', 'trial', 'active', 'cancelled', 'expired'])
            .withMessage('Subscription status must be one of: active, trial, cancelled, expired'),
        
        body('limit')
            .optional()
            .isInt({ min: 1, max: 100 })
            .withMessage('Limit must be between 1 and 100'),
        
        body('offset')
            .optional()
            .isInt({ min: 0 })
            .withMessage('Offset must be a non-negative integer'),
        
        body('sortBy')
            .optional()
            .isString()
            .withMessage('Sort by must be a string')
            .isIn(['createdAt', 'updatedAt', 'name', 'email', 'lastLogin'])
            .withMessage('Sort by must be one of: createdAt, updatedAt, name, email, lastLogin'),
        
        body('sortOrder')
            .optional()
            .isString()
            .withMessage('Sort order must be a string')
            .isIn(['asc', 'desc'])
            .withMessage('Sort order must be either asc or desc'),
        
        body('search')
            .optional()
            .isString()
            .withMessage('Search must be a string')
            .isLength({ min: 2, max: 100 })
            .withMessage('Search must be between 2 and 100 characters'),
        
        body('dateFrom')
            .optional()
            .isISO8601()
            .withMessage('Date from must be a valid ISO 8601 date'),
        
        body('dateTo')
            .optional()
            .isISO8601()
            .withMessage('Date to must be a valid ISO 8601 date')
            .custom((value, { req }) => {
                if (req.body.dateFrom && new Date(value) < new Date(req.body.dateFrom)) {
                    throw new Error('Date to must be after date from');
                }
                return true;
            })
    ];
};
