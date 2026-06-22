import type { AnomalyResult } from "@/types";

// Generates a static image URL for the email chart via QuickChart API
export function buildStaticChartUrl(passCount: number, failCount: number): string {
  const chartConfig = {
    type: "doughnut",
    data: {
      labels: ["Passed Checks", "Anomalies Detected"],
      datasets: [{ 
        data: [passCount, failCount], 
        backgroundColor: ["#10B981", "#EF4444"] // Tailwind Emerald-500 and Red-500
      }]
    },
    options: {
      plugins: {
        datalabels: { color: "#ffffff", font: { weight: "bold" } }
      }
    }
  };
  return `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&w=400&h=250`;
}

// Builds the structural HTML content for email templates
export function buildReportHtml(results: AnomalyResult[], chartUrl: string): string {
  const totalChecks = results.length;
  const failedChecks = results.filter(r => r.status === "fail" || r.status === "warning");
  const passCount = totalChecks - failedChecks.length;

  return `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; color: #333;">
      <div style="background-color: #f8fafc; padding: 20px; border-bottom: 3px solid #0ea5e9;">
        <h2 style="margin: 0; color: #0f172a;">Daily Data Quality Report</h2>
        <p style="margin: 5px 0 0 0; color: #64748b;">${new Date().toLocaleDateString()}</p>
      </div>
      
      <div style="padding: 20px;">
        <p style="font-size: 16px;">
          <strong>Summary:</strong> ${passCount} out of ${totalChecks} validation rules passed successfully.
        </p>
        
        <div style="text-align: center; margin: 30px 0;">
          <img src="${chartUrl}" alt="Data Quality Chart" style="max-width: 100%; height: auto; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" />
        </div>

        <h3 style="color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Anomalies Detected:</h3>
        <ul style="padding-left: 20px;">
          ${failedChecks.length > 0 
            ? failedChecks.map(f => `
                <li style="margin-bottom: 12px;">
                  <strong style="color: ${f.status === "fail" ? "#ef4444" : "#f59e0b"};">
                    [${f.status.toUpperCase()}] ${f.checkName}:
                  </strong> 
                  ${f.message}
                </li>
              `).join("") 
            : '<li style="color: #10b981; font-weight: bold;">No anomalies detected today! Data is perfectly clean.</li>'}
        </ul>
        
        <div style="text-align: center; margin-top: 40px;">
          <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/admin/dashboard" 
             style="background-color: #0ea5e9; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
             View Live Dashboard
          </a>
        </div>
      </div>
    </div>
  `;
}

// Resilient Alias Export to prevent compilation mismatches inside api/cron/route.ts
export function buildHtmlReport(checks: AnomalyResult[], runDate: string): string {
  const totalChecks = checks.length;
  const failedChecks = checks.filter(r => r.status === "fail" || r.status === "warning");
  const passCount = totalChecks - failedChecks.length;
  const staticChartUrl = buildStaticChartUrl(passCount, failedChecks.length);
  return buildReportHtml(checks, staticChartUrl);
}