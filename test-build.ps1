$body = @'
{
  "dockerfile": "FROM node:18-alpine\nWORKDIR /app\nRUN echo Hello from Docker Build",
  "imageName": "test-app",
  "imageTag": "v1"
}
'@

Write-Host "=== Submitting Docker Build Job ===" -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "http://localhost:4000/api/docker/build" -Method POST -Body $body -ContentType "application/json"
Write-Host "Job ID: $($response.jobId)" -ForegroundColor Green
Write-Host "Session ID: $($response.sessionId)" -ForegroundColor Green
Write-Host "Status: $($response.status)" -ForegroundColor Yellow

Write-Host "`n=== Waiting 3 seconds for job to process ===" -ForegroundColor Cyan
Start-Sleep -Seconds 3

Write-Host "`n=== Checking Job Status ===" -ForegroundColor Cyan
$jobStatus = Invoke-RestMethod -Uri "http://localhost:4000/api/queue/jobs/docker-build/$($response.jobId)"
$jobStatus | ConvertTo-Json -Depth 10

Write-Host "`n=== Queue Statistics ===" -ForegroundColor Cyan
Invoke-RestMethod -Uri "http://localhost:4000/api/queue/stats" | ConvertTo-Json -Depth 10
