"""Generate workbooks from the executable catalog and recorded evidence."""
import json, subprocess, sys, os
from pathlib import Path
from collections import Counter
from datetime import datetime, timezone
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference

def read(path, fallback):
    try: return json.loads(Path(path).read_text(encoding="utf-8-sig"))
    except (OSError, ValueError): return fallback

def sheet(wb, name, header, rows):
    ws = wb.create_sheet(name)
    ws.append(header)
    for row in rows:
        ws.append(row)
        for cell in ws[ws.max_row]:
            if cell.data_type == "f": cell.data_type = "s"
    for cell in ws[1]:
        cell.font = Font(name="Calibri", bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="184C50")
    ws.freeze_panes = "B2"
    ws.auto_filter.ref = ws.dimensions
    ws.row_dimensions[1].height = 28
    for col in ws.columns:
        longest = max(len(str(c.value or "")) for c in col)
        ws.column_dimensions[get_column_letter(col[0].column)].width = min(max(15, longest + 2), 64)
    for row in ws.iter_rows(min_row=2):
        for c in row:
            c.alignment = Alignment(vertical="top", wrap_text=True)
            color = {"PASSED":"D9EFDF","FAILED":"FFDBD5","NOT RUN":"F8EACD"}.get(str(c.value))
            if color: c.fill=PatternFill("solid",fgColor=color)
    return ws

def book():
    wb=Workbook()
    wb.remove(wb.active)
    return wb

def save(wb, path):
    wb.save(path)
    check=load_workbook(path,read_only=True)
    assert check.sheetnames==wb.sheetnames
    check.close()

def job_summary(title, rows):
    path = os.getenv("GITHUB_STEP_SUMMARY")
    if not path:
        return
    counts = Counter(status for _, status in rows)
    lines = ["## " + title, ""]
    if rows:
        fence = chr(96) * 3
        lines += [fence + "mermaid", "pie showData"]
        lines += [f'    "{status}" : {count}' for status, count in counts.items()]
        lines += [fence, "", "<details><summary>Individual results</summary>", "",
                  "| Case or check | Outcome |", "|---|---|"]
        from html import escape
        for name, status in rows:
            label = escape(name).replace("|", "&#124;").replace("\n", " ")
            lines.append(f"| {label} | {status} |")
        lines += ["", "</details>"]
    else:
        lines.append("No execution results were recorded.")
    with open(path, "a", encoding="utf8") as output:
        output.write("\n".join(lines) + "\n")

def e2e(kind):
    catalog=json.loads(subprocess.check_output(["node","--input-type=module","-e","import c from './scripts/scenarios.js';import {androidCases} from './scripts/android-cases.js';console.log(JSON.stringify(process.argv[1]==='appium'?androidCases:c))",kind]))
    folder=Path(kind+"-tests")
    evidence={}
    if (folder/"results.ndjson").exists():
        for line in (folder/"results.ndjson").read_text(encoding="utf-8-sig").splitlines():
            rec=json.loads(line); evidence[rec["id"]]=rec
    rows=[]; modules={}; defects=[]; counts=Counter()
    prefix="WEB-" if kind=="selenium" else "MOB-"
    for c in catalog:
        r=evidence.get(c["id"],{})
        status={"passed":"PASSED","failed":"FAILED"}.get(r.get("status"),"NOT RUN")
        counts[status]+=1
        modules.setdefault(c["module"],Counter())[status]+=1
        value=c["raw"] if len(c["raw"])<=80 else f'{len(c["raw"])} characters'
        steps={"analyze":"Clear input, enter "+repr(value)+", select Analyze and read "+c["target"],"file":"Import "+c.get("file","")+", validate and inspect the displayed outcome.","accountForm":"Open Account and exercise "+c.get("mode","")+" with the scenario inputs."}.get(c["action"],"Open the appropriate screen, perform "+c["action"]+" and inspect "+c["target"]+".")
        actual=c["expected"] if status=="PASSED" else r.get("error") or "No execution evidence"
        testid=prefix+c["id"]
        rows.append([testid,c["module"],c["title"],"Verify "+c["title"],"App running"+(", dedicated test account" if c.get("email")=="fixture" else ""),steps,c["expected"],actual,status,"High" if c["module"] in ["Authentication","Database integration"] else "Normal",r.get("time"),r.get("error")])
        if status=="FAILED":defects.append([testid,r.get("error"),"Needs triage"])
    n=len(rows);run=counts["PASSED"]+counts["FAILED"];wb=book()
    sheet(wb,"Test Summary",["Metric","Value"],[["Total test cases",n],["Passed",counts["PASSED"]],["Failed test count",counts["FAILED"]],["Skipped / not run",n-run],["Execution percentage",round(100*run/n,2)],["Pass percentage of executed",round(100*counts["PASSED"]/run,2) if run else None],["Last execution UTC",max([r.get("date","") for r in evidence.values()],default="NOT RUN")],["Browser / device",os.environ.get("TEST_BROWSER","Chromium" if kind=="selenium" else "Android UiAutomator2")],["Environment",os.environ.get("RUNNER_ENVIRONMENT","Local workspace") if run else "Awaiting execution"]])
    sheet(wb,"Detailed Test Cases",["Test Case ID","Module","Test Scenario","Test Description","Preconditions","Test Steps","Expected Result","Actual Result","Status","Priority","Execution Time (ms)","Error Details"],rows)
    ws=sheet(wb,"Module-wise Summary",["Module","Passed","Failed","Not run"],[[m,c["PASSED"],c["FAILED"],c["NOT RUN"]] for m,c in modules.items()])
    chart=BarChart();chart.title="Execution by module";chart.add_data(Reference(ws,min_col=2,max_col=4,min_row=1,max_row=ws.max_row),titles_from_data=True);chart.set_categories(Reference(ws,min_col=1,min_row=2,max_row=ws.max_row));ws.add_chart(chart,"F2")
    sheet(wb,"Defect Summary",["Test Case ID","Failure description","Severity"],defects)
    save(wb,folder/(kind+"-test-report.xlsx"))
    job_summary(kind.title() + " test results", [(r[0]+" "+r[2], r[8]) for r in rows])
    print(kind,dict(counts))

