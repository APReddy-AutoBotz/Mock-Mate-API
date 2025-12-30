import { body } from 'express-validator';

export const validateApplication = () => {
    return [
        body('jobId')
            .notEmpty()
            .withMessage('Job ID is required')
            .isString()
            .withMessage('Job ID must be a string')
            .isLength({ min: 1, max: 100 })
            .withMessage('Job ID must be between 1 and 100 characters'),
        
        body('candidateId')
            .notEmpty()
            .withMessage('Candidate ID is required')
            .isString()
            .withMessage('Candidate ID must be a string')
            .isLength({ min: 1, max: 100 })
            .withMessage('Candidate ID must be between 1 and 100 characters'),
        
        body('status')
            .optional()
            .isString()
            .withMessage('Status must be a string')
            .isIn(['applied', 'screening', 'interview', 'offered', 'rejected', 'withdrawn'])
            .withMessage('Status must be one of: applied, screening, interview, offered, rejected, withdrawn'),
        
        body('appliedDate')
            .optional()
            .isISO8601()
            .withMessage('Applied date must be a valid ISO 8601 date'),
        
        body('resumeUrl')
            .optional()
            .isURL()
            .withMessage('Resume URL must be a valid URL'),
        
        body('coverLetter')
            .optional()
            .isString()
            .withMessage('Cover letter must be a string')
            .isLength({ min: 50, max: 5000 })
            .withMessage('Cover letter must be between 50 and 5000 characters'),
        
        body('screeningNotes')
            .optional()
            .isString()
            .withMessage('Screening notes must be a string')
            .isLength({ min: 10, max: 1000 })
            .withMessage('Screening notes must be between 10 and 1000 characters'),
        
        body('interviewSchedule')
            .optional()
            .isObject()
            .withMessage('Interview schedule must be an object'),
        
        body('interviewSchedule.date')
            .optional()
            .isISO8601()
            .withMessage('Interview date must be a valid ISO 8601 date'),
        
        body('interviewSchedule.type')
            .optional()
            .isString()
            .withMessage('Interview type must be a string')
            .isIn(['phone', 'video', 'onsite', 'panel'])
            .withMessage('Interview type must be one of: phone, video, onsite, panel'),
        
        body('interviewSchedule.interviewers')
            .optional()
            .isArray()
            .withMessage('Interviewers must be an array')
            .custom((value) => {
                return value.every((interviewer: any) => 
                    typeof interviewer === 'string' && interviewer.length >= 2 && interviewer.length <= 100
                );
            })
            .withMessage('Each interviewer must be a string between 2 and 100 characters'),
        
        body('interviewSchedule.location')
            .optional()
            .isString()
            .withMessage('Interview location must be a string')
            .isLength({ min: 5, max: 200 })
            .withMessage('Interview location must be between 5 and 200 characters'),
        
        body('feedback')
            .optional()
            .isArray()
            .withMessage('Feedback must be an array')
            .custom((value) => {
                return value.every((feedback: any) => {
                    return (
                        typeof feedback.interviewerId === 'string' &&
                        typeof feedback.interviewerName === 'string' &&
                        typeof feedback.rating === 'number' &&
                        feedback.rating >= 1 && feedback.rating <= 5 &&
                        typeof feedback.notes === 'string' &&
                        Array.isArray(feedback.strengths) &&
                        Array.isArray(feedback.weaknesses) &&
                        ['hire', 'no-hire', 'maybe'].includes(feedback.recommendation)
                    );
                });
            })
            .withMessage('Each feedback must have interviewerId, interviewerName, rating (1-5), notes, strengths, weaknesses, and recommendation'),
        
        body('offer')
            .optional()
            .isObject()
            .withMessage('Offer must be an object'),
        
        body('offer.salary')
            .optional()
            .isNumeric()
            .withMessage('Offer salary must be a number')
            .isFloat({ min: 0 })
            .withMessage('Offer salary must be a positive number'),
        
        body('offer.startDate')
            .optional()
            .isISO8601()
            .withMessage('Offer start date must be a valid ISO 8601 date'),
        
        body('offer.deadline')
            .optional()
            .isISO8601()
            .withMessage('Offer deadline must be a valid ISO 8601 date'),
        
        body('offer.status')
            .optional()
            .isString()
            .withMessage('Offer status must be a string')
            .isIn(['pending', 'accepted', 'rejected', 'expired'])
            .withMessage('Offer status must be one of: pending, accepted, rejected, expired'),
        
        body('metadata')
            .optional()
            .isObject()
            .withMessage('Metadata must be an object'),
        
        body('metadata.source')
            .optional()
            .isString()
            .withMessage('Source must be a string')
            .isLength({ min: 2, max: 50 })
            .withMessage('Source must be between 2 and 50 characters'),
        
        body('metadata.referral')
            .optional()
            .isString()
            .withMessage('Referral must be a string')
            .isLength({ min: 2, max: 50 })
            .withMessage('Referral must be between 2 and 50 characters'),
        
        body('metadata.campaign')
            .optional()
            .isString()
            .withMessage('Campaign must be a string')
            .isLength({ min: 2, max: 50 })
            .withMessage('Campaign must be between 2 and 50 characters'),
        
        body('metadata.tags')
            .optional()
            .isArray()
            .withMessage('Tags must be an array')
            .custom((value) => {
                return value.every((tag: any) => 
                    typeof tag === 'string' && tag.length >= 2 && tag.length <= 30
                );
            })
            .withMessage('Each tag must be a string between 2 and 30 characters'),
        
        body('priority')
            .optional()
            .isString()
            .withMessage('Priority must be a string')
            .isIn(['low', 'medium', 'high', 'urgent'])
            .withMessage('Priority must be one of: low, medium, high, urgent'),
        
        body('score')
            .optional()
            .isNumeric()
            .withMessage('Score must be a number')
            .isFloat({ min: 0, max: 100 })
            .withMessage('Score must be between 0 and 100'),
        
        body('fitScore')
            .optional()
            .isNumeric()
            .withMessage('Fit score must be a number')
            .isFloat({ min: 0, max: 100 })
            .withMessage('Fit score must be between 0 and 100'),
        
        body('notes')
            .optional()
            .isString()
            .withMessage('Notes must be a string')
            .isLength({ min: 10, max: 1000 })
            .withMessage('Notes must be between 10 and 1000 characters')
    ];
};

