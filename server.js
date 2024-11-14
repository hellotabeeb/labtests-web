// server.js
require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const axios = require('axios');
const winston = require('winston');
const cors = require('cors');

// Configure Winston logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.simple()
    }));
}

// Middleware
// Update CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? 'https://labtestss.pages.dev/'  // Replace with your actual domain
        : '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Accept'],
    credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Validation middleware
const validateEmailRequest = (req, res, next) => {
    const { name, email, phone, testName, testFee, discountCode } = req.query;
    
    if (!name || !email || !phone || !testName || !testFee || !discountCode) {
        logger.warn('Invalid email request:', { 
            missingFields: Object.entries({ name, email, phone, testName, testFee, discountCode })
                .filter(([_, value]) => !value)
                .map(([key]) => key)
        });
        return res.status(400).json({ 
            message: 'Missing required fields',
            details: 'All fields (name, email, phone, testName, testFee, discountCode) are required'
        });
    }
    next();
};

// Update the email sending endpoint error handling
app.get('/send-email', validateEmailRequest, async (req, res) => {
    const requestId = Date.now();
    const { name, email, phone, testName, testFee, discountCode } = req.query;
    
    logger.info('Starting email send process', { requestId, email });

    try {
        // ... existing email sending code ...

        const response = await axios.post('https://api.brevo.com/v3/smtp/email', emailData, {
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000
        });

        res.json({ 
            success: true,
            message: 'Email sent successfully',
            messageId: response.data.messageId
        });

    } catch (error) {
        // Always send JSON response, never HTML
        const statusCode = error.response?.status || 500;
        const errorResponse = {
            success: false,
            message: 'Failed to send email',
            errorId: requestId,
            details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        };

        res.status(statusCode).json(errorResponse);
        
        // Log the error
        logger.error('Email sending failed', {
            requestId,
            error: error.message,
            stack: error.stack,
            statusCode
        });
    }
});

// Global error handler - ensure it always returns JSON
app.use((err, req, res, next) => {
    const errorId = Date.now();
    logger.error('Unhandled error:', { 
        errorId,
        error: err.message,
        stack: err.stack
    });

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        errorId
    });
});

// 404 handler - ensure it returns JSON
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Not Found',
        path: req.path
    });
});

function generateEmailTemplate(name, testName, testFee, discountCode) {
    return `
        <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2c3e50;">Lab Test Booking Confirmation</h2>
                <p>Dear ${name},</p>
                <p>Thank you for booking your lab test with HelloTabeeb. Your booking has been confirmed.</p>
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">Booking Details:</h3>
                    <ul style="list-style-type: none; padding-left: 0;">
                        <li><strong>Test:</strong> ${testName}</li>
                        <li><strong>Fee:</strong> ${testFee}</li>
                        <li style="margin-top: 10px;"><strong>Your Discount Code:</strong> 
                            <span style="background-color: #e9ecef; padding: 5px 10px; border-radius: 3px;">
                                ${discountCode}
                            </span>
                        </li>
                    </ul>
                </div>
                <p><strong>Important:</strong> Please keep this code safe as it can only be used once.</p>
                <p>Please show this email at the lab during your visit.</p>
                <hr style="border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #666; font-size: 14px;">
                    Best regards,<br>
                    HelloTabeeb Lab Services Team
                </p>
            </div>
        </body>
        </html>
    `;
}

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', { 
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method 
    });
    res.status(500).json({ 
        message: 'Internal server error',
        errorId: Date.now()
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
});