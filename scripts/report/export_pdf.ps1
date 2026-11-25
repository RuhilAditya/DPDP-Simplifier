# Opens the report in Microsoft Word, fills the table of contents, saves the .docx and exports the PDF.
# Usage (from the repo root): powershell -ExecutionPolicy Bypass -File scripts\report\export_pdf.ps1
$dir  = Join-Path $PSScriptRoot '..\..\docs\deliverables' | Resolve-Path
$docx = Join-Path $dir 'DPDP_Simplifier_Project_Report.docx'
$pdf  = Join-Path $dir 'DPDP_Simplifier_Project_Report.pdf'

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
  $d = $word.Documents.Open([string]$docx, $false, $false)
  $d.Fields.Update() | Out-Null
  foreach ($t in $d.TablesOfContents) { $t.Update() }
  $d.Save()
  $d.ExportAsFixedFormat([string]$pdf, 17)   # 17 = wdExportFormatPDF
  Write-Output ("pages: " + $d.ComputeStatistics(2))
  $d.Close($false)
} finally {
  try { $word.Quit() } catch { }
}
Write-Output "wrote $pdf"
