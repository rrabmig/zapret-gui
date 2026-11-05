package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/rrabmig/zapret-gui/internal/core"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type Snapshot struct {
	GUIUpdate   core.GUIUpdate          `json:"guiUpdate"`
	Version     string                  `json:"version"`
	OS          string                  `json:"os"`
	Arch        string                  `json:"arch"`
	DataDir     string                  `json:"dataDir"`
	Config      core.Config             `json:"config"`
	Engine      core.EngineState        `json:"engine"`
	Strategies  []core.Strategy         `json:"strategies"`
	Versions    []core.InstalledVersion `json:"versions"`
	VersionsDir string                  `json:"versionsDir"`
	Fakes       []string                `json:"fakes"`
	Logs        []core.LogEntry         `json:"logs"`
	Checks      []core.Check            `json:"checks"`
	Latest      *core.Release           `json:"latest"`
	LastCheck   string                  `json:"lastCheck"`
	ToolSession bool                    `json:"toolSession"`
}

type App struct {
	guiUpdater   *core.GUIUpdater
	guiUpdate    core.GUIUpdate
	updating     bool
	mu           sync.Mutex
	ctx          context.Context
	root         string
	versionsDir  string
	config       core.Config
	engine       core.Engine
	updater      *core.Updater
	journal      *core.Journal
	latest       *core.Release
	lastCheck    string
	checks       []core.Check
	toolSession  bool
	hostsPreview string
	closed       bool
}

func NewApp(root, versionsDir string) (*App, error) {
	c, err := core.LoadConfig(root)
	if err != nil {
		return nil, err
	}
	j, err := core.NewJournal(root)
	if err != nil {
		return nil, err
	}
	a := &App{root: root, versionsDir: versionsDir, config: c, engine: core.NewEngine(), updater: core.NewUpdater(), guiUpdater: core.NewGUIUpdater(), journal: j, checks: []core.Check{}}
	j.AddMessage(core.NewMessage("startup", Version))
	return a, nil
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// AutoCheck is opt-in and only fetches release metadata. Never auto-install.
	if a.config.AutoCheck || a.config.GUIAutoCheck {
		go func() {
			a.mu.Lock()
			defer a.mu.Unlock()
			if a.closed {
				return
			}
			if a.config.AutoCheck {
				if err := a.checkUpdates(); err != nil {
					a.journal.AddError(err)
				}
			}
			if a.config.GUIAutoCheck {
				if err := a.checkGUIUpdates(); err != nil {
					a.journal.AddError(err)
				}
			}
		}()
	}
}

func (a *App) shutdown(context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.closed = true
	if err := a.engine.Stop(); err != nil {
		a.journal.AddError(err)
	}
	a.journal.Close()
}

func (a *App) Snapshot() (Snapshot, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.snapshot()
}

func (a *App) snapshot() (Snapshot, error) {
	s := Snapshot{GUIUpdate: a.guiUpdate, Version: Version, OS: runtime.GOOS, Arch: runtime.GOARCH, DataDir: a.root, Config: a.config, Engine: a.engine.State(), Logs: a.journal.Lines(), Checks: a.checks, Latest: a.latest, LastCheck: a.lastCheck, ToolSession: a.toolSession, Versions: []core.InstalledVersion{}, VersionsDir: a.versionsDir, Strategies: []core.Strategy{}, Fakes: []string{}}
	versions, err := core.ListVersions(a.versionsDir, a.config)
	if err != nil {
		return s, err
	}
	s.Versions = versions
	activeReady := false
	for _, v := range versions {
		if v.Tag == a.config.Active && v.Problem == "" {
			activeReady = true
			break
		}
	}
	// Keep the catalog usable when a selected package was damaged or removed.
	if activeReady {
		base := filepath.Join(a.versionsDir, a.config.Active)
		s.Strategies, err = core.Strategies(base, a.config)
		if err != nil {
			return s, err
		}
		bins, err := os.ReadDir(filepath.Join(base, "bin"))
		if err != nil {
			return s, err
		}
		for _, entry := range bins {
			if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".bin") && !strings.HasPrefix(entry.Name(), "ACTIVE_") {
				s.Fakes = append(s.Fakes, entry.Name())
			}
		}
	}
	return s, nil
}

func (a *App) enginePermission() error {
	if !a.config.EngineAllowed {
		return core.NewMessageError("error001")
	}
	s := a.engine.State()
	if !s.Supported {
		return errors.New(s.Message)
	}
	if s.StatusError != "" {
		return core.NewMessageError("error002", fmt.Sprint(s.StatusError))
	}
	return nil
}

func (a *App) idle() error {
	s := a.engine.State()
	if s.StatusError != "" {
		return core.NewMessageError("error002", s.StatusError)
	}
	if s.Running || s.ServiceRunning || s.ExternalRunning || s.ServiceInstalled || s.ForeignServiceInstalled || a.toolSession {
		return core.NewMessageError("error003")
	}
	return nil
}

func (a *App) prepared() (string, []string, error) {
	if err := a.enginePermission(); err != nil {
		return "", nil, err
	}
	if err := a.idle(); err != nil {
		return "", nil, err
	}
	root, err := core.PrepareRuntime(a.root, a.versionsDir, a.config)
	if err != nil {
		return "", nil, err
	}
	args, err := core.StrategyArgs(root, a.config.Strategy, a.config)
	return root, args, err
}

func (a *App) checkUpdates() error {
	r, err := a.updater.Latest(a.ctx)
	if err != nil {
		return err
	}
	a.latest = &r
	a.lastCheck = time.Now().Format(time.RFC3339)
	a.journal.AddMessage(core.NewMessage("release", r.Tag))
	return nil
}

func (a *App) activate(tag string) error {
	if err := a.idle(); err != nil {
		return err
	}
	if tag == a.config.Active {
		return nil
	}
	c, err := core.SelectVersion(a.versionsDir, tag, a.config)
	if err != nil {
		return err
	}
	if err := core.SaveConfig(a.root, c); err != nil {
		return err
	}
	a.config = c
	a.journal.AddMessage(core.NewMessage("activated", tag))
	return nil
}

// Action is the allowlisted GUI bridge. Payloads never become shell commands.
func (a *App) Action(action, payload string) (Snapshot, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	err := a.action(action, payload)
	if err != nil {
		a.journal.AddError(err)
		return Snapshot{}, err
	}
	return a.snapshot()
}

