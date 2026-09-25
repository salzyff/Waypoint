# Waypoint email templates

These templates are ready to paste into Supabase Auth → Email Templates. Keep the production sender as `auth@mail.studyai.name.ng` and use the verified Resend SMTP connection.

- `confirm-signup.html` → Confirm signup
- `magic-link.html` → Magic Link
- `reset-password.html` → Reset Password
- `invite-user.html` → Invite user

Use Supabase's `{{ .ConfirmationURL }}` variable for the action button. It preserves the approved redirect URL supplied by Waypoint and avoids malformed links.
