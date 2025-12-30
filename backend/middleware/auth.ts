import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db, auth } from '../firebase';

interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        role: string;
        permissions: string[];
    };
}

interface JWTPayload {
    id: string;
    email: string;
    role: string;
    permissions: string[];
    iat: number;
    exp: number;
}

// JWT Secret (should be in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT Token
export const generateToken = (user: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
}): string => {
    return jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Verify JWT Token
export const verifyToken = (token: string): JWTPayload => {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
};

// Authentication Middleware
export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Access denied. No token provided.' 
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        try {
            const decoded = verifyToken(token);
            
            // Optionally verify user exists in database
            const userDoc = await db.collection('users').doc(decoded.id).get();
            if (!userDoc.exists) {
                return res.status(401).json({ 
                    error: 'Invalid token. User not found.' 
                });
            }

            const userData = userDoc.data();
            
            req.user = {
                id: decoded.id,
                email: decoded.email,
                role: decoded.role,
                permissions: decoded.permissions
            };

            next();
        } catch (jwtError) {
            return res.status(401).json({ 
                error: 'Invalid token.' 
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({ 
            error: 'Internal server error during authentication.' 
        });
    }
};

// Role-based Access Control Middleware
export const requireRole = (roles: string | string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required.' 
            });
        }

        const allowedRoles = Array.isArray(roles) ? roles : [roles];
        
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ 
                error: 'Access denied. Insufficient permissions.' 
            });
        }

        next();
    };
};

// Permission-based Access Control Middleware
export const requirePermission = (permissions: string | string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required.' 
            });
        }

        const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
        const userPermissions = req.user.permissions || [];
        
        const hasPermission = requiredPermissions.some(permission => 
            userPermissions.includes(permission)
        );

        if (!hasPermission) {
            return res.status(403).json({ 
                error: 'Access denied. Insufficient permissions.' 
            });
        }

        next();
    };
};

// Admin-only middleware
export const requireAdmin = requireRole(['admin', 'superadmin']);

// Premium user middleware
export const requirePremium = requireRole(['premium', 'admin', 'superadmin']);

// Enterprise user middleware
export const requireEnterprise = requireRole(['enterprise', 'admin', 'superadmin']);

// Refresh Token Middleware
export const refreshTokenMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({ 
                error: 'Refresh token required.' 
            });
        }

        // In production, verify refresh token against database
        const decoded = verifyToken(refreshToken);
        
        // Generate new access token
        const newToken = generateToken({
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            permissions: decoded.permissions
        });

        res.json({ token: newToken });
    } catch (error) {
        console.error('Refresh token error:', error);
        return res.status(401).json({ 
            error: 'Invalid refresh token.' 
        });
    }
};

// Firebase Auth Integration
export const firebaseAuthMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                error: 'Access denied. No token provided.' 
            });
        }

        const idToken = authHeader.substring(7);
        
        try {
            const decodedToken = await auth.verifyIdToken(idToken);
            
            // Get user data from Firestore
            const userDoc = await db.collection('users').doc(decodedToken.uid).get();
            
            if (!userDoc.exists) {
                return res.status(401).json({ 
                    error: 'User not found in database.' 
                });
            }

            const userData = userDoc.data();
            
            req.user = {
                id: decodedToken.uid,
                email: decodedToken.email || '',
                role: userData.role || 'user',
                permissions: userData.permissions || []
            };

            next();
        } catch (firebaseError) {
            return res.status(401).json({ 
                error: 'Invalid Firebase token.' 
            });
        }
    } catch (error) {
        console.error('Firebase auth middleware error:', error);
        return res.status(500).json({ 
            error: 'Internal server error during authentication.' 
        });
    }
};

// Session-based Authentication (for websockets)
export const sessionAuthMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const sessionId = req.headers['x-session-id'] as string;
        
        if (!sessionId) {
            return res.status(401).json({ 
                error: 'Session ID required.' 
            });
        }

        // Get session from database
        const sessionDoc = await db.collection('sessions').doc(sessionId).get();
        
        if (!sessionDoc.exists) {
            return res.status(401).json({ 
                error: 'Invalid session ID.' 
            });
        }

        const sessionData = sessionDoc.data();
        
        // Check if session is expired
        if (sessionData.expiresAt && sessionData.expiresAt.toDate() < new Date()) {
            return res.status(401).json({ 
                error: 'Session expired.' 
            });
        }

        // Get user data
        const userDoc = await db.collection('users').doc(sessionData.userId).get();
        
        if (!userDoc.exists) {
            return res.status(401).json({ 
                error: 'User not found.' 
            });
        }

        const userData = userDoc.data();
        
        req.user = {
            id: sessionData.userId,
            email: userData.email || '',
            role: userData.role || 'user',
            permissions: userData.permissions || []
        };

        next();
    } catch (error) {
        console.error('Session auth middleware error:', error);
        return res.status(500).json({ 
            error: 'Internal server error during authentication.' 
        });
    }
};

// API Key Authentication (for external integrations)
export const apiKeyAuthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const apiKey = req.headers['x-api-key'] as string;
        
        if (!apiKey) {
            return res.status(401).json({ 
                error: 'API key required.' 
            });
        }

        // Verify API key against database
        const apiKeyDoc = await db.collection('apiKeys').doc(apiKey).get();
        
        if (!apiKeyDoc.exists) {
            return res.status(401).json({ 
                error: 'Invalid API key.' 
            });
        }

        const apiKeyData = apiKeyDoc.data();
        
        // Check if API key is active and not expired
        if (!apiKeyData.isActive || (apiKeyData.expiresAt && apiKeyData.expiresAt.toDate() < new Date())) {
            return res.status(401).json({ 
                error: 'API key expired or inactive.' 
            });
        }

        // Get user data
        const userDoc = await db.collection('users').doc(apiKeyData.userId).get();
        
        if (!userDoc.exists) {
            return res.status(401).json({ 
                error: 'User not found.' 
            });
        }

        const userData = userDoc.data();
        
        // Attach user info to request
        (req as any).user = {
            id: apiKeyData.userId,
            email: userData.email || '',
            role: userData.role || 'user',
            permissions: userData.permissions || [],
            apiKey: apiKey
        };

        next();
    } catch (error) {
        console.error('API key auth middleware error:', error);
        return res.status(500).json({ 
            error: 'Internal server error during authentication.' 
        });
    }
};

// Multi-factor Authentication Middleware
export const mfaMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { mfaToken } = req.headers;
        
        if (!req.user) {
            return res.status(401).json({ 
                error: 'Authentication required.' 
            });
        }

        // Check if user has MFA enabled
        const userDoc = await db.collection('users').doc(req.user.id).get();
        const userData = userDoc.data();
        
        if (userData.mfaEnabled && !mfaToken) {
            return res.status(403).json({ 
                error: 'MFA token required.' 
            });
        }

        if (userData.mfaEnabled && mfaToken) {
            // Verify MFA token (in production, would use authenticator app or SMS)
            const isValidMFA = await verifyMFAToken(req.user.id, mfaToken as string);
            
            if (!isValidMFA) {
                return res.status(403).json({ 
                    error: 'Invalid MFA token.' 
                });
            }
        }

        next();
    } catch (error) {
        console.error('MFA middleware error:', error);
        return res.status(500).json({ 
            error: 'Internal server error during MFA verification.' 
        });
    }
};

// Helper function to verify MFA token
async function verifyMFAToken(userId: string, token: string): Promise<boolean> {
    // In production, would verify against TOTP or SMS
    // For now, simulate verification
    return token.length === 6 && /^\d+$/.test(token);
}

export default authMiddleware;
