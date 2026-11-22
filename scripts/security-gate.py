import json
import os
from pathlib import Path


def load(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        return None


audit = load("Vulnerability Test Results/npm-audit.json")
trivy = load("Vulnerability Test Results/trivy.json")
audit_critical = sum(
    1
    for item in (audit or {}).get("vulnerabilities", {}).values()
    if item.get("severity") == "critical"
)
trivy_critical = sum(
    1
    for result in (trivy or {}).get("Results", [])
    for item in result.get("Vulnerabilities", [])
    if item.get("Severity") == "CRITICAL"
)
scanner_status = {
    "npm audit": os.getenv("AUDIT", "not run"),
    "Semgrep": os.getenv("SAST", "not run"),
    "Trivy": os.getenv("TRIVY", "not run"),
    "Gitleaks": os.getenv("LEAKS", "not run"),
}
lines = [
    "## Security assessment",
    "",
    "| Scanner | Outcome |",
    "|---|---|",
]
lines.extend(f"| {name} | {status} |" for name, status in scanner_status.items())
lines.extend(
    [
        "",
        f"- npm audit critical advisories: {audit_critical}"
        if audit is not None
        else "- npm audit results: missing or invalid",
        f"- Trivy critical vulnerabilities: {trivy_critical}"
        if trivy is not None
        else "- Trivy results: missing or invalid",
        "",
        "Scanner failures or missing reports mean the assessment is incomplete; "
        "they are not reported as clean.",
    ]
)
summary = "\n".join(lines) + "\n"
summary_path = os.getenv("GITHUB_STEP_SUMMARY")
if summary_path:
    with open(summary_path, "a", encoding="utf-8") as output:
        output.write(summary)
print(summary, end="")
raise SystemExit(1 if audit_critical + trivy_critical else 0)
