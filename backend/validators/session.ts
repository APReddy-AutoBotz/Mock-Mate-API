import { body } from 'express-validator';

export const validateSession = () => {
    return [
        body('userId')
            .notEmpty()
            .withMessage('User ID is required')
            .isString()
            .withMessage('User ID must be a string'),
        
        body('context.targetRole')
            .notEmpty()
            .withMessage('Target role is required')
            .isString()
            .withMessage('Target role must be a string')
            .isLength({ min: 2, max: 100 })
            .withMessage('Target role must be between 2 and 100 characters'),
        
        body('context.experience')
            .optional()
            .isString()
            .withMessage('Experience must be a string')
            .isIn(['entry', 'junior', 'mid', 'senior', 'executive'])
            .withMessage('Experience must be one of: entry, junior, mid, senior, executive'),
        
        body('context.industry')
            .optional()
            .isString()
            .withMessage('Industry must be a string')
            .isLength({ min: 2, max: 50 })
            .withMessage('Industry must be between 2 and 50 characters'),
        
        body('context.difficulty')
            .optional()
            .isString()
            .withMessage('Difficulty must be a string')
            .isIn(['easy', 'medium', 'hard', 'adaptive'])
            .withMessage('Difficulty must be one of: easy, medium, hard, adaptive'),
        
        body('settings.enableVideo')
            .optional()
            .isBoolean()
            .withMessage('Enable video must be a boolean'),
        
        body('settings.enableAudio')
            .optional()
            .isBoolean()
            .withMessage('Enable audio must be a boolean'),
        
        body('settings.enableTranscription')
            .optional()
            .isBoolean()
            .withMessage('Enable transcription must be a boolean'),
        
        body('settings.enableRecording')
            .optional()
            .isBoolean()
            .withMessage('Enable recording must be a boolean'),
        
        body('settings.maxDuration')
            .optional()
            .isInt({ min: 5, max: 120 })
            .withMessage('Max duration must be between 5 and 120 minutes'),
        
        body('settings.questionCount')
            .optional()
            .isInt({ min: 1, max: 20 })
            .withMessage('Question count must be between 1 and 20'),
        
        body('settings.questionTypes')
            .optional()
            .isArray()
            .withMessage('Question types must be an array')
            .custom((value) => {
                const validTypes = ['behavioral', 'technical', 'situational', 'general'];
                return value.every((type: string) => validTypes.includes(type));
            })
            .withMessage('Question types must be one of: behavioral, technical, situational, general'),
        
        body('preferences.language')
            .optional()
            .isString()
            .withMessage('Language must be a string')
            .isLength({ min: 2, max: 10 })
            .withMessage('Language must be between 2 and 10 characters'),
        
        body('preferences.pace')
            .optional()
            .isString()
            .withMessage('Pace must be a string')
            .isIn(['slow', 'normal', 'fast'])
            .withMessage('Pace must be one of: slow, normal, fast'),
        
        body('preferences.feedbackLevel')
            .optional()
            .isString()
            .withMessage('Feedback level must be a string')
            .isIn(['minimal', 'standard', 'detailed'])
            .withMessage('Feedback level must be one of: minimal, standard, detailed'),
        
        body('preferences.aiAssistance')
            .optional()
            .isBoolean()
            .withMessage('AI assistance must be a boolean')
    ];
};

export const validateSessionUpdate = () => {
    return [
        body('status')
            .optional()
            .isString()
            .withMessage('Status must be a string')
            .isIn(['active', 'paused', 'completed', 'cancelled'])
            .withMessage('Status must be one of: active, paused, completed, cancelled'),
        
        body('context')
            .optional()
            .isObject()
            .withMessage('Context must be an object'),
        
        body('settings')
            .optional()
            .isObject()
            .withMessage('Settings must be an object'),
        
        body('preferences')
            .optional()
            .isObject()
            .withMessage('Preferences must be an object'),
        
        body('turns')
            .optional()
            .isArray()
            .withMessage('Turns must be an array'),
        
        body('metadata')
            .optional()
            .isObject()
            .withMessage('Metadata must be an object')
    ];
};

export const validateSessionQuery = () => {
    return [
        // Query parameter validations
        body('userId')
            .optional()
            .isString()
            .withMessage('User ID must be a string'),
        
        body('status')
            .optional()
            .isString()
            .withMessage('Status must be a string')
            .isIn(['active', 'paused', 'completed', 'cancelled'])
            .withMessage('Status must be one of: active, paused, completed, cancelled'),
        
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
            .isIn(['createdAt', 'updatedAt', 'duration', 'score'])
            .withMessage('Sort by must be one of: createdAt, updatedAt, duration, score'),
        
        body('sortOrder')
            .optional()
            .isString()
            .withMessage('Sort order must be a string')
            .isIn(['asc', 'desc'])
            .withMessage('Sort order must be either asc or desc'),
        
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
