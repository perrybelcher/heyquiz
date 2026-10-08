# Account signup and recovery

## What ships

- `/signup`: email + password + confirmation, 12–128 character password policy.
- `/resend-confirmation`: restarts signup with original registration details and a fresh PKCE challenge; deliberately uses signup rather than resend because the latter does not issue a new PKCE challenge.
- `/forgot-password`: generic eligibility response, no account-existence disclosure.
- `/auth/callback`: exchanges email authorization code on the server; removes the code from the browser URL immediately.
- `/reset-password`: requires a separate, ten-minute HttpOnly recovery cookie. It does not silently sign into a workspace; after reset the user signs in explicitly.
- Successful signup goes to the existing owner-scoped dashboard with product-finder, segmentation, and scorecard starting points. No sample records are copied into another owner's workspace.
- Login links to signup, reset and resend; the sales page links to signup.

`lib/account-auth.ts` centralizes the raw Supabase Auth HTTP contract, validation, cookie options, and bounded provider errors. No service-role key is used for account creation or password changes. Passwords are passed to Supabase and are never stored by pippi. Existing workspace access checks still validate the access token through Supabase's `/user` endpoint.

Email flows use SHA-256 PKCE with a random verifier held in a signed HttpOnly, Secure, SameSite=Lax cookie. The verifier lasts one hour. Email links must be opened in the requesting browser; another browser gets recovery instructions. Starting another successful flow replaces the outstanding verifier. Failed email requests preserve an existing verifier. The callback destination preserves the request origin only for the three exact owned production origins in callbackUrl(), keeping PKCE cookies on the same host during migration. Other origins use APP_URL or https://www.pippiapp.com. Never permit arbitrary hosts or wildcard callback destinations.

## Production email configuration

Checked 2026-10-08 in project `mliuvappcpepmgjexofe`:
- Email provider and new-user signup enabled.
- Email confirmation enabled (left enabled).
- Site URL corrected from localhost to `https://heyquiz-fawn.vercel.app`.
- Exact redirect URL added: `https://heyquiz-fawn.vercel.app/auth/callback`.
- Custom SMTP is enabled through Resend using the verified auth.pippiapp.com domain. A production password-recovery email was confirmed Delivered to the owner mailbox on 2026-10-08. Fresh-account signup and confirmation remain an unverified end-to-end gate.
- pippiapp.com redirects to www.pippiapp.com. Both custom domains have valid Vercel configuration.
- Site URL is now https://www.pippiapp.com; the exact https://www.pippiapp.com/auth/callback URL is allowed alongside the legacy Vercel callback.
- Sender display name is pippi; address remains noreply@auth.pippiapp.com.

Configure a verified sender and SMTP credentials in Supabase Authentication → Emails → SMTP. Use the provider's supported TLS port. Keep default ConfirmationURL templates for PKCE, or update templates only with matching callback implementation. When changing domains, update APP_URL and the exact Supabase redirect allowlist together. Keep confirmation enabled.

## Verification

- `npm run test:account-auth`: isolated mocked-provider tests covering validation, origin rejection, PKCE, callback replay/expiry, separate recovery grant, cookie clearing, delivery failures, and rate limiting. No external email or production account mutation.
- `npm run test:browser-auth`: local Chrome/Playwright checks for responsive signup, password matching/visibility, confirmation UI, reset UI, and invalid callback handling. Success responses are simulated; this is not proof of SMTP delivery.
- `npm run build`: production compilation and TypeScript.

After SMTP is ready, verify with a consenting test mailbox: signup → delivered email → same-browser callback → empty dashboard → create/save/reopen first quiz → logout/login → recovery email → new password → old password rejected. Also verify unknown email and expired links do not disclose account existence. Do not mark this gate complete based on mocks.

## Existing limitations

Workspace sessions still use the existing one-hour access-token lifetime without refresh-token renewal. This change does not claim to solve session longevity, captcha/edge-wide rate limiting, billing, or social login. The in-process application rate limit is a backstop; Supabase's provider limits still apply.

References: Supabase password auth, SMTP, and auth-js PKCE implementation:
- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
- https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts
