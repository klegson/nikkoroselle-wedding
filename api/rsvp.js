// cuteapi/rsvp.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    console.log('🚀 API called!');
    console.log('Method:', req.method);
    console.log('Headers:', req.headers);
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log('📦 Parsing request body...');
        const input = req.body;
        console.log('📦 Input received:', JSON.stringify(input, null, 2));

        const fullName = input.full_name?.trim() || '';
        const group = input.guest_group?.trim() || '';
        const response = input.response || '';
        const seatsAllotted = parseInt(input.seats_allotted) || 1;
        const seatsConfirmed = parseInt(input.seats_confirmed) || 0;
        const members = input.members || [];
        const guestEmail = input.guest_email?.trim() || '';

        console.log('📊 Parsed data:', { fullName, group, response, seatsAllotted, seatsConfirmed, guestEmail });

        // Validate required fields
        if (!fullName || !['accepted', 'declined'].includes(response)) {
            console.log('❌ Validation failed: Missing name or response');
            return res.status(400).json({
                error: 'Missing or invalid name / response.'
            });
        }

        // Validate email if provided
        if (guestEmail && !isValidEmail(guestEmail)) {
            console.log('❌ Validation failed: Invalid email');
            return res.status(400).json({
                error: 'That email address does not look valid.'
            });
        }

        const validAllotted = Math.max(1, seatsAllotted);
        const validConfirmed = Math.max(0, Math.min(seatsConfirmed, validAllotted));
        const statusLabel = response === 'accepted' ? 'ATTENDING' : 'NOT ATTENDING';

        // Build member list
        const memberLines = [];
        if (members && Array.isArray(members)) {
            for (const m of members) {
                if (m.name) {
                    const isAttending = m.attending ? 'Attending' : 'Not Attending';
                    memberLines.push(`  - ${m.name} (${isAttending})`);
                }
            }
        }

        // Build email body for admin
        const bodyLines = [
            `New RSVP for ${fullName}`,
            '',
            `Status: ${statusLabel}`,
            `Guest group: ${group || '—'}`,
            `Seats: ${validConfirmed} of ${validAllotted} confirmed attending`,
            '',
            'Group Members:',
        ];

        if (memberLines.length > 0) {
            bodyLines.push(...memberLines);
        } else {
            bodyLines.push('  - (No additional members)');
        }

        bodyLines.push('');
        bodyLines.push(`Guest's email: ${guestEmail || 'not provided'}`);
        bodyLines.push('');
        bodyLines.push(`Submitted: ${new Date().toLocaleString()}`);

        const body = bodyLines.join('\n');
        const subject = `[${statusLabel}] RSVP from ${fullName}`;

        // Check environment variables
        console.log('🔑 Checking environment variables:');
        console.log('  RESEND_API_KEY:', process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing');
        console.log('  FROM_EMAIL:', process.env.FROM_EMAIL ? '✅ Set' : '❌ Missing (using default)');
        console.log('  TO_EMAIL:', process.env.TO_EMAIL ? '✅ Set' : '❌ Missing (using default)');
        console.log('  SITE_NAME:', process.env.SITE_NAME ? '✅ Set' : '❌ Missing (using default)');

        const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
        const toEmail = process.env.TO_EMAIL || 'nikkoroselle.wedding2026@gmail.com';
        const siteName = process.env.SITE_NAME || "Nikko & Roselle's Wedding";

        console.log('📧 Sending admin email to:', toEmail);
        console.log('📧 From:', fromEmail);
        console.log('📧 Subject:', subject);

        // 1. Send to Admin
        try {
            const adminResult = await resend.emails.send({
                from: fromEmail,
                to: [toEmail],
                subject: subject,
                text: body,
                replyTo: guestEmail || undefined,
            });
            console.log('✅ Admin email sent:', adminResult);
        } catch (emailError) {
            console.error('❌ Failed to send admin email:', emailError);
            throw new Error(`Admin email failed: ${emailError.message}`);
        }

        // 2. Send confirmation to guest if email provided
        if (guestEmail) {
            console.log('📧 Sending guest confirmation to:', guestEmail);
            
            const guestSubject = `Your RSVP to ${siteName}`;
            let guestBody = `Thanks for your RSVP, ${fullName}!\n\nStatus: ${statusLabel}\n`;
            
            if (response === 'accepted') {
                guestBody += `Seats confirmed: ${validConfirmed} of ${validAllotted}\n`;
            }
            
            guestBody += `\nWe can't wait to celebrate with you.\n\n`;
            guestBody += `— Nikko & Roselle\n`;
            guestBody += `December 29, 2026 | Gamboa's Orchard, Malilipot, Albay`;

            try {
                const guestResult = await resend.emails.send({
                    from: fromEmail,
                    to: [guestEmail],
                    subject: guestSubject,
                    text: guestBody,
                });
                console.log('✅ Guest email sent:', guestResult);
            } catch (emailError) {
                console.error('❌ Failed to send guest email:', emailError);
                // Don't throw here - guest email failure shouldn't break the whole flow
            }
        }

        console.log('🎉 RSVP completed successfully!');
        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error('❌ ERROR in RSVP handler:');
        console.error('  Message:', error.message);
        console.error('  Stack:', error.stack);
        console.error('  Name:', error.name);
        
        return res.status(500).json({
            error: 'Something went wrong: ' + error.message,
            details: error.stack
        });
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}