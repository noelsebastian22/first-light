# SDD ledger — plan: docs/superpowers/plans/2026-10-13-first-light-v1-live.md

Executor: superpowers:executing-plans (inline), claude-code, branch feat/v1-live from 2f02898.
Spec: docs/superpowers/specs/2026-10-10-first-light-design.md

Task 1: started. Live check 2026-10-13: email_password on + sign-up on, google type=shared, trusted_origins [], allow_localhost true, 0 users, Data API 404, no app roles. Matches the plan table.
Task 1: Ruling: the plan's console path "Auth → Configuration" no longer exists; it is Settings → Better Auth, and the shared Google provider has no key fields, so Noel removed it and added Google again with custom keys — runbook §1 step 2 now says so — cost if wrong: none, the config was verified.
Task 1: Ruling: suggested Noel turn "Enable Organizations" off (on by default, unused; access comes from private.members). Not in the plan, not visible through get_neon_auth_config, so unverified — cost if wrong: signed-in strangers can create orgs that grant nothing.
Task 1: verified get_neon_auth_config: email_password enabled=false allow_sign_up=false; oauth_providers=[google type=standard, client_id set]; trusted_origins=[https://firstlight.noel-sebastian.com]; allow_localhost=true; neon_auth."user" count 0.
Task 1: complete (commits 2f02898..4b86b75, tests: none, no code — verification is the Neon config read above)
