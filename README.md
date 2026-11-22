# GeneScan – DNA Sequence Analyzer

GeneScan analyzes a sequence locally and saves it to the signed-in user's Supabase account on request. The React web application and Expo Android/iOS application use separate interfaces and share validation, sequence algorithms and account/data client. The included Node gateway is the sole application component that receives the Supabase project key.

## Start the project

Use Node 24.22.1 or newer in the 24.x line, npm and Python 3 with openpyxl. Extract the ZIP and run the following from its GeneScan folder.

```sh
npm ci
python -m pip install openpyxl
cp -n .env.example .env   # fresh installations only
```

1. In your Supabase dashboard, open the SQL Editor and execute `supabase/migrations/20261121000000_genescan.sql` once on a fresh project. Alternatively, use `supabase link --project-ref YOUR_PROJECT_REF` followed by `supabase db push --remote` (CLI 3). The migration is already applied to project `blvrafdufsdjdxiksesp`. All five tables and their ownership policies were verified there. To see data, sign in, analyze a sequence, and select **Save analysis**. Import a file before saving to populate `uploaded_files`.
2. Email confirmation is disabled for immediate signup. In Authentication URL Configuration allow the web origin and `genescan://auth` for signup and password recovery callbacks. Configure the mail provider for your deployment.
3. Set `SUPABASE_PUBLISHABLE_KEY` in the server environment or your local ignored `.env`. On this computer, the ignored .env already configures the supplied project. The example contains the supplied project URL. The value belongs to the gateway process. The gateway does not require a service-role key.
4. Run `npm run dev` and visit http://localhost:5173. This automatically starts the local gateway in the background if it is not already reachable. The public analyzer works without signing in. Account, history and saving require the gateway and schema.
5. For a production web build run `npm run build` and serve `apps/web/dist` with HTTPS. Deploy `apps/gateway/server.js` behind HTTPS, set `WEB_ORIGIN` to a comma-separated list of exact frontend origins and set `EXPO_PUBLIC_GATEWAY_URL` to that gateway's HTTPS URL **before** building the web and Expo clients. The gateway URL is the only public environment setting.

## Mobile

Run `npm run mobile` from the project root for Metro. This automatically starts the local gateway in the background if it is not already reachable. Do not start Expo directly with `npx expo start` if you need this automatic gateway startup; direct Expo CLI commands bypass the project scripts. Use `npx expo run:android` with Android Studio/SDK and a connected device, or `npx expo run:ios` on macOS with Xcode. A development build supports GeneScan's native redirect scheme. For local development the mobile app resolves `localhost` or `127.0.0.1` to the Metro host automatically on a physical device, and falls back to `10.0.2.2` on an Android emulator. For another network or a hosted gateway, set `EXPO_PUBLIC_GATEWAY_URL` to the reachable HTTP or HTTPS gateway URL before rebuilding. Android emulator fixture setup may use `adb reverse tcp:8787 tcp:8787`. Keep the gateway key on the server. Run `npx expo export --platform android --platform ios` to produce both platform JS bundles. Native device builds are separate from these exports. The detached gateway logs to `build/gateway-background.log`.

## Project map

| Path | Contents |
|---|---|
| apps/web | Vite, React DOM, React Router, CSS, browser picker and JSON export |
| apps/mobile | Expo entry, system file picker, native sharing, session and deep-link integration |
| apps/gateway | Node HTTP gateway with fixed upstream, origin validation, body limit, allowed methods and paths |
| packages/shared | IUPAC analyzer, file validation and unit tests |
| packages/supabase | Shared session client, saved analysis service, history query |
| packages/ui | Native interface for Expo Android and iOS |
| supabase | Shared migration, RLS and CLI configuration |
| selenium-tests, appium-tests | Executable Mocha suites, page objects, reports and recorded evidence |
| performance | k6 workload, measured metrics and performance reports |
| security/scripts, scripts | Control checks, fixture setup and report generation |
| .github/workflows | Four independent artifact-producing workflows |

## Calculation policy

