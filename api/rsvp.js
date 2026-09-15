// api/rsvp.js
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const input = req.body;

        const fullName = input.full_name?.trim() || '';
        const group = input.guest_group?.trim() || '';
        const response = input.response || '';
        const seatsAllotted = parseInt(input.seats_allotted) || 1;
        const seatsConfirmed = parseInt(input.seats_confirmed) || 0;
        const members = input.members || [];
        const guestEmail = input.guest_email?.trim() || '';

        // Validate required fields
        if (!fullName || !['accepted', 'declined'].includes(response)) {
            return res.status(400).json({
                error: 'Missing or invalid name / response.'
            });
        }

        // Validate email if provided
        if (guestEmail && !isValidEmail(guestEmail)) {
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

        // Get admin email from environment
        const adminEmail = process.env.TO_EMAIL || 'nikkoroselle.wedding2026@gmail.com';
        const fromEmail = process.env.FROM_EMAIL || 'onboarding@resend.dev';
        const siteName = process.env.SITE_NAME || "Nikko & Roselle's Wedding";

        // =============================================
        // BUILD PURPLE HTML EMAIL TEMPLATE
        // =============================================
        const statusColor = response === 'accepted' ? '#5c2a54' : '#8a5b82';
        const statusEmoji = response === 'accepted' ? '✅' : '❌';

        // Build member list HTML
        let memberHtml = '';
        if (members && Array.isArray(members) && members.length > 0) {
            for (const m of members) {
                if (m.name) {
                    const attendingStatus = m.attending ? '✅ Attending' : '❌ Not Attending';
                    const color = m.attending ? '#5c2a54' : '#8a5b82';
                    memberHtml += `
                        <tr>
                            <td style="padding: 8px 0; border-bottom: 1px solid #f0e8ed; font-family: 'Georgia', serif; font-size: 16px; color: #3a1636;">
                                ${m.name}
                            </td>
                            <td style="padding: 8px 0; border-bottom: 1px solid #f0e8ed; font-family: 'Georgia', serif; font-size: 16px; color: ${color}; text-align: right;">
                                ${attendingStatus}
                            </td>
                        </tr>
                    `;
                }
            }
        } else {
            memberHtml = `
                <tr>
                    <td colspan="2" style="padding: 12px 0; font-family: 'Georgia', serif; font-size: 15px; color: #8a5b82; text-align: center; font-style: italic;">
                        No additional members
                    </td>
                </tr>
            `;
        }

        // Admin Email HTML Template
        const adminHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New RSVP</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f4e7; font-family: 'Georgia', 'Times New Roman', serif;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f4e7; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <!-- Main Container -->
                        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(58, 22, 54, 0.12); overflow: hidden; max-width: 600px; width: 100%;">
                            
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #3a1636 0%, #5c2a54 50%, #7a3a6e 100%); padding: 40px 30px 30px 30px; text-align: center;">
                                    <div style="font-size: 14px; color: #c7d2b4; letter-spacing: 4px; text-transform: uppercase; font-family: 'Arial', sans-serif; margin-bottom: 8px;">
                                        💍 New RSVP
                                    </div>
                                    <h1 style="font-family: 'Georgia', serif; font-size: 28px; color: #f8f4e7; margin: 0; font-weight: 400; letter-spacing: 2px;">
                                        ${fullName}
                                    </h1>
                                    <div style="width: 60px; height: 2px; background: #b6924f; margin: 16px auto 0 auto;"></div>
                                </td>
                            </tr>
                            
                            <!-- Status Badge -->
                            <tr>
                                <td style="padding: 24px 30px 0 30px; text-align: center;">
                                    <div style="display: inline-block; background: ${statusColor}; color: #f8f4e7; padding: 10px 28px; border-radius: 30px; font-size: 18px; letter-spacing: 2px; font-family: 'Georgia', serif;">
                                        ${statusEmoji} ${statusLabel}
                                    </div>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 24px 30px 20px 30px;">
                                    <!-- Details -->
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                                        <tr>
                                            <td style="padding: 8px 0; font-family: 'Georgia', serif; font-size: 15px; color: #5c2a54; font-weight: bold; width: 140px;">
                                                Guest Group:
                                            </td>
                                            <td style="padding: 8px 0; font-family: 'Georgia', serif; font-size: 15px; color: #3a1636;">
                                                ${group || '—'}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; font-family: 'Georgia', serif; font-size: 15px; color: #5c2a54; font-weight: bold;">
                                                Seats:
                                            </td>
                                            <td style="padding: 8px 0; font-family: 'Georgia', serif; font-size: 15px; color: #3a1636;">
                                                ${validConfirmed} of ${validAllotted} confirmed attending
                                            </td>
                                        </tr>
                                        <tr>
                                            <td style="padding: 8px 0; font-family: 'Georgia', serif; font-size: 15px; color: #5c2a54; font-weight: bold;">
                                                Guest Email:
                                            </td>
                                            <td style="padding: 8px 0; font-family: 'Georgia', serif; font-size: 15px; color: #3a1636;">
                                                ${guestEmail || 'not provided'}
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Divider -->
                                    <div style="border-top: 2px solid #f0e8ed; margin: 16px 0 20px 0;"></div>
                                    
                                    <!-- Members Section -->
                                    <h3 style="font-family: 'Georgia', serif; font-size: 18px; color: #3a1636; margin: 0 0 12px 0; letter-spacing: 1px;">
                                        👥 Group Members
                                    </h3>
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8f4e7; border-radius: 8px; padding: 4px 16px;">
                                        ${memberHtml}
                                    </table>
                                    
                                    <!-- Footer -->
                                    <div style="border-top: 2px solid #f0e8ed; margin: 24px 0 0 0; padding-top: 20px; text-align: center; font-family: 'Georgia', serif; font-size: 13px; color: #8a5b82;">
                                        Submitted: ${new Date().toLocaleString()}
                                    </div>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background: #f8f4e7; padding: 20px 30px; text-align: center; border-top: 1px solid #e8dfe3;">
                                    <div style="font-family: 'Georgia', serif; font-size: 20px; color: #3a1636; letter-spacing: 2px;">
                                        ${siteName}
                                    </div>
                                    <div style="font-size: 12px; color: #8a5b82; margin-top: 6px; letter-spacing: 1px; font-family: 'Arial', sans-serif;">
                                        December 29, 2026 · Gamboa's Orchard, Malilipot, Albay
                                    </div>
                                    <div style="font-size: 11px; color: #b6924f; margin-top: 10px; letter-spacing: 2px; font-family: 'Arial', sans-serif;">
                                        ❤️ Love is in the details ❤️
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `;

        // Guest Email HTML Template
        const guestHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Your RSVP Confirmation</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f8f4e7; font-family: 'Georgia', 'Times New Roman', serif;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8f4e7; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <!-- Main Container -->
                        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; box-shadow: 0 4px 20px rgba(58, 22, 54, 0.12); overflow: hidden; max-width: 600px; width: 100%;">
                            
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, #3a1636 0%, #5c2a54 50%, #7a3a6e 100%); padding: 40px 30px 30px 30px; text-align: center;">
                                    <div style="font-size: 32px; margin-bottom: 8px;">💍</div>
                                    <h1 style="font-family: 'Georgia', serif; font-size: 26px; color: #f8f4e7; margin: 0; font-weight: 400; letter-spacing: 2px;">
                                        Your RSVP is Confirmed!
                                    </h1>
                                    <div style="width: 60px; height: 2px; background: #b6924f; margin: 16px auto 0 auto;"></div>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 30px 30px 20px 30px;">
                                    <h2 style="font-family: 'Georgia', serif; font-size: 22px; color: #3a1636; margin: 0 0 6px 0; font-weight: 400;">
                                        Dear ${fullName},
                                    </h2>
                                    <p style="font-family: 'Georgia', serif; font-size: 16px; color: #3a1636; line-height: 1.8; margin: 10px 0 20px 0;">
                                        Thank you for your RSVP to our wedding! We are so excited to celebrate this special day with you.
                                    </p>
                                    
                                    <!-- Status Badge -->
                                    <div style="text-align: center; padding: 16px 0 20px 0;">
                                        <div style="display: inline-block; background: ${statusColor}; color: #f8f4e7; padding: 10px 28px; border-radius: 30px; font-size: 18px; letter-spacing: 2px; font-family: 'Georgia', serif;">
                                            ${statusEmoji} ${statusLabel}
                                        </div>
                                    </div>
                                    
                                    ${response === 'accepted' ? `
                                    <div style="background: #f8f4e7; border-left: 4px solid #5c2a54; padding: 14px 20px; margin: 10px 0 16px 0; border-radius: 0 8px 8px 0;">
                                        <p style="font-family: 'Georgia', serif; font-size: 15px; color: #3a1636; margin: 0;">
                                            <strong>Seats confirmed:</strong> ${validConfirmed} of ${validAllotted}
                                        </p>
                                    </div>
                                    ` : ''}
                                    
                                    <!-- Members List -->
                                    ${members && members.length > 0 ? `
                                    <h3 style="font-family: 'Georgia', serif; font-size: 16px; color: #5c2a54; margin: 16px 0 10px 0;">
                                        👥 Your Group
                                    </h3>
                                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f8f4e7; border-radius: 8px; padding: 4px 16px; margin-bottom: 16px;">
                                        ${memberHtml}
                                    </table>
                                    ` : ''}
                                    
                                    <div style="border-top: 2px solid #f0e8ed; margin: 20px 0 16px 0;"></div>
                                    
                                    <p style="font-family: 'Georgia', serif; font-size: 16px; color: #3a1636; line-height: 1.8; text-align: center; font-style: italic; margin: 16px 0 0 0;">
                                        "We can't wait to celebrate with you!"
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Footer -->
                            <tr>
                                <td style="background: #f8f4e7; padding: 24px 30px; text-align: center; border-top: 1px solid #e8dfe3;">
                                    <div style="font-family: 'Georgia', serif; font-size: 22px; color: #3a1636; letter-spacing: 2px;">
                                        ${siteName}
                                    </div>
                                    <div style="font-size: 13px; color: #5c2a54; margin: 6px 0 4px 0; font-family: 'Georgia', serif;">
                                        December 29, 2026 · 4:00 PM
                                    </div>
                                    <div style="font-size: 13px; color: #8a5b82; font-family: 'Georgia', serif;">
                                        Gamboa's Orchard, Malilipot, Albay
                                    </div>
                                    <div style="font-size: 11px; color: #b6924f; margin-top: 14px; letter-spacing: 2px; font-family: 'Arial', sans-serif;">
                                        ❤️ With love, Nikko & Roselle ❤️
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `;

        // =============================================
        // SEND EMAILS
        // =============================================

        // 1️⃣ Send to Admin (Couple) - HTML Version
        console.log('📤 Sending admin notification...');
        await resend.emails.send({
            from: fromEmail,
            to: [adminEmail],
            subject: subject,
            text: body,  // Plain text fallback
            html: adminHtml,  // Beautiful purple HTML
            replyTo: guestEmail || undefined,
        });
        console.log('✅ Admin email sent to:', adminEmail);

        // 2️⃣ Send confirmation to guest - HTML Version
        if (guestEmail) {
            console.log('📤 Sending guest confirmation...');
            const guestSubject = `Your RSVP to ${siteName}`;
            let guestText = `Thanks for your RSVP, ${fullName}!\n\nStatus: ${statusLabel}\n`;
            
            if (response === 'accepted') {
                guestText += `Seats confirmed: ${validConfirmed} of ${validAllotted}\n`;
            }
            
            guestText += `\nWe can't wait to celebrate with you.\n\n`;
            guestText += `— Nikko & Roselle\n`;
            guestText += `December 29, 2026 | Gamboa's Orchard, Malilipot, Albay`;

            await resend.emails.send({
                from: fromEmail,
                to: [guestEmail],
                subject: guestSubject,
                text: guestText,  // Plain text fallback
                html: guestHtml,  // Beautiful purple HTML
            });
            console.log('✅ Guest email sent to:', guestEmail);
        }

        console.log('🎉 RSVP completed successfully!');
        return res.status(200).json({ ok: true });

    } catch (error) {
        console.error('❌ Error:', error);
        return res.status(500).json({
            error: 'Something went wrong: ' + error.message
        });
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}