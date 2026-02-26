# Security Checklist

## Application
- [ ] `APP_ENV=production` and `APP_DEBUG=false` in production
- [ ] HTTPS enforced (`FORCE_HTTPS=true`)
- [ ] Secure session cookies enabled (`SESSION_SECURE_COOKIE=true`)
- [ ] Sanctum stateful domains restricted to trusted frontend domains
- [ ] CORS origins restricted to trusted frontend domains only
- [ ] CSRF flow validated (`/sanctum/csrf-cookie` before login)

## Authentication & Authorization
- [ ] Login route rate limited (`throttle:login`)
- [ ] Role middleware active on admin and voter routes
- [ ] Policy checks enforced for election, candidate, and vote operations
- [ ] Inactive users blocked via middleware
- [ ] Session invalidation on logout verified

## Voting Integrity
- [ ] Votes are immutable (no update/delete endpoints)
- [ ] Voter identity not stored in plain text (`voter_hash` only)
- [ ] Duplicate voting prevention validated
- [ ] Election status checks enforced before vote cast
- [ ] Election lock behavior enforced after closure

## Auditing
- [ ] Admin and sensitive actions logged in `audit_logs`
- [ ] Audit logs restricted to `super_admin`
- [ ] Log retention and archival policy defined

## Infrastructure
- [ ] Database credentials stored securely (no plaintext in repo)
- [ ] Least-privilege DB user configured
- [ ] Daily automated backups enabled and tested
- [ ] Firewall rules restrict DB and SSH exposure
- [ ] Monitoring/alerting configured for auth failures and API errors

## Frontend
- [ ] Production build generated from `frontend/dist`
- [ ] API base URL points to HTTPS backend
- [ ] Browser cache strategy and asset versioning configured
- [ ] No secrets embedded in frontend environment variables