def performance():
    folder=Path("performance/reports");out=folder/"load-test-results.json"
    r=read(out,{"status":"NOT RUN","reason":"No completed k6 metrics available."})
    if not out.exists():out.write_text(json.dumps(r,indent=2),encoding="utf8")
    rows=[]
    for name,data in r.get("metrics",{}).items():
        for k,v in data.get("values",{}).items():rows.append([name,k,v])
    wb=book();sheet(wb,"Performance Summary",["Metric","Statistic","Value"],[["Run","Status",r["status"]],*rows]);save(wb,folder/"performance-summary.xlsx")
    job_summary("Performance thresholds", [(m+" "+k, "PASSED" if v["ok"] else "FAILED") for m,d in r.get("metrics",{}).items() for k,v in d.get("thresholds",{}).items()])
    thresholds=[f"{m} {k} — {'PASS' if v['ok'] else 'FAIL'}" for m,d in r.get("metrics",{}).items() for k,v in d.get("thresholds",{}).items()]
    (folder/"performance-report.md").write_text("# Performance baseline\n\n"+r["status"]+"\n\n100 virtual users for 60 seconds. One dedicated account signs in during setup. Each iteration retrieves the authenticated user, saves a synthetic sequence and reads recent history. One-second think time.\n\n"+"\n".join(thresholds)+"\n\n| Metric | Statistic | Value |\n|---|---|---:|\n"+"".join(f"| {m} | {k} | {v} |\n" for m,k,v in rows))

