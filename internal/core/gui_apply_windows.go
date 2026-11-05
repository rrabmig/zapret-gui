//go:build windows

package core

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

func StartGUIUpdate(root string, state GUIUpdate, language string) error {
	if windows.GetCurrentProcessToken().IsElevated() {
		return NewMessageError("guiUpdateUnelevated")
	}
	if !state.Ready {
		return guiError()
	}
	if err := verifyGUIInstaller(state.Installer, state.Asset); err != nil {
		return err
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	if !strings.EqualFold(filepath.Base(exe), "GUIforzapret.exe") {
		return guiError()
	}
	stage := filepath.Dir(state.Installer)
	var helper string
	// A retry uses a fresh helper filename; never overwrite a running helper.
	f, err := os.CreateTemp(stage, "helper-*.exe")
	if err != nil {
		return err
	}
	helper = f.Name()
	f.Close()
	os.Remove(helper)
	if err = copyGUIFile(exe, helper); err != nil {
		return err
	}
	job := filepath.Join(stage, filepath.Base(helper)+".json")
	j := GUIUpdateJob{Parent: uint32(os.Getpid()), Installer: state.Installer, Asset: state.Asset, Target: filepath.Dir(exe), DataDir: root, Language: NormalizeLanguage(language), Restart: true}
	if err = writeGUIJob(job, j); err != nil {
		return err
	}
	cmd := exec.Command(helper, "--apply-gui-update", job)
	cmd.SysProcAttr = &syscall.SysProcAttr{CreationFlags: windows.CREATE_NEW_PROCESS_GROUP, HideWindow: true}
	if err = cmd.Start(); err != nil {
		return err
	}
	// The helper opens a handle to this exact process before acknowledging readiness.
	// If startup fails the GUI remains open and its installation is untouched.
	defer cmd.Process.Release()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if _, err = os.Stat(job + ".ready"); err == nil {
			return nil
		}
		if data, e := os.ReadFile(job + ".failed"); e == nil {
			return fmt.Errorf("%s", data)
		}
		time.Sleep(50 * time.Millisecond)
	}
	// No readiness means no permission to install. A late helper sees the abort.
	_ = AtomicWrite(job+".abort", []byte("aborted"))
	return NewMessageError("guiUpdateHelperTimeout")
}

// RunGUIUpdate never starts the engine, changes services or removes user data.
func RunGUIUpdate(name string) (result error) {
	j, err := readGUIJob(name)
	if err != nil {
		return err
	}
	defer func() {
		if result != nil {
			_ = AtomicWrite(name+".failed", []byte(result.Error()))
			// Show a readable localized error even when the GUI is already closed.
			title, text := "GUI for zapret update", "Update was not completed. Your data is kept. Open GUI for zapret and retry. Diagnostic file:\n"+name+".failed"
			if j.Language == "ru" {
				title = "Обновление GUI for zapret"
				text = "Обновление не завершено. Данные сохранены. Откройте GUI for zapret и повторите попытку. Файл диагностики:\n" + name + ".failed"
			}
			t, _ := windows.UTF16PtrFromString(title)
			b, _ := windows.UTF16PtrFromString(text)
			windows.NewLazySystemDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(b)), uintptr(unsafe.Pointer(t)), 0x10)
		}
	}()
	if windows.GetCurrentProcessToken().IsElevated() {
		return NewMessageError("guiUpdateUnelevated")
	}
	parent, err := windows.OpenProcess(windows.SYNCHRONIZE, false, j.Parent)
	if err != nil {
		return err
	}
	defer windows.CloseHandle(parent)
	if err = verifyGUIInstaller(j.Installer, j.Asset); err != nil {
		return err
	}
	if err = AtomicWrite(name+".ready", []byte("ready")); err != nil {
		return err
	}
	waited, err := windows.WaitForSingleObject(parent, 60000)
	if err != nil {
		return err
	}
	if waited != windows.WAIT_OBJECT_0 {
		return NewMessageError("guiUpdateHelperTimeout")
	}
	if _, err = os.Stat(name + ".abort"); err == nil {
		return NewMessageError("guiUpdateHelperTimeout")
	}
	// Recheck immediately before executing. The staged file is never a shell command.
	if err = verifyGUIInstaller(j.Installer, j.Asset); err != nil {
		return err
	}

	lang := "1033"
	if j.Language == "ru" {
		lang = "1049"
	}
	if strings.ContainsAny(j.Target, "\x00\r\n\"") {
		return guiError()
	}
	return installGUI(j, name, func() error {
		setup := exec.Command(j.Installer)
		// NSIS /D must be the last parameter and unquoted, including spaces.
		setup.SysProcAttr = &syscall.SysProcAttr{CmdLine: syscall.EscapeArg(j.Installer) + " /LANG=" + lang + " /D=" + j.Target}
		setup.Dir = filepath.Dir(j.Installer)
		return setup.Run()
	}, func() error {
		restart := exec.Command(filepath.Join(j.Target, "GUIforzapret.exe"), "--data-dir", j.DataDir)
		restart.Dir = j.Target
		if err := restart.Start(); err != nil {
			return err
		}
		return restart.Process.Release()
	})
}