func (a *App) action(action, payload string) error {
	if a.updating {
		return core.NewMessageError("guiUpdateInProgress")
	}
	switch action {
	case "check-gui-update":
		return a.checkGUIUpdates()
	case "download-gui-update":
		if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" {
			return core.NewMessageError("guiUpdateManual")
		}
		next, err := a.guiUpdater.Download(a.ctx, a.root, Version, a.guiUpdate)
		if err != nil {
			return err
		}
		a.guiUpdate = next
		return nil
	case "apply-gui-update":
		s := a.engine.State()
		if s.StatusError != "" || s.ExternalRunning || a.toolSession {
			return core.NewMessageError("guiUpdateCloseTools")
		}
		if s.Elevated {
			return core.NewMessageError("guiUpdateUnelevated")
		}
		if !a.guiUpdate.Available || !a.guiUpdate.Ready {
			return core.NewMessageError("guiUpdateInvalid")
		}
		// Stop only the child owned by this GUI. A protected service stays running.
		if err := a.engine.Stop(); err != nil {
			return err
		}
		if err := core.StartGUIUpdate(a.root, a.guiUpdate, a.config.Language); err != nil {
			return err
		}
		a.updating = true
		go wailsruntime.Quit(a.ctx)
		return nil
	case "language":
		c := a.config
		c.Language = core.NormalizeLanguage(payload)
		if err := core.SaveConfig(a.root, c); err != nil {
			return err
		}
		a.config = c
		return nil
	case "check-updates":
		return a.checkUpdates()
	case "download-version":
		if err := a.idle(); err != nil {
			return err
		}
		if a.latest == nil {
			if err := a.checkUpdates(); err != nil {
				return err
			}
		}
		if _, err := os.Stat(filepath.Join(a.versionsDir, a.latest.Tag)); errors.Is(err, os.ErrNotExist) {
			if err := a.updater.Install(a.ctx, a.versionsDir, *a.latest); err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		a.journal.AddMessage(core.NewMessage("downloaded", a.latest.Tag))
		return nil
	case "open-versions":
		if err := os.MkdirAll(a.versionsDir, 0700); err != nil {
			return err
		}
		return core.OpenDirectory(a.versionsDir)
	case "delete-version":
		if err := a.idle(); err != nil {
			return err
		}
		if payload == a.config.Active {
			return core.NewMessageError("versionInUse")
		}
		// Clear the rollback pointer first, so interruption cannot leave it dangling.
		if payload == a.config.Previous {
			c := a.config
			c.Previous = ""
			if err := core.SaveConfig(a.root, c); err != nil {
				return err
			}
			a.config = c
		}
		if err := core.DeleteVersion(a.versionsDir, payload); err != nil {
			return err
		}
		a.journal.AddMessage(core.NewMessage("versionDeleted", payload))
		return nil
	case "activate":
		return a.activate(payload)
	case "rollback":
		return a.activate(a.config.Previous)
	case "settings":
		var c core.Config
		if err := json.Unmarshal([]byte(payload), &c); err != nil {
			return err
		}
		c.Language = a.config.Language
		c.Active, c.Previous, c.Schema = a.config.Active, a.config.Previous, 1
		if err := c.Validate(); err != nil {
			return err
		}
		before, after := a.config, c
		before.Theme, before.AutoCheck, before.EngineAllowed, before.GUIAutoCheck = after.Theme, after.AutoCheck, after.EngineAllowed, after.GUIAutoCheck
		if !reflect.DeepEqual(before, after) {
			if err := a.idle(); err != nil {
				return err
			}
		}
		if c.Active != "" {
			if c.Strategy != a.config.Strategy {
				if _, err := core.StrategyArgs(filepath.Join(a.versionsDir, c.Active), c.Strategy, c); err != nil {
					return err
				}
			}
			for _, name := range []string{c.DiscordFake, c.GameFake} {
				if name == "" {
					continue
				}
				if !strings.HasSuffix(name, ".bin") {
					return core.NewMessageError("error006")
				}
				if _, err := os.Stat(filepath.Join(a.versionsDir, c.Active, "bin", name)); err != nil {
					return err
				}
			}
		}
		if err := core.SaveConfig(a.root, c); err != nil {
			return err
		}
		a.config = c
		a.journal.AddMessage(core.NewMessage("settingsSaved"))
		return nil
	case "start":
		root, args, err := a.prepared()
		if err != nil {
			return err
		}
		if err := a.engine.Start(root, args, a.journal); err != nil {
			return err
		}
		a.journal.AddMessage(core.NewMessage("started", a.config.Strategy))
		return nil
	case "stop":
		// Stopping our own process is always permitted, including in inspection mode.
		return a.engine.Stop()
	case "service-install":
		root, args, err := a.prepared()
		if err != nil {
			return err
		}
		return a.engine.Service("install", root, args)
	case "service-start", "service-stop", "service-remove":
		if err := a.enginePermission(); err != nil {
			return err
		}
		if a.toolSession {
			return core.NewMessageError("error007")
		}
		if action == "service-start" {
			s := a.engine.State()
			if s.Running || s.ExternalRunning || s.ForeignServiceInstalled {
				return core.NewMessageError("error008")
			}
		}
		return a.engine.Service(strings.TrimPrefix(action, "service-"), "", nil)
	case "menu", "tests":
		if err := a.enginePermission(); err != nil {
			return err
		}
		if err := a.idle(); err != nil {
			return err
		}
		// Unlike normal start, the original menu remains usable if parser compatibility changes.
		root, err := core.PrepareRuntime(a.root, a.versionsDir, a.config)
		if err != nil {
			return err
		}
		if err := a.engine.OpenTool(root, action); err != nil {
			return err
		}
		a.toolSession = true
		a.journal.AddMessage(core.NewMessage("openedTool", action))
		return nil
	case "tools-finished":
		s := a.engine.State()
		if s.ExternalRunning {
			return core.NewMessageError("error009")
		}
		a.toolSession = false
		return nil
	case "elevate":
		if err := a.enginePermission(); err != nil {
			return err
		}
		if a.engine.State().Running || a.toolSession {
			return core.NewMessageError("error010")
		}
		if err := a.engine.Elevate(a.root); err != nil {
			return err
		}
		go wailsruntime.Quit(a.ctx)
		return nil
	case "diagnostics":
		a.checks = a.engine.Diagnostics()
		return nil
	case "update-ipset":
		if err := a.idle(); err != nil {
			return err
		}
		b, err := a.updater.FetchData(a.ctx, "ipset-service.txt")
		if err != nil {
			return err
		}
		if err := core.ValidateList("ipset-service.txt", b); err != nil {
			return err
		}
		if err := core.AtomicWrite(filepath.Join(a.root, "overrides", "ipset-service.txt"), b); err != nil {
			return err
		}
		a.journal.AddMessage(core.NewMessage("ipsetUpdated"))
		return nil
	case "preview-hosts":
		b, err := a.updater.FetchData(a.ctx, "hosts")
		if err != nil {
			return err
		}
		if err := core.ValidateHosts(b); err != nil {
			return err
		}
		a.hostsPreview = string(b)
		return nil
	case "apply-hosts":
		if err := a.enginePermission(); err != nil {
			return err
		}
		if a.hostsPreview == "" {
			return core.NewMessageError("error011")
		}
		if err := a.engine.ApplyHosts(a.hostsPreview); err != nil {
			return err
		}
		a.journal.AddMessage(core.NewMessage("hostsApplied"))
		return nil
	case "clear-discord-cache":
		if err := a.enginePermission(); err != nil {
			return err
		}
		message, err := a.engine.ClearDiscordCache()
		if message != "" {
			// ClearDiscordCache returns an owned message or raw backup paths.
			var event core.Message
			if json.Unmarshal([]byte(message), &event) == nil && event.Code != "" {
				a.journal.AddMessage(event)
			} else {
				a.journal.Add(message)
			}
		}
		return err
	default:
		return core.NewMessageError("error012")
	}
}

func (a *App) ReadList(name string) (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if name == "hosts-preview" {
		return a.hostsPreview, nil
	}
	return core.ReadList(a.root, name)
}

func (a *App) SaveList(name, content string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := a.idle(); err != nil {
		return err
	}
	if err := core.WriteList(a.root, name, content); err != nil {
		return err
	}
	a.journal.AddMessage(core.NewMessage("listSaved", name))
	return nil
}

func (a *App) checkGUIUpdates() error {
	next, err := a.guiUpdater.Check(a.ctx, Version, runtime.GOOS, runtime.GOARCH)
	if err != nil {
		return err
	}
	// Keep a verified download across metadata refreshes for the same asset.
	if a.guiUpdate.Ready && a.guiUpdate.Tag == next.Tag && a.guiUpdate.Asset == next.Asset {
		next.Ready = true
		next.Installer = a.guiUpdate.Installer
	}
	a.guiUpdate = next
	return nil
}
