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
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/rrabmig/zapret-desktop/internal/core"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

type Snapshot struct {
	Version     string           `json:"version"`
	OS          string           `json:"os"`
	Arch        string           `json:"arch"`
	DataDir     string           `json:"dataDir"`
	Config      core.Config      `json:"config"`
	Engine      core.EngineState `json:"engine"`
	Strategies  []core.Strategy  `json:"strategies"`
	Packages    []string         `json:"packages"`
	Fakes       []string         `json:"fakes"`
	Logs        []string         `json:"logs"`
	Checks      []core.Check     `json:"checks"`
	Latest      *core.Release    `json:"latest"`
	LastCheck   string           `json:"lastCheck"`
	ToolSession bool             `json:"toolSession"`
}

type App struct {
	mu           sync.Mutex
	ctx          context.Context
	root         string
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

func NewApp(root string) (*App, error) {
	c, err := core.LoadConfig(root)
	if err != nil {
		return nil, err
	}
	j, err := core.NewJournal(root)
	if err != nil {
		return nil, err
	}
	a := &App{root: root, config: c, engine: core.NewEngine(), updater: core.NewUpdater(), journal: j, checks: []core.Check{}}
	j.Add("Zapret Desktop " + Version + "; automatic engine startup is disabled")
	return a, nil
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	// AutoCheck is opt-in and only fetches release metadata. Never auto-install.
	if a.config.AutoCheck {
		go func() {
			a.mu.Lock()
			defer a.mu.Unlock()
			if a.closed {
				return
			}
			if err := a.checkUpdates(); err != nil {
				a.journal.Add(err.Error())
			}
		}()
	}
}

func (a *App) shutdown(context.Context) {
	a.mu.Lock()
	defer a.mu.Unlock()
	a.closed = true
	if err := a.engine.Stop(); err != nil {
		a.journal.Add("Shutdown: " + err.Error())
	}
	a.journal.Close()
}

func (a *App) Snapshot() (Snapshot, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.snapshot()
}

func (a *App) snapshot() (Snapshot, error) {
	s := Snapshot{Version: Version, OS: runtime.GOOS, Arch: runtime.GOARCH, DataDir: a.root, Config: a.config, Engine: a.engine.State(), Logs: a.journal.Lines(), Checks: a.checks, Latest: a.latest, LastCheck: a.lastCheck, ToolSession: a.toolSession, Packages: []string{}, Strategies: []core.Strategy{}, Fakes: []string{}}
	entries, err := os.ReadDir(filepath.Join(a.root, "packages"))
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return s, err
	}
	for _, entry := range entries {
		if entry.IsDir() && !strings.HasPrefix(entry.Name(), ".") {
			s.Packages = append(s.Packages, entry.Name())
		}
	}
	sort.Sort(sort.Reverse(sort.StringSlice(s.Packages)))
	if a.config.Active != "" {
		base := filepath.Join(a.root, "packages", a.config.Active)
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
		return errors.New("запуск движка и системные действия выключены; включите их в настройках")
	}
	s := a.engine.State()
	if !s.Supported {
		return errors.New(s.Message)
	}
	if s.StatusError != "" {
		return fmt.Errorf("не удалось прочитать состояние движка: %s", s.StatusError)
	}
	return nil
}

