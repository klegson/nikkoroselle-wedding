// api/test.js
export default function handler(req, res) {
    console.log('🧪 Test endpoint called!');
    console.log('Method:', req.method);
    console.log('Headers:', req.headers);
    
    res.status(200).json({
        status: 'ok',
        message: 'API is working!',
        time: new Date().toISOString(),
        method: req.method,
        url: req.url,
        environment: {
            RESEND_API_KEY: process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing',
            FROM_EMAIL: process.env.FROM_EMAIL ? '✅ Set' : '❌ Missing',
            TO_EMAIL: process.env.TO_EMAIL ? '✅ Set' : '❌ Missing',
            SITE_NAME: process.env.SITE_NAME ? '✅ Set' : '❌ Missing',
        }
    });
}