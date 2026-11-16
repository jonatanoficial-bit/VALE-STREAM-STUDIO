param([Parameter(Mandatory)] [string] $Destination)

$ErrorActionPreference = 'Stop'
$root = (New-Item -ItemType Directory -Force -Path $Destination).FullName
$archive = Join-Path $root 'ffmpeg-9.0.2.zip'
$name = 'ffmpeg-9.0.2-essentials_build'
$url = "https://www.gyan.dev/ffmpeg/builds/packages/$name.zip"
Invoke-WebRequest -Uri $url -OutFile $archive
$expected = '60f467265b1e312373dbcd92200c2618a74850f98d3d078e94296bb3fa2047ba'
if ((Get-FileHash -LiteralPath $archive).Hash -ne $expected) { throw 'Hash do encoder divergente.' }
Expand-Archive -LiteralPath $archive -DestinationPath $root -Force
$package = Join-Path $root $name
$output = (New-Item -ItemType Directory -Force -Path (Join-Path $root 'encoder')).FullName
Copy-Item -LiteralPath (Join-Path $package 'bin/ffmpeg.exe'),(Join-Path $package 'LICENSE'),(Join-Path $package 'README.txt') -Destination $output
$output
