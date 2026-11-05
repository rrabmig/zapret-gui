//go:build bindings

package main

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/rrabmig/zapret-gui/internal/core"
)

type inertEngine struct {
	core.Engine
	state core.EngineState
}

func (e *inertEngine) State() core.EngineState { return e.state }
func (e *inertEngine) Start(string, []string, io.Writer) error {
	panic("engine must never be started by version operations")
}
func appVersion(t *testing.T, dir, tag string) {
	t.Helper()
	b, _ := json.Marshal(core.Release{Tag: tag})
	for name, value := range map[string]string{
		"release.json": string(b), "service.bat": "inert", "general.bat": "start \"zapret\" /min \"%BIN%winws.exe\" --wf-tcp=443\n",
		"bin/winws.exe": "inert", "lists/list-general.txt": "example.org", "utils/test zapret.ps1": "# inert",
	} {
		if err := core.AtomicWrite(filepath.Join(dir, tag, filepath.FromSlash(name)), []byte(value)); err != nil {
			t.Fatal(err)
		}
	}
}
func TestVersionActionsDoNotActivateDownloadsOrRunEngine(t *testing.T) {
	data, versions := t.TempDir(), t.TempDir()
	app, err := NewApp(data, versions)
	if err != nil {
		t.Fatal(err)
	}
	defer app.journal.Close()
	app.engine = &inertEngine{}
	appVersion(t, versions, "1.0.0")
	appVersion(t, versions, "2.0.0")
	app.latest = &core.Release{Tag: "2.0.0"}
	if err := app.action("activate", "1.0.0"); err != nil {
		t.Fatal(err)
	}
	if err := app.action("download-version", ""); err != nil {
		t.Fatal(err)
	}
	if app.config.Active != "1.0.0" || app.config.Previous != "" {
		t.Fatal("download switched active version")
	}
	if err := app.action("delete-version", "1.0.0"); err == nil {
		t.Fatal("deleted active version")
	}
	if err := app.action("activate", "2.0.0"); err != nil {
		t.Fatal(err)
	}
	if err := app.action("rollback", ""); err != nil {
		t.Fatal(err)
	}
	if app.config.Active != "1.0.0" || app.config.Previous != "2.0.0" {
		t.Fatal("rollback failed")
	}
	if err := app.action("delete-version", "2.0.0"); err != nil {
		t.Fatal(err)
	}
	if app.config.Previous != "" {
		t.Fatal("dangling rollback pointer")
	}
	if _, err := os.Stat(filepath.Join(versions, "2.0.0")); !os.IsNotExist(err) {
		t.Fatal("version not removed")
	}
}
func TestVersionChangesRespectEveryInterlock(t *testing.T) {
	app, err := NewApp(t.TempDir(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer app.journal.Close()
	for _, state := range []core.EngineState{
		{Running: true}, {ServiceRunning: true}, {ServiceInstalled: true}, {ExternalRunning: true}, {ForeignServiceInstalled: true}, {StatusError: "fixture"},
	} {
		app.engine = &inertEngine{state: state}
		for _, action := range []string{"activate", "rollback", "download-version", "delete-version"} {
			if err := app.action(action, "1.0.0"); err == nil {
				t.Fatalf("%s ignored %+v", action, state)
			}
		}
	}
	app.engine = &inertEngine{}
	app.toolSession = true
	if err := app.action("activate", "1.0.0"); err == nil {
		t.Fatal("ignored upstream session")
	}
}

func TestSnapshotRemainsUsableWhenSelectedVersionIsDamaged(t *testing.T) {
	app, err := NewApp(t.TempDir(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer app.journal.Close()
	app.engine = &inertEngine{}
	appVersion(t, app.versionsDir, "1.0.0")
	if err := app.action("activate", "1.0.0"); err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(app.versionsDir, "1.0.0", "bin", "winws.exe")); err != nil {
		t.Fatal(err)
	}
	snapshot, err := app.snapshot()
	if err != nil || len(snapshot.Versions) != 1 || snapshot.Versions[0].Problem == "" || len(snapshot.Strategies) != 0 {
		t.Fatalf("cannot recover using the catalog: %+v, %v", snapshot, err)
	}
}

func TestGUIUpdateInterlocksDoNotRequireRemovingAService(t *testing.T) {
	app, err := NewApp(t.TempDir(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer app.journal.Close()
	for _, state := range []core.EngineState{{Elevated: true}, {ExternalRunning: true}, {StatusError: "fixture"}} {
		app.engine = &inertEngine{state: state}
		if err := app.action("apply-gui-update", ""); err == nil {
			t.Fatalf("ignored interlock %+v", state)
		}
	}
	app.engine = &inertEngine{}
	app.toolSession = true
	if err := app.action("apply-gui-update", ""); err == nil {
		t.Fatal("ignored tools")
	}
	app.toolSession = false
	if err := app.action("apply-gui-update", ""); err == nil {
		t.Fatal("allowed missing download")
	}
	// GUI-only settings remain writable while the own service is installed.
	app.engine = &inertEngine{state: core.EngineState{ServiceInstalled: true, ServiceRunning: true}}
	c := app.config
	c.GUIAutoCheck = true
	payload, _ := json.Marshal(c)
	if err := app.action("settings", string(payload)); err != nil {
		t.Fatal(err)
	}
	if !app.config.GUIAutoCheck {
		t.Fatal("GUI check preference lost")
	}
}
