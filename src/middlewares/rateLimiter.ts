import rateLimit from 'express-rate-limit';

// Global API Rate Limiter
// Limits every IP to 1000 requests per 15 minutes
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, 
  standardHeaders: true, 
  legacyHeaders: false, 
  message: {
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Stricter Auth Limiter for Login/Register (Brute-force protection)
// Limits every IP to 5 failed/successful login/signup attempts per 5 minutes
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, 
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many authentication attempts. Please try again after 5 minutes.'
  }
});
