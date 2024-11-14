// server.js
require('dotenv').config();

const express = require('express');
const app = express();
const path = require('path');
const axios = require('axios');
const winston = require('winston');


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
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
        errorId: Date.now() // For tracking in logs
    });
});

// Validation middleware
const validateEmailRequest = (req, res, next) => {
    const { name, email, phone, testName, testFee, discountCode } = req.body;
    
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

// Email sending endpoint with improved error handling
app.post('/send-email', validateEmailRequest, async (req, res) => {
    const requestId = Date.now();
    logger.info('Starting email send process', { requestId, email: req.body.email });

    const { name, email, phone, testName, testFee, discountCode } = req.body;

    const emailData = {
        sender: {
            email: process.env.SENDER_EMAIL || "support@hellotabeeb.com",
            name: "HelloTabeeb Lab Services"
        },
        to: [{
            email: email,
            name: name
        }],
        subject: "Lab Test Booking Confirmation - HelloTabeeb",
        htmlContent: generateEmailTemplate(name, testName, testFee, discountCode)
    };

    try {
        const response = await axios.post('https://api.brevo.com/v3/smtp/email', emailData, {
            headers: {
                'api-key': process.env.BREVO_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 10000 // 10 second timeout
        });

        logger.info('Email sent successfully', { 
            requestId,
            messageId: response.data.messageId,
            recipient: email
        });

        res.status(200).json({ 
            message: 'Email sent successfully',
            messageId: response.data.messageId
        });

    } catch (error) {
        const errorDetails = {
            requestId,
            recipient: email,
            errorMessage: error.message,
            errorResponse: error.response?.data,
            errorStatus: error.response?.status
        };

        logger.error('Failed to send email', errorDetails);

        // Handle specific error cases
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ 
                message: 'Email service timeout',
                errorId: requestId
            });
        }

        if (error.response?.status === 429) {
            return res.status(429).json({ 
                message: 'Too many requests to email service',
                errorId: requestId
            });
        }

        res.status(error.response?.status || 500).json({ 
            message: 'Failed to send email',
            errorId: requestId,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    logger.info(`Server started on port ${PORT}`);
});