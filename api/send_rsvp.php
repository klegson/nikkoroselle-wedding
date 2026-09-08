<?php
/**
 * Emails each RSVP submission to the couple AND the guest.
 */
declare(strict_types=1);
header('Content-Type: application/json');

// ---- Fill these in ----
const ADMIN_EMAIL = 'nikkoroselle.wedding2026@gmail.com';  // Where admin notifications go
const FROM_EMAIL  = 'nikkoroselle.wedding2026@gmail.com';  // Sender email
const SITE_NAME   = "Nikko & Roselle's Wedding";

$input = json_decode(file_get_contents('php://input'), true);

$fullName   = trim((string)($input['full_name'] ?? ''));
$group      = trim((string)($input['guest_group'] ?? ''));
$response   = (string)($input['response'] ?? '');
$seatsAllotted  = (int)($input['seats_allotted'] ?? 1);
$seatsConfirmed = (int)($input['seats_confirmed'] ?? 0);
$members    = $input['members'] ?? [];
$guestEmail = trim((string)($input['guest_email'] ?? ''));

// Validate required fields
if ($fullName === '' || !in_array($response, ['accepted', 'declined'], true)) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing or invalid name / response.']);
    exit;
}

if ($guestEmail !== '' && !filter_var($guestEmail, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'That email address does not look valid.']);
    exit;
}

if ($seatsAllotted < 1) { $seatsAllotted = 1; }
if ($seatsConfirmed < 0) { $seatsConfirmed = 0; }
if ($seatsConfirmed > $seatsAllotted) { $seatsConfirmed = $seatsAllotted; }

$statusLabel = $response === 'accepted' ? 'ATTENDING' : 'NOT ATTENDING';

// Build member list
$memberLines = [];
if (!empty($members) && is_array($members)) {
    foreach ($members as $m) {
        if (isset($m['name'])) {
            $isAttending = !empty($m['attending']) ? 'Attending' : 'Not Attending';
            $memberLines[] = "  - {$m['name']} ({$isAttending})";
        }
    }
}

// Build the email body
$bodyLines = [
    "New RSVP for {$fullName}",
    '',
    "Status: {$statusLabel}",
    "Guest group: " . ($group !== '' ? $group : '—'),
    "Seats: {$seatsConfirmed} of {$seatsAllotted} confirmed attending",
    '',
    "Group Members:",
];

if (!empty($memberLines)) {
    $bodyLines = array_merge($bodyLines, $memberLines);
} else {
    $bodyLines[] = "  - (No additional members)";
}

$bodyLines[] = '';
$bodyLines[] = "Guest's email: " . ($guestEmail !== '' ? $guestEmail : 'not provided');
$bodyLines[] = '';
$bodyLines[] = "Submitted: " . date('Y-m-d H:i:s');

$body = implode("\n", $bodyLines);

// ==============================================
// EMAIL 1: Send to Admin (fixed email)
// ==============================================
$adminSubject = "[{$statusLabel}] RSVP from {$fullName}";

$adminHeaders = [];
$adminHeaders[] = "From: " . SITE_NAME . " <" . FROM_EMAIL . ">";
if ($guestEmail !== '') {
    $adminHeaders[] = "Reply-To: {$guestEmail}";
}
$adminHeaders[] = "Content-Type: text/plain; charset=UTF-8";

$sentAdmin = @mail(ADMIN_EMAIL, $adminSubject, $body, implode("\r\n", $adminHeaders));

// ==============================================
// EMAIL 2: Send to Guest (dynamic email from form)
// ==============================================
if ($guestEmail !== '') {
    $guestSubject = "Your RSVP to " . SITE_NAME;
    $guestBody = "Thanks for your RSVP, {$fullName}!\n\nStatus: {$statusLabel}\n"
        . ($response === 'accepted' ? "Seats confirmed: {$seatsConfirmed} of {$seatsAllotted}\n" : '')
        . "\nWe can't wait to celebrate with you.\n\n";
    $guestBody .= "— Nikko & Roselle\n";
    $guestBody .= "December 29, 2026 | Gamboa's Orchard, Malilipot, Albay";
    
    $guestHeaders = [];
    $guestHeaders[] = "From: " . SITE_NAME . " <" . FROM_EMAIL . ">";
    $guestHeaders[] = "Content-Type: text/plain; charset=UTF-8";
    
    $sentGuest = @mail($guestEmail, $guestSubject, $guestBody, implode("\r\n", $guestHeaders));
}

// Return response
if (!$sentAdmin) {
    http_response_code(500);
    echo json_encode(['error' => 'Could not send the RSVP email. Please try again or contact us directly.']);
    exit;
}

echo json_encode(['ok' => true]);