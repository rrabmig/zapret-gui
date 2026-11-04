//go:build windows

package core

import (
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"
)

const serviceName = "ZapretDesktop"

type windowsEngine struct {
	mu  sync.Mutex
	cmd *exec.Cmd
}

func NewEngine() Engine { return &windowsEngine{} }

func (e *windowsEngine) State() EngineState {
	e.mu.Lock()
	pid := uint32(0)
	if e.cmd != nil && e.cmd.Process != nil {
		pid = uint32(e.cmd.Process.Pid)
	}
	e.mu.Unlock()
	s := EngineState{Supported: true, Elevated: windows.GetCurrentProcessToken().IsElevated(), Running: pid != 0, Message: NewMessage("bfeRunning").Error()}
	handle, err := windows.OpenSCManager(nil, nil, windows.SC_MANAGER_CONNECT)
	if err != nil {
		s.StatusError = err.Error()
	} else {
		m := &mgr.Mgr{Handle: handle}
		defer m.Disconnect()
		service, err := openReadOnlyService(m, serviceName)
		if err == nil {
			s.ServiceInstalled = true
			defer service.Close()
			status, err := service.Query()
			if err != nil {
				s.StatusError = err.Error()
			} else {
				s.ServiceRunning = status.State != svc.Stopped
			}
		} else if !errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) {
			s.StatusError = err.Error()
		}
		legacy, err := openReadOnlyService(m, "zapret")
		if err == nil {
			s.ForeignServiceInstalled = true
			legacy.Close()
		} else if !errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) {
			s.StatusError = err.Error()
		}
	}
	snapshot, err := windows.CreateToolhelp32Snapshot(windows.TH32CS_SNAPPROCESS, 0)
	if err == nil {
		defer windows.CloseHandle(snapshot)
		entry := windows.ProcessEntry32{Size: uint32(unsafe.Sizeof(windows.ProcessEntry32{}))}
		for err = windows.Process32First(snapshot, &entry); err == nil; err = windows.Process32Next(snapshot, &entry) {
			if strings.EqualFold(windows.UTF16ToString(entry.ExeFile[:]), "winws.exe") && entry.ProcessID != pid {
				s.ExternalRunning = true
			}
		}
	} else {
		s.StatusError = err.Error()
	}
	if s.Running || s.ServiceRunning {
		s.Message = NewMessage("bfeRunning").Error()
	}
	return s
}

func openReadOnlyService(m *mgr.Mgr, name string) (*mgr.Service, error) {
	p, err := windows.UTF16PtrFromString(name)
	if err != nil {
		return nil, err
	}
	h, err := windows.OpenService(m.Handle, p, windows.SERVICE_QUERY_STATUS)
	if err != nil {
		return nil, err
	}
	return &mgr.Service{Name: name, Handle: h}, nil
}

// A LocalSystem service must never point into a user-writable AppData tree.
func secureServiceCopy(source string) (string, error) {
	programData, err := windows.KnownFolderPath(windows.FOLDERID_ProgramData, 0)
	if err != nil {
		return "", err
	}
	dest := filepath.Join(programData, "GUIForZapret")
	if info, err := os.Lstat(dest); err == nil && (!info.IsDir() || info.Mode()&os.ModeSymlink != 0) {
		return "", NewMessageError("error037")
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	if err := os.MkdirAll(dest, 0700); err != nil {
		return "", err
	}
	sd, err := windows.SecurityDescriptorFromString("D:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;GRGX;;;BU)")
	if err != nil {
		return "", err
	}
	acl, _, err := sd.DACL()
	if err != nil {
		return "", err
	}
	owner, err := windows.CreateWellKnownSid(windows.WinBuiltinAdministratorsSid)
	if err != nil {
		return "", err
	}
	if err := windows.SetNamedSecurityInfo(dest, windows.SE_FILE_OBJECT, windows.OWNER_SECURITY_INFORMATION|windows.DACL_SECURITY_INFORMATION|windows.PROTECTED_DACL_SECURITY_INFORMATION, owner, nil, acl, nil); err != nil {
		return "", err
	}
	// Remove stale children after restricting access. The caller checked no service exists.
	entries, err := os.ReadDir(dest)
	if err != nil {
		return "", err
	}
	for _, entry := range entries {
		if err := os.RemoveAll(filepath.Join(dest, entry.Name())); err != nil {
			return "", err
		}
	}
	if err := CopyTree(source, dest); err != nil {
		return "", err
	}
	return dest, nil
}

func (e *windowsEngine) Start(root string, args []string, output io.Writer) error {
	if !windows.GetCurrentProcessToken().IsElevated() {
		return NewMessageError("error038")
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	if e.cmd != nil {
		return NewMessageError("error039")
	}
	cmd := exec.Command(filepath.Join(root, "bin", "winws.exe"), args...)
	cmd.Dir = filepath.Join(root, "bin")
	cmd.Stdout, cmd.Stderr = output, output
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	if err := cmd.Start(); err != nil {
		return err
	}
	e.cmd = cmd
	go func() {
		err := cmd.Wait()
		if err != nil {
			WriteMessage(output, NewMessage("winwsExited", fmt.Sprint(err)))
		} else {
			WriteMessage(output, NewMessage("winwsStopped"))
		}
		e.mu.Lock()
		if e.cmd == cmd {
			e.cmd = nil
		}
		e.mu.Unlock()
	}()
	return nil
}

// Stop targets only the child we started. Never taskkill by executable name.
func (e *windowsEngine) Stop() error {
	e.mu.Lock()
	cmd := e.cmd
	e.mu.Unlock()
	if cmd == nil {
		return nil
	}
	if err := cmd.Process.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) {
		return err
	}
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		e.mu.Lock()
		stopped := e.cmd != cmd
		e.mu.Unlock()
		if stopped {
			return nil
		}
		time.Sleep(25 * time.Millisecond)
	}
	return NewMessageError("error040")
}

