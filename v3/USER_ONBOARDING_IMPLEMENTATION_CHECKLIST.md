# User Onboarding Implementation Checklist

## Current Goal
Move staff onboarding from admin-shared temporary passwords to invite links where the user sets their own password.

## Shipped In This Pass
- [x] Admin user creation now creates the account without asking the admin for a password
- [x] Admin-created users are marked as invite-based onboarding users
- [x] Invite resend action exists for invited users
- [x] Public /set-password route exists
- [x] Password setup page reads the invite code and lets the user set a password
- [x] Frontend preserves invite codes on /set-password before Convex Auth auto-consumes them globally
- [x] Backend invite email flow is wired through Convex Auth password reset verification
- [x] Invite status fields are stored on the user record

## Required Environment Variables Before Deployment
### Convex Production
- SITE_URL
  - Type: Text
  - Value: https://dazzledivasinspectionchecklist.pages.dev/
- JWT_PRIVATE_KEY
  - Type: Secret
- JWKS
  - Type: Secret
- RESEND_API_KEY
  - Type: Secret
- RESEND_FROM_EMAIL
  - Type: Text or Secret
  - Example: Dazzle Divas <onboarding@dazzledivascleaning.com>
- RESEND_REPLY_TO_EMAIL
  - Optional
  - Type: Text

### Cloudflare Pages
- VITE_CONVEX_URL
  - Type: Text
  - Value: https://stoic-dinosaur-501.convex.cloud

## Next Deployment Steps
- [ ] Deploy updated Convex backend
- [ ] Verify Convex production has the Resend variables above
- [ ] Redeploy Cloudflare Pages
- [ ] Create a test staff user from the admin console
- [ ] Confirm invite email arrives
- [ ] Open the email link and set the password successfully
- [ ] Confirm the new user lands in the app signed in
- [ ] Confirm the admin console shows the user as Password Set

## Follow-Up Improvements
- [ ] Add invite delivery status badges that distinguish sent, ailed, and completed
- [ ] Add an explicit success screen after password setup
- [ ] Add a dedicated forgot-password flow for existing users
- [ ] Add SMS invite support after email onboarding is stable
- [ ] Add resend throttling / cooldown to avoid accidental spam