func (a *App) idle() error {
	s := a.engine.State()
	if s.StatusError != "" {
		return errors.New("статус движка неизвестен: " + s.StatusError)
	}
	if s.Running || s.ServiceRunning || s.ExternalRunning || s.ServiceInstalled || s.ForeignServiceInstalled || a.toolSession {
		return errors.New("сначала остановите движок, удалите службу автозапуска и завершите оригинальные утилиты; файлы работающего движка не меняются")
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
	root, err := core.PrepareRuntime(a.root, a.config)
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
	a.journal.Add("Official stable release: " + r.Tag)
	return nil
}

func (a *App) activate(tag string) error {
	if err := a.idle(); err != nil {
		return err
	}
	c := a.config
	c.Active = tag
	c.Previous = a.config.Active
	if err := c.Validate(); err != nil {
		return err
	}
	if tag == "" {
		return errors.New("нет версии для отката")
	}
	if tag == a.config.Active {
		return nil
	}
	strategies, err := core.Strategies(filepath.Join(a.root, "packages", tag), c)
	if err != nil {
		return err
	}
	found := false
	for _, s := range strategies {
		if s.Name == c.Strategy {
			found = true
		}
	}
	if !found {
		c.Strategy = ""
		for _, s := range strategies {
			c.Strategy = s.Name
			if s.Compatible {
				break
			}
		}
		if c.Strategy == "" {
			return errors.New("в релизе не найдены стратегии")
		}
	}
	// Fake names can disappear between releases. Use the upstream default then.
	for _, p := range []*string{&c.DiscordFake, &c.GameFake} {
		if *p != "" {
			if _, err := os.Stat(filepath.Join(a.root, "packages", tag, "bin", *p)); err != nil {
				*p = ""
			}
		}
	}
	if err := core.SaveConfig(a.root, c); err != nil {
		return err
	}
	a.config = c
	a.journal.Add("Active package: " + tag + "; engine has not been started")
	return nil
}

// Action is the allowlisted GUI bridge. Payloads never become shell commands.
func (a *App) Action(action, payload string) (Snapshot, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	err := a.action(action, payload)
	if err != nil {
		a.journal.Add(action + ": " + err.Error())
		return Snapshot{}, err
	}
	return a.snapshot()
}

func (a *App) action(action, payload string) error {
	switch action {
	case "check-updates":
		return a.checkUpdates()
	case "install-update":
		if err := a.idle(); err != nil {
			return err
		}
		if a.latest == nil {
			if err := a.checkUpdates(); err != nil {
				return err
			}
		}
		if _, err := os.Stat(filepath.Join(a.root, "packages", a.latest.Tag)); errors.Is(err, os.ErrNotExist) {
			if err := a.updater.Install(a.ctx, a.root, *a.latest); err != nil {
				return err
			}
		} else if err != nil {
			return err
		}
		return a.activate(a.latest.Tag)
	case "activate":
		return a.activate(payload)
	case "rollback":
		return a.activate(a.config.Previous)
	case "settings":
		var c core.Config
		if err := json.Unmarshal([]byte(payload), &c); err != nil {
			return err
		}
		c.Active, c.Previous, c.Schema = a.config.Active, a.config.Previous, 1
		if err := c.Validate(); err != nil {
			return err
		}
		before, after := a.config, c
		before.Theme, before.AutoCheck, before.EngineAllowed = after.Theme, after.AutoCheck, after.EngineAllowed
		if !reflect.DeepEqual(before, after) {
			if err := a.idle(); err != nil {
				return err
			}
		}
		if c.Active != "" {
			if c.Strategy != a.config.Strategy {
				if _, err := core.StrategyArgs(filepath.Join(a.root, "packages", c.Active), c.Strategy, c); err != nil {
					return err
				}
			}
			for _, name := range []string{c.DiscordFake, c.GameFake} {
				if name == "" {
					continue
				}
				if !strings.HasSuffix(name, ".bin") {
					return errors.New("invalid fake file")
				}
				if _, err := os.Stat(filepath.Join(a.root, "packages", c.Active, "bin", name)); err != nil {
					return err
				}
			}
		}
		if err := core.SaveConfig(a.root, c); err != nil {
			return err
		}
		a.config = c
		a.journal.Add("Settings saved; engine has not been started")
		return nil
	case "start":
		root, args, err := a.prepared()
		if err != nil {
			return err
		}
		if err := a.engine.Start(root, args, a.journal); err != nil {
			return err
		}
		a.journal.Add("Started " + a.config.Strategy)
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
			return errors.New("сначала завершите оригинальные утилиты")
		}
		if action == "service-start" {
			s := a.engine.State()
			if s.Running || s.ExternalRunning || s.ForeignServiceInstalled {
				return errors.New("обнаружен другой движок или служба zapret; запуск службы отменён")
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
		root, err := core.PrepareRuntime(a.root, a.config)
		if err != nil {
			return err
		}
		if err := a.engine.OpenTool(root, action); err != nil {
			return err
		}
		a.toolSession = true
		a.journal.Add("Opened upstream " + action + "; managed file changes are locked until the tool session ends")
		return nil
	case "tools-finished":
		s := a.engine.State()
		if s.ExternalRunning {
			return errors.New("winws.exe ещё работает; завершите его через оригинальную утилиту")
		}
		a.toolSession = false
		return nil
	case "elevate":
		if err := a.enginePermission(); err != nil {
			return err
		}
		if a.engine.State().Running || a.toolSession {
			return errors.New("остановите процесс GUI и завершите оригинальные утилиты перед перезапуском")
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
		a.journal.Add("IPSet updated; user additions preserved")
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
			return errors.New("сначала загрузите и просмотрите изменения hosts")
		}
		if err := a.engine.ApplyHosts(a.hostsPreview); err != nil {
			return err
		}
		a.journal.Add("Hosts block applied; backup saved next to the hosts file")
		return nil
	case "clear-discord-cache":
		if err := a.enginePermission(); err != nil {
			return err
		}
		message, err := a.engine.ClearDiscordCache()
		if message != "" {
			a.journal.Add(message)
		}
		return err
	default:
		return errors.New("unknown GUI action")
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
	a.journal.Add("Saved user list: " + name)
	return nil
}
