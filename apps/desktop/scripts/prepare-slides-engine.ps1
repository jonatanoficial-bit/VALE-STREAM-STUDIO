param([Parameter(Mandatory)] [string] $Destination)

$ErrorActionPreference = 'Stop'
$version = '26.2.7'
$file = "LibreOffice_${version}_Win_x86-64.msi"
$base = New-Item -ItemType Directory -Path $Destination -Force
$msi = Join-Path $base.FullName $file
$engine = Join-Path $base.FullName 'engine'
if (Test-Path (Join-Path $engine 'program\soffice.exe')) {
  throw 'Use uma pasta nova para preparar o motor de slides.'
}
Invoke-WebRequest -Uri "https://download.documentfoundation.org/libreoffice/stable/$version/win/x86_64/$file" -OutFile $msi
$signature = Get-AuthenticodeSignature -LiteralPath $msi
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'CN=The Document Foundation') {
  throw 'O MSI não possui a assinatura válida da The Document Foundation.'
}
$process = Start-Process msiexec.exe -ArgumentList "/a `"$msi`" /qn TARGETDIR=`"$engine`"" -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0 -or !(Test-Path (Join-Path $engine 'program\soffice.exe'))) {
  throw "Não foi possível extrair o motor de slides. MSI retornou $($process.ExitCode)."
}
$engine