The analyzer accepts one sequence or one FASTA record. It removes whitespace, folds lowercase bases and validates the 15 IUPAC DNA symbols. Length and frequencies include ambiguous positions. GC% uses 100 × (G+C)/(A+C+G+T), and AT% uses the same canonical denominator. The AT/GC ratio divides (A+T) by (G+C). A zero denominator displays as undefined and exports as JSON null. Reverse complement preserves ambiguity semantics. The input limit is 100,000 bases, with a 200 KB upload limit. Each save writes the sequence, canonical statistics, history and optional filename in one database transaction. The dashboard displays all-time saved and uploaded totals and the latest 100 analyses.

## Tests and audit

- Unit and schema checks: `npm test`, `npm run lint`, `node scripts/db-test.js`, `node security/scripts/gateway-check.js`. The schema test uses embedded PostgreSQL with a test auth context.
- Web E2E: start Vite, set `WEB_URL` if it differs from http://localhost:5173 and run `npm run selenium`. Set `CHROME_BIN` and `CHROMEDRIVER` for an explicit matching browser/driver pair, or use Selenium Manager. For full account integration set `TEST_GATEWAY_URL`, `TEST_EMAIL` and `TEST_PASSWORD` for a dedicated test account in the same fixture as the frontend.
- Mobile E2E: install Appium 3 and its UiAutomator2 driver, install the native release build on the test device, start Appium on port 4723 and run `npm run appium`. Use the same dedicated fixture variables. Android document-picker tests use the system Downloads location. Set TEST_LOCAL_MAIL=1 only for a disposable local fixture with a mail catcher to run the signup and recovery scenarios. These selectors have not been validated on a device in this workspace.
- Both suites use 225 ordered IUPAC pair fixtures for exhaustive adjacent-symbol reverse-complement coverage. Additional scenarios cover canonical ratios, ambiguity handling, parsing, files, account controls, dashboard access, persistence and layout. Device-specific coverage is narrower than the analyzer matrix. This delivery has not validated iOS UI automation, browser engines other than Chromium, real email delivery, Android system back, or offline recovery.
- Execution records are append-only. Reports take the latest recorded result for each ID. For a new independent run, start with an empty `results.ndjson` in the corresponding test folder. Generate reports with `python scripts/reports.py selenium appium`. Discovery uses `npm run selenium -- --dry-run` and `npm run appium -- --dry-run`.
- Security: run `npm audit --json`, `semgrep scan --config p/javascript --config p/secrets apps packages`, `trivy fs --scanners vuln .`, `gitleaks dir --redact .` and the database/gateway checks. The security workflow writes the expected machine-readable files and generates the workbooks. Findings and scanner scope are in `Vulnerability Test Results/`. Review open package advisories before release. Cloud deployment configuration, rate limits and production headers still require verification.
- Load test: set `TEST_GATEWAY_URL`, `TEST_EMAIL`, `TEST_PASSWORD` to a disposable fixture. Run `k6 run performance/load-test.js`, then `python scripts/reports.py performance`. This test writes synthetic data to the fixture. The measured local baseline used the real Supabase Auth and PostgREST services, PostgreSQL 15 and the GeneScan gateway. The workload shares one dedicated account across virtual users. Results describe this workspace and fixture.
- GitHub: push the extracted source including the hidden `.github` folder to a repository with Actions enabled. Each workflow supports pushes, pull requests and manual dispatch. CI creates a local Supabase fixture and transient test credentials where required. No hosted production secret is required for those jobs. The dependency-review action requires repository support for dependency review. Download the named artifact from the relevant run. Artifacts use 30-day retention. GitHub-hosted jobs and artifact downloads have not been executed in this workspace.

## Reports in the ZIP

- `selenium-tests/selenium-test-report.xlsx`
- `appium-tests/appium-test-report.xlsx`
- `Vulnerability Test Results/endpoint-inventory.xlsx`
- `Vulnerability Test Results/findings.xlsx`
- `performance/reports/performance-summary.xlsx`

See `VALIDATION.md` for measured results. The archive includes the lockfile, source, web build, Expo platform bundles and current reports. Local credentials, node_modules, signing keys and fixture databases are excluded.

For Expo Go on Android over Wi-Fi, add the exact gateway origin on your computer (for example, `http://192.168.1.10:8787`) to the comma-separated `WEB_ORIGIN` setting and restart the gateway. Android sends that origin during the realtime WebSocket handshake.