def security():
    d=Path("Vulnerability Test Results"); audit=read(d/"npm-audit.json",{}); vulns=audit.get("vulnerabilities",{})
    deps=[[k,v["severity"],v["range"],str(v.get("fixAvailable")),", ".join(str(x.get("title","")) if isinstance(x,dict) else x for x in v["via"])] for k,v in vulns.items()]
    trivy=read(d/"trivy.json",{});sem=read(d/"semgrep.json",{});leaks=read(d/"gitleaks.json",None)
    paths=[["/auth/v1/"+route,method,role,"apps/gateway/server.js"] for route,method,role in [("signup","POST","Public"),("token","POST","Public / refresh token"),("recover","POST","Public"),("logout","POST","User session"),("user","GET / PUT","User session")]]
    for table in ["profiles","dna_sequences","sequence_analyses","analysis_history","uploaded_files"]:paths.append(["/rest/v1/"+table,"GET / HEAD","Authenticated owner","supabase/migrations/20261121000000_genescan.sql"])
    paths.append(["/rest/v1/rpc/save_analysis","POST","Authenticated owner","supabase/migrations/20261121000000_genescan.sql"])
    findings=[[v[1],"Dependency advisory","package-lock.json","Build or runtime",v[0]+" "+v[2],"Affected code path requires reachability review.",v[4],"Upgrade and regression-test the affected package."] for v in deps]
    for r in sem.get("results",[]):findings.append([r["extra"]["severity"],r["check_id"],r["path"],"",r["extra"]["message"],"Review reported source location","Requires triage","Review and remediate before release."])
    for r in leaks or []:findings.append(["high","Potential secret",r.get("File"),"",r.get("RuleID"),"Credential disclosure","Unauthorized access","Remove and rotate if confirmed."])
    for t in trivy.get('Results',[]):
        for v in t.get('Vulnerabilities',[]):findings.append([v.get('Severity'),v.get('VulnerabilityID'),t.get('Target'),'',v.get('Title'),v.get('PkgName'),'Review reachable versions','Review fixed version '+str(v.get('FixedVersion',''))])
    scanners={"npm audit":bool(audit.get('metadata')),"Trivy":bool(trivy.get('SchemaVersion') and isinstance(trivy.get('Results'),list)),"Gitleaks":isinstance(leaks,list),"Semgrep":isinstance(sem.get("results"),list) and not sem.get("errors")}
    checks={"Completed npm audit":scanners["npm audit"],"Completed Trivy":scanners["Trivy"],"Completed Gitleaks":scanners["Gitleaks"],"Completed Semgrep":scanners["Semgrep"],"Database policy checks":(d/'db-check.log').exists() and 'PASS' in (d/'db-check.log').read_text(encoding="utf-8-sig"),"Gateway contract checks":(d/'gateway-check.log').exists() and 'PASS' in (d/'gateway-check.log').read_text(encoding="utf-8-sig"),"No high / critical dependency alerts":bool(audit.get('metadata')) and all(v['severity'] not in ['critical','high'] for v in vulns.values()),"Production deployment verified":False,"Independent mobile security validation":False,"External assessment completed":False}
    job_summary("Security scanner results", [(name, os.getenv(var, "not run")) for name,var in [("npm audit","AUDIT"),("Trivy","TRIVY"),("Gitleaks","LEAKS"),("Semgrep","SAST")]])
    score=10*sum(checks.values())
    for filename in ['endpoint-inventory.xlsx','findings.xlsx']:
        wb=book();sheet(wb,'Security Findings',['Severity','Vulnerability type','File path','Endpoint','Description','Exposure scenario','Impact','Recommended fix'],findings);sheet(wb,'Endpoint Inventory',['Endpoint','Method','Role / auth requirement','Source'],paths);sheet(wb,'Dependency Vulnerabilities',['Package','Severity','Affected versions','Fix available','Advisories'],deps);sheet(wb,'Risk Summary',['Evidence check','Satisfied'],list(checks.items()));save(wb,d/filename)
    totals=audit.get('metadata',{}).get('vulnerabilities',{})
    (d/'dependency-report.md').write_text('# Dependency assessment\n\n' + json.dumps(totals)+'\n\nThe npm count includes development tooling and transitive packages. Trivy covers the runtime dependency inventory by default. Entries from different scanners may overlap. Expand the workbook for affected ranges and fixes.\n')
    summary=f"Security verification score: {score}/100. Ten binary checks each contribute ten points. The score measures recorded evidence and release readiness. It is not a probability of compromise.\n\n"+'\n'.join('- '+k+' — '+('verified' if v else 'open') for k,v in checks.items())
    (d/'executive-summary.md').write_text('# Security summary\n\n'+summary+'\n\nOpen dependency advisories require reachability review before deployment.\n')
    (d/'security-review.md').write_text('# Security assessment\n\nNode gateway allowlists methods and paths. Supabase Auth handles credentials. PostgREST exposes PostgreSQL through RLS. There is no ORM or Edge Function. Both clients parse files locally and transmit sequence data only when saved. Raw file contents are not stored as blobs. Auth sessions persist on device. The gateway supplies the publishable key and forwards the caller’s JWT. A security-definer function binds inserts to auth.uid() and validates all related records within one transaction.\n\n'+summary+'\n\nReview scope includes application source, dependencies, secret patterns, gateway controls and ownership policies. A partial-parse warning or missing scanner output leaves its verification check open. Production TLS, platform access controls, email delivery, rate limits and deployed CORS require deployment-specific verification.\n')
for arg in sys.argv[1:] or ["selenium","appium","security","performance"]:
    if arg in ["selenium","appium"]:e2e(arg)
    elif arg=="performance":performance()
    elif arg=="security":security()
