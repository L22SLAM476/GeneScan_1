# Delivery validation

| Check | Result |
|---|---|
| Shared DNA unit tests | 24 passed |
| Shared module lint | Passed |
| Production web build | Passed |
| Chrome E2E | 332 passed in one final run. See selenium-tests/full-run.log. Earlier failures and reruns are retained. |
| Mobile E2E | 332 discovered. Device execution NOT RUN. No Android SDK, emulator or KVM device on this worker. |
| Expo Android and iOS JS/Hermes exports | Both passed. Bundles are under build/mobile-bundles. Native installation, signing and distribution were not verified. |
| Database migration | Passed in embedded PostgreSQL and applied to a disposable PostgreSQL 15 fixture. Five RLS ownership filters, anonymous write denial and transaction rollback checked. |
| Supabase | Hosted Auth health returned HTTP 200 with the supplied project key. Hosted migration and production rollout pending. Browser save, reload, history and sign-out passed on the isolated fixture. |
| Gateway | Allowed route, origin restriction, key injection and session forwarding checked. |
| k6 | 100 VUs for 60 seconds. 3,886 HTTP requests, 61.82 requests/s, 1,262.52 ms mean, 4,159.55 ms p95, 4.84% failed. Both thresholds failed. |
| Security | npm audit identified 28 affected dependency entries: 13 high, 14 moderate and one low. Semgrep reported zero findings for 104 rules over seven scanned files. Gitleaks reported no matching secrets in the apps scan. Trivy results are included. |
| CI | Four workflows validated structurally. GitHub-hosted execution and artifact availability have not been verified. |
| Reports | All five XLSX files reopened. Web and mobile detail sheets each have 332 data rows. |

The first load run exposed a missing authenticated role in the manually assembled disposable Auth fixture. The role was corrected before the final baseline. Final HTTP aggregates include one setup sign-in. Iteration-level successful and failed counters exclude that setup request. The 188 final failed responses require diagnosis on a suitably instrumented deployment. No generated load was directed to the supplied hosted project.

Native system navigation, deep-link recovery on real devices, registration through verification email, offline transitions and multi-browser behavior still require end-to-end validation. The scoring rubric and review boundaries appear in the security reports.
