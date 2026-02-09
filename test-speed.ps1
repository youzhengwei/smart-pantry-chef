$start = Get-Date
$response = Invoke-WebRequest -Uri "http://localhost:3000/search-products" `
  -Method POST `
  -Body (@{query='apple'} | ConvertTo-Json) `
  -ContentType "application/json" `
  -ErrorAction SilentlyContinue

$end = Get-Date
$duration = ($end - $start).TotalSeconds

Write-Host "Duration: $([Math]::Round($duration, 2)) seconds"
Write-Host "Response Status: $($response.StatusCode)"