func commandLine(args []string) string {
	parts := make([]string, len(args))
	for i, a := range args {
		parts[i] = syscall.EscapeArg(a)
	}
	return strings.Join(parts, " ")
}

func (e *windowsEngine) Service(action, root string, args []string) error {
	if !windows.GetCurrentProcessToken().IsElevated() {
		return NewMessageError("error041")
	}
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()
	if action == "install" {
		if existing, err := m.OpenService(serviceName); err == nil {
			existing.Close()
			return NewMessageError("error042")
		} else if !errors.Is(err, windows.ERROR_SERVICE_DOES_NOT_EXIST) {
			return err
		}
		secured, err := secureServiceCopy(root)
		if err != nil {
			return err
		}
		serviceArgs := append([]string{}, args...)
		for i, arg := range serviceArgs {
			serviceArgs[i] = strings.ReplaceAll(arg, root+string(os.PathSeparator), secured+string(os.PathSeparator))
		}
		s, err := m.CreateService(serviceName, filepath.Join(secured, "bin", "winws.exe"), mgr.Config{DisplayName: "zapret (GUI for zapret)", Description: "Runs zapret from a Flowseal build; managed by GUI for zapret", StartType: mgr.StartAutomatic}, serviceArgs...)
		if err != nil {
			return err
		}
		defer s.Close()
		return s.Start()
	}
	s, err := m.OpenService(serviceName)
	if err != nil {
		return err
	}
	defer s.Close()
	switch action {
	case "start":
		return s.Start()
	case "stop", "remove":
		status, err := s.Query()
		if err != nil {
			return err
		}
		if status.State != svc.Stopped {
			if _, err := s.Control(svc.Stop); err != nil {
				return err
			}
			deadline := time.Now().Add(10 * time.Second)
			for time.Now().Before(deadline) {
				status, err = s.Query()
				if err != nil {
					return err
				}
				if status.State == svc.Stopped {
					break
				}
				time.Sleep(100 * time.Millisecond)
			}
			if status.State != svc.Stopped {
				return NewMessageError("error043")
			}
		}
		if action == "remove" {
			return s.Delete()
		}
		return nil
	default:
		return NewMessageError("error044")
	}
}

func shellExecute(verb, file, params, dir string) error {
	var ptrs [4]*uint16
	for i, s := range []string{verb, file, params, dir} {
		p, err := windows.UTF16PtrFromString(s)
		if err != nil {
			return err
		}
		ptrs[i] = p
	}
	return windows.ShellExecute(0, ptrs[0], ptrs[1], ptrs[2], ptrs[3], windows.SW_SHOWNORMAL)
}

func (e *windowsEngine) OpenTool(root, tool string) error {
	switch tool {
	case "menu":
		return shellExecute("open", filepath.Join(root, "service.bat"), "", root)
	case "tests":
		return shellExecute("open", "powershell.exe", commandLine([]string{"-NoProfile", "-NoExit", "-File", filepath.Join(root, "utils", "test zapret.ps1")}), root)
	default:
		return NewMessageError("error045")
	}
}

func (e *windowsEngine) Elevate(dataDir string) error {
	if windows.GetCurrentProcessToken().IsElevated() {
		return nil
	}
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	// A replacement instance retries the OS lock while this GUI shuts down.
	return shellExecute("runas", exe, commandLine([]string{"--data-dir", dataDir, "--wait-lock"}), filepath.Dir(exe))
}

func query(exe string, args ...string) (string, error) {
	cmd := exec.Command(exe, args...)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	output, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(output)), err
}

