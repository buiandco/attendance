# Jennifer & Charlie — Wedding Attendance

This is a separate private check-in page for the wedding.

## What it does
- Main Table + Tables 1–23.
- Search any guest by name.
- Tap a guest once to mark them attended.
- Attended guests turn green.
- A second tap does NOT silently untick them; it asks for confirmation.
- Live totals: arrived, remaining and percentage.
- Table tiles show checked-in / total counts.
- Multiple phones refresh from the same Google Sheet every 5 seconds.
- Writes are protected by an Apps Script lock to reduce simultaneous-edit collisions.
- The Google Sheet records attendance time and the checking device/person.

## 1. Google Sheet / Apps Script
Use a separate Google Sheet (recommended).

Extensions → Apps Script.
Paste the supplied `Code.gs`.

At the top of Code.gs change:
SHARED_KEY = 'CHANGE-ME-TO-A-PRIVATE-KEY';

Use the same private phrase later in `config.js`.

In Apps Script Project Settings, set timezone to Australia/Sydney.

Run `setupAttendanceSheet()` ONCE and approve permissions.
It creates the Attendance tab and all 243 supplied guests.

## 2. Deploy Apps Script
Deploy → New deployment → Web app.
Execute as: Me.
Who has access: Anyone.

Deploy and copy the URL ending in `/exec`.

If you later change Code.gs, create/update the deployment version as required by Apps Script.

## 3. Configure the GitHub page
Open `config.js`.

Paste the `/exec` URL into `webAppUrl`.
Put the SAME shared key into `sharedKey`.
Set `deviceName` to something useful, for example:
- Lawrence
- Front Door 1
- Front Door 2

If several phones need different names, you can keep separate copies/configs, or just use one common device label.

## 4. GitHub Pages
Upload:
- index.html
- config.js

They can be in a separate repo, or in a folder such as `/attendance/` in your existing wedding repo.

## Important
The shared key in a static GitHub page is not high-security authentication because someone with access to the page source can see it. Keep the attendance URL private and do not link it from the public seat finder.

The page contains the guest list locally so it remains visually usable if sync briefly fails, but Google Sheet sync is required for reliable multi-phone attendance state.