export const validateApplicationUpdate = () => {
    return [
        body('status')
            .optional()
            .isString()
            .withMessage('Status must be a string')
            .isIn(['applied', 'screening', 'interview', 'offered', 'rejected', 'withdrawn'])
            .withMessage('Status must be one of: applied, screening, interview, offered, rejected, withdrawn'),
        
        body('screeningNotes')
            .optional()
            .isString()
            .withMessage('Screening notes must be a string')
            .isLength({ min: 10, max: 1000 })
            .withMessage('Screening notes must be between 10 and 1000 characters'),
        
        body('interviewSchedule')
            .optional()
            .isObject()
            .withMessage('Interview schedule must be an object'),
        
        body('feedback')
            .optional()
            .isArray()
            .withMessage('Feedback must be an array'),
        
        body('offer')
            .optional()
            .isObject()
            .withMessage('Offer must be an object'),
        
        body('notes')
            .optional()
            .isString()
            .withMessage('Notes must be a string')
            .isLength({ min: 10, max: 1000 })
            .withMessage('Notes must be between 10 and 1000 characters'),
        
        body('priority')
            .optional()
            .isString()
            .withMessage('Priority must be a string')
            .isIn(['low', 'medium', 'high', 'urgent'])
            .withMessage('Priority must be one of: low, medium, high, urgent'),
        
        body('score')
            .optional()
            .isNumeric()
            .withMessage('Score must be a number')
            .isFloat({ min: 0, max: 100 })
            .withMessage('Score must be between 0 and 100'),
        
        body('fitScore')
            .optional()
            .isNumeric()
            .withMessage('Fit score must be a number')
            .isFloat({ min: 0, max: 100 })
            .withMessage('Fit score must be between 0 and 100'),
        
        body('metadata')
            .optional()
            .isObject()
            .withMessage('Metadata must be an object')
    ];
};

export const validateApplicationQuery = () => {
    return [
        body('jobId')
            .optional()
            .isString()
            .withMessage('Job ID must be a string')
            .isLength({ min: 1, max: 100 })
            .withMessage('Job ID must be between 1 and 100 characters'),
        
        body('candidateId')
            .optional()
            .isString()
            .withMessage('Candidate ID must be a string')
            .isLength({ min: 1, max: 100 })
            .withMessage('Candidate ID must be between 1 and 100 characters'),
        
        body('status')
            .optional()
            .isString()
            .withMessage('Status must be a string')
            .isIn(['applied', 'screening', 'interview', 'offered', 'rejected', 'withdrawn'])
            .withMessage('Status must be one of: applied, screening, interview, offered, rejected, withdrawn'),
        
        body('priority')
            .optional()
            .isString()
            .withMessage('Priority must be a string')
            .isIn(['low', 'medium', 'high', 'urgent'])
            .withMessage('Priority must be one of: low, medium, high, urgent'),
        
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
            .isIn(['appliedDate', 'lastUpdated', 'score', 'fitScore', 'priority'])
            .withMessage('Sort by must be one of: appliedDate, lastUpdated, score, fitScore, priority'),
        
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
            }),
        
        body('search')
            .optional()
            .isString()
            .withMessage('Search must be a string')
            .isLength({ min: 2, max: 100 })
            .withMessage('Search must be between 2 and 100 characters'),
        
        body('scoreMin')
            .optional()
            .isNumeric()
            .withMessage('Score minimum must be a number')
            .isFloat({ min: 0, max: 100 })
            .withMessage('Score minimum must be between 0 and 100'),
        
        body('scoreMax')
            .optional()
            .isNumeric()
            .withMessage('Score maximum must be a number')
            .isFloat({ min: 0, max: 100 })
            .withMessage('Score maximum must be between 0 and 100')
            .custom((value, { req }) => {
                if (req.body.scoreMin && value < req.body.scoreMin) {
                    throw new Error('Score maximum must be greater than or equal to score minimum');
                }
                return true;
            })
    ];
};
