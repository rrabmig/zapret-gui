# Runner-only: inspect the actual compiled Setup controls in both languages.
# Stop on the options page; never enter installation or start the GUI/engine.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class SetupControls {
    private delegate bool EnumProc(IntPtr handle, IntPtr param);
    [DllImport("user32.dll")] private static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr param);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] private static extern int GetWindowText(IntPtr handle, StringBuilder text, int count);
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr handle, uint message, IntPtr wparam, IntPtr lparam);
    [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr handle);
    [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr parent, int id);
    [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr handle, uint message, IntPtr wparam, IntPtr lparam);
    public static Dictionary<IntPtr,string> Texts(IntPtr parent) {
        var result = new Dictionary<IntPtr,string>();
        EnumChildWindows(parent, (handle, _) => {
            var text = new StringBuilder(2048);
            GetWindowText(handle, text, text.Capacity);
            if (text.Length > 0) result[handle] = text.ToString();
            return true;
        }, IntPtr.Zero);
        return result;
    }
}
'@
$setup = @(Get-ChildItem build/bin/GUIforzapret-Setup-*-x64.exe)
if ($setup.Count -ne 1) { throw 'Expected one installer' }
$labels = @{
    1033 = 'Create a desktop shortcut'
    1049 = 'Создать ярлык на рабочем столе'
}
foreach ($lang in @(1033,1049)) {
    $process = Start-Process $setup[0].FullName -ArgumentList "/LANG=$lang" -PassThru
    try {
        $deadline = [DateTime]::UtcNow.AddSeconds(20)
        do {
            Start-Sleep -Milliseconds 100
            $process.Refresh()
            $window = $process.MainWindowHandle
            $title = $process.MainWindowTitle
            $next = [SetupControls]::GetDlgItem($window,1)
            $ready = $window -and $title.Contains('GUI for zapret') -and $next -and [SetupControls]::IsWindowEnabled($next)
        } while (!$ready -and !$process.HasExited -and [DateTime]::UtcNow -lt $deadline)
        if (!$ready) { throw "Setup welcome page is not ready for language $lang; title='$title'" }
        Write-Output "Setup window title verified: $title"
        # BM_CLICK: advance only from Welcome to the options page.
        [void][SetupControls]::PostMessage($next,0xF5,[IntPtr]::Zero,[IntPtr]::Zero)
        $checkbox = [IntPtr]::Zero
        do {
            Start-Sleep -Milliseconds 100
            $texts = [SetupControls]::Texts($window)
            foreach ($control in $texts.GetEnumerator()) {
                if ($control.Value -ceq $labels[$lang]) { $checkbox = $control.Key }
            }
        } while (!$checkbox -and [DateTime]::UtcNow -lt $deadline)
        if (!$checkbox) { throw "Missing or garbled $lang checkbox: $($texts.Values -join ' | ')" }
        # BM_GETCHECK: desktop shortcut is an explicit opt-in, not a popup during copy.
        if ([SetupControls]::SendMessage($checkbox,0xF0,[IntPtr]::Zero,[IntPtr]::Zero) -ne [IntPtr]::Zero) {
            throw 'Desktop shortcut must default to unchecked'
        }
        Write-Output "Setup language $lang verified: $($labels[$lang]); checkbox unchecked; no installation started."
    } finally {
        $process.Refresh()
        if (!$process.HasExited) { Stop-Process -Id $process.Id -Force }
        $process.Dispose()
    }
}
