# Opens the presentation in Microsoft PowerPoint and exports a PDF copy (for sharing and for visual checks).
# Usage (from the repo root): powershell -ExecutionPolicy Bypass -File scripts\report\export_slides_pdf.ps1
$dir  = Join-Path $PSScriptRoot '..\..\docs\deliverables' | Resolve-Path
$pptx = Join-Path $dir 'DPDP_Simplifier_Presentation.pptx'
$pdf  = Join-Path $dir 'DPDP_Simplifier_Presentation.pdf'

$app = New-Object -ComObject PowerPoint.Application
try {
  $p = $app.Presentations.Open([string]$pptx, $true, $false, $false)   # read-only, no window
  $p.SaveAs([string]$pdf, 32)                                          # 32 = ppSaveAsPDF
  Write-Output ("slides: " + $p.Slides.Count)
  $p.Close()
} finally {
  try { $app.Quit() } catch { }
}
Write-Output "wrote $pdf"
