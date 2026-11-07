# Сборка Bloky в Docker на Windows. Результат: _build\unpacked (для «Загрузить распакованное») и zip.
#   powershell -ExecutionPolicy Bypass -File tools\bloky\dev\build.ps1          — собрать
#   powershell -ExecutionPolicy Bypass -File tools\bloky\dev\build.ps1 test     — тесты, типы, линтер
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$b = Join-Path $root '_build'
New-Item -ItemType Directory -Force $b | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'build.sh'), (Join-Path $PSScriptRoot 'Dockerfile') $b -Force
$t = [IO.File]::ReadAllText("$b\build.sh") -replace "`r`n", "`n"
[IO.File]::WriteAllText("$b\build.sh", $t)
docker build -q -t bloky-build $b | Out-Null
docker run --rm -v "${root}:/src:ro" -v bloky-work:/work -v "${b}:/out" bloky-build bash /out/build.sh $args
if ($LASTEXITCODE -ne 0) { throw "build failed" }
