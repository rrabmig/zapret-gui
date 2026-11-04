# Runs only on an ephemeral Windows runner. Never launches GUI, winws or upstream tools.
$ErrorActionPreference = 'Stop'
$setup = @(Get-ChildItem build/bin/GUIforzapret-Setup-*-x64.exe)
if ($setup.Count -ne 1) { throw 'Expected one installer' }
$installDir = Join-Path $env:LOCALAPPDATA 'Programs/GUIForZapret'
$legacyInstallDir = Join-Path $env:LOCALAPPDATA 'Programs/ZapretDesktop'
$exe = Join-Path $installDir 'GUIforzapret.exe'
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
    $metadata = [Diagnostics.FileVersionInfo]::GetVersionInfo($file)
    Write-Output "Metadata: $file / CompanyName='$($metadata.CompanyName)' / FileVersion='$($metadata.FileVersion)'"
    if ($metadata.CompanyName -ne 'rrabmig') { throw "Missing CompanyName on $file" }
    if ($metadata.ProductName -ne 'GUI for zapret') { throw "Wrong product name on $file" }
}
$registration = Get-ItemProperty $key
if ($registration.Publisher -ne 'rrabmig') { throw 'Wrong publisher' }
if ($registration.DisplayName -ne 'GUI for zapret') { throw 'Wrong installed application name' }
if (!(Test-Path (Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs/GUI for zapret.lnk'))) { throw 'Missing Start menu entry' }
New-Item "$installDir/versions/fixture" -ItemType Directory -Force | Out-Null
New-Item "$dataDir/overrides" -ItemType Directory -Force | Out-Null
Set-Content "$installDir/versions/fixture/sentinel.txt" 'preserve me' -NoNewline
Set-Content "$dataDir/overrides/sentinel.txt" 'preserve me' -NoNewline
# Seed only inert files representing an existing GUI installation's old entrypoints.
Set-Content "$installDir/ZapretDesktop.exe" 'inert legacy GUI fixture' -NoNewline
$oldShortcut = Join-Path ([Environment]::GetFolderPath('StartMenu')) 'Programs/Zapret Desktop.lnk'
Set-Content $oldShortcut 'inert legacy shortcut fixture' -NoNewline
# Simulate the previous managed installation path without launching an old GUI.
Move-Item $installDir $legacyInstallDir
Set-ItemProperty 'HKCU:\Software\rrabmig\ZapretDesktop' -Name InstallDir -Value $legacyInstallDir
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'GUI for zapret.lnk'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($desktopShortcut)
$shortcut.TargetPath = Join-Path $legacyInstallDir 'GUIforzapret.exe'
$shortcut.Save()
# A nonempty destination must abort without overwriting either directory.
New-Item $installDir -ItemType Directory -Force | Out-Null
Set-Content "$installDir/collision.txt" 'keep target' -NoNewline
$blocked = Start-Process $setup[0].FullName -ArgumentList '/S' -Wait -PassThru
if ($blocked.ExitCode -eq 0) { throw 'Directory collision was ignored' }
if ((Get-Content "$legacyInstallDir/versions/fixture/sentinel.txt" -Raw) -ne 'preserve me') { throw 'Legacy data lost on failed move' }
if ((Get-Content "$installDir/collision.txt" -Raw) -ne 'keep target') { throw 'Target data overwritten' }
Remove-Item "$installDir/collision.txt"
Remove-Item $installDir
Run-Setup
if ($shell.CreateShortcut($desktopShortcut).TargetPath -ne $exe) { throw 'Desktop shortcut was not retargeted' }
if (Test-Path $legacyInstallDir) { throw 'Legacy installation directory was not moved' }
if ((Get-ItemProperty 'HKCU:\Software\rrabmig\ZapretDesktop').InstallDir -ne $installDir) { throw 'InstallDir registration was not updated' }
Assert-Preserved
if ((Test-Path "$installDir/ZapretDesktop.exe") -or (Test-Path $oldShortcut)) { throw 'Legacy GUI entrypoints were not replaced' }
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
# Also preserve builds left in the old directory after an uninstall.
Move-Item $installDir $legacyInstallDir
Run-Setup
Assert-Preserved
if (Test-Path $legacyInstallDir) { throw 'Orphaned legacy versions were not moved' }
if (Get-Process winws -ErrorAction SilentlyContinue) { throw 'Engine unexpectedly running' }
Write-Output 'Installer, metadata, upgrade, reinstall, locks and data retention passed; no engine started.'