func (e *windowsEngine) Diagnostics() []Check {
	checks := []Check{}
	handle, err := windows.OpenSCManager(nil, nil, windows.SC_MANAGER_CONNECT)
	if err != nil {
		return []Check{{Name: NewMessage("serviceManager").Error(), State: "error", Detail: err.Error()}}
	}
	m := &mgr.Mgr{Handle: handle}
	defer m.Disconnect()
	bfe, err := openReadOnlyService(m, "BFE")
	if err != nil {
		checks = append(checks, Check{"Base Filtering Engine", "error", err.Error()})
	} else {
		status, err := bfe.Query()
		bfe.Close()
		state, detail := "ok", NewMessage("bfeRunning").Error()
		if err != nil {
			state, detail = "error", err.Error()
		} else if status.State != svc.Running {
			state, detail = "error", NewMessage("bfeStopped").Error()
		}
		checks = append(checks, Check{"Base Filtering Engine", state, detail})
	}
	for _, name := range []string{"zapret", "GoodbyeDPI", "discordfix_zapret", "WinDivert", "WinDivert14", "winws1", "winws2"} {
		s, err := openReadOnlyService(m, name)
		if err != nil {
			continue
		}
		status, err := s.Query()
		s.Close()
		if err == nil && status.State == svc.Running {
			checks = append(checks, Check{name, "warning", NewMessage("conflict").Error()})
		}
	}
	if text, err := query("netsh.exe", "interface", "tcp", "show", "global"); err == nil {
		checks = append(checks, Check{"TCP / timestamps", "info", text})
	}
	if text, err := query("reg.exe", "query", `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`, "/v", "ProxyEnable"); err == nil {
		checks = append(checks, Check{NewMessage("proxy").Error(), "info", text})
	}
	checks = append(checks, Check{NewMessage("readOnly").Error(), "ok", NewMessage("diagnosticsReadOnly").Error()})
	return checks
}

func (*windowsEngine) ApplyHosts(preview string) error {
	if !windows.GetCurrentProcessToken().IsElevated() {
		return NewMessageError("error041")
	}
	if err := ValidateHosts([]byte(preview)); err != nil {
		return err
	}
	hosts := filepath.Join(os.Getenv("SystemRoot"), "System32", "drivers", "etc", "hosts")
	original, err := os.ReadFile(hosts)
	if err != nil {
		return err
	}
	merged, err := MergeHosts(string(original), preview)
	if err != nil {
		return err
	}
	// Backup stays next to the original, with the same elevated-access boundary.
	backup := hosts + ".zapret-desktop-" + time.Now().Format("20060102-150405.000000000") + ".bak"
	if err := AtomicWrite(backup, original); err != nil {
		return err
	}
	// Preserve the hosts file's existing ACL and attributes by writing it in place.
	if err := os.WriteFile(hosts, []byte(merged), 0644); err != nil {
		if restoreErr := os.WriteFile(hosts, original, 0644); restoreErr != nil {
			return NewMessageError("error046", fmt.Sprint(err), fmt.Sprint(restoreErr), fmt.Sprint(backup))
		}
		return err
	}
	return nil
}

func (*windowsEngine) ClearDiscordCache() (string, error) {
	var moved []string
	for _, edition := range []string{"discord", "discordptb", "discordcanary", "discorddevelopment"} {
		for _, cache := range []string{"Cache", "Code Cache", "GPUCache"} {
			p := filepath.Join(os.Getenv("APPDATA"), edition, cache)
			if _, err := os.Stat(p); errors.Is(err, os.ErrNotExist) {
				continue
			} else if err != nil {
				return strings.Join(moved, "\n"), err
			}
			backup := p + ".zapret-desktop-" + time.Now().Format("20060102-150405.000000000")
			if err := os.Rename(p, backup); err != nil {
				return strings.Join(moved, "\n"), NewMessageError("error047", fmt.Sprint(err))
			}
			moved = append(moved, backup)
		}
	}
	if len(moved) == 0 {
		return NewMessage("cacheMissing").Error(), nil
	}
	return NewMessage("cacheMoved", strings.Join(moved, "\n")).Error(), nil
}

func AcquireLock(root string) (func(), error) {
	// Root is intentionally not part of the name: only one controller per session.
	name, err := windows.UTF16PtrFromString(`Local\rrabmig.ZapretDesktop`)
	if err != nil {
		return nil, err
	}
	h, err := windows.CreateMutex(nil, false, name)
	if errors.Is(err, windows.ERROR_ALREADY_EXISTS) {
		if h != 0 {
			windows.CloseHandle(h)
		}
		return nil, NewMessageError("error036")
	}
	if err != nil {
		return nil, err
	}
	return func() { windows.CloseHandle(h) }, nil
}
