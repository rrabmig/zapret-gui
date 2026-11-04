# Runs only on an ephemeral Windows runner. Never launches GUI, winws or upstream tools.
$ErrorActionPreference = 'Stop'
$setup = @(Get-ChildItem build/bin/ZapretDesktop-Setup-*-x64.exe)
if ($setup.Count -ne 1) { throw 'Expected one installer' }
$installDir = Join-Path $env:LOCALAPPDATA 'Programs/ZapretDesktop'
$exe = Join-Path $installDir 'ZapretDesktop.exe'
$uninstaller = Join-Path $installDir 'uninstall.exe'
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\rrabmig.ZapretDesktop'
$dataDir = Join-Path $env:APPDATA 'ZapretDesktop'
function Run-Setup {
    $process = Start-Process $setup[0].FullName -ArgumentList '/S' -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Installer exited $($process.ExitCode)" }
    if (!(Test-Path $exe)) { throw 'Application not installed' }
}
function Run-Uninstall {
    # NSIS normally forks a temporary uninstaller. _?= keeps this check synchronous.
    $process = Start-Process $uninstaller -ArgumentList "/S _?=$installDir" -Wait -PassThru
    return $process.ExitCode
}
function Assert-Preserved {
    foreach ($file in @("$installDir/versions/fixture/sentinel.txt", "$dataDir/overrides/sentinel.txt")) {
        if ((Get-Content $file -Raw) -ne 'preserve me') { throw "Lost $file" }
    }
}
Run-Setup
foreach ($file in @($exe, $setup[0].FullName)) {
    if ([Diagnostics.FileVersionInfo]::GetVersionInfo($file).CompanyName -ne 'rrabmig') { throw "Missing CompanyName on $file" }
}
$registration = Get-ItemProperty $key
if ($registration.Publisher -ne 'rrabmig') { throw 'Wrong publisher' }
if (!(Test-Path (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs/Zapret Desktop.lnk'))) { throw 'Missing Start menu entry' }
New-Item "$installDir/versions/fixture" -ItemType Directory -Force | Out-Null
New-Item "$dataDir/overrides" -ItemType Directory -Force | Out-Null
Set-Content "$installDir/versions/fixture/sentinel.txt" 'preserve me' -NoNewline
Set-Content "$dataDir/overrides/sentinel.txt" 'preserve me' -NoNewline
Run-Setup
Assert-Preserved
# A running controller must block installation/removal. No GUI is launched.
$mutex = [Threading.Mutex]::new($false, 'Local\rrabmig.ZapretDesktop')
try {
    $code = Run-Uninstall
    if ($code -eq 0 -or !(Test-Path $exe)) { throw 'Uninstaller ignored controller lock' }
} finally { $mutex.Dispose() }
# Register an inert, never-started service to verify the uninstall guard.
& sc.exe create ZapretDesktop binPath= "$env:SystemRoot\System32\cmd.exe /c exit 0" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Cannot create inert service fixture' }
try {
    $code = Run-Uninstall
    if ($code -eq 0 -or !(Test-Path $exe)) { throw 'Uninstaller ignored installed service' }
    Assert-Preserved
} finally { & sc.exe delete ZapretDesktop | Out-Null }
$code = Run-Uninstall
if ($code -ne 0 -or (Test-Path $exe) -or (Test-Path $key)) { throw 'Uninstall did not complete' }
Assert-Preserved
Run-Setup
Assert-Preserved
if (Get-Process winws -ErrorAction SilentlyContinue) { throw 'Engine unexpectedly running' }
Write-Output 'Installer, metadata, upgrade, reinstall, locks and data retention passed; no engine started.'
