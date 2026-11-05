package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"time"

	"github.com/rrabmig/zapret-gui/internal/core"
)

// Narrow dependencies at the application boundary; no OS or HTTP implementation
// is required to exercise cancellation, shutdown or updater interlocks.
type packageSource interface {
	Latest(context.Context) (core.Release, error)
	Install(context.Context, string, core.Release) error
	FetchData(context.Context, string) ([]byte, error)
}
type guiSource interface {
	Check(context.Context, string, string, string) (core.GUIUpdate, error)
	Download(context.Context, string, string, core.GUIUpdate) (core.GUIUpdate, error)
}
type operation struct{ cancel context.CancelFunc }
type work func(context.Context) (func() error, error)

func isOperation(name string) bool {
	switch name {
	case "check-updates", "check-gui-update", "download-version", "download-gui-update", "update-ipset", "preview-hosts", "diagnostics":
		return true
	}
	return false
}
func (a *App) runOperation(name string) (Snapshot, error) {
	a.mu.Lock()
	if a.closed {
		a.mu.Unlock()
		return Snapshot{}, context.Canceled
	}
	if a.updating || a.operation != nil {
		a.mu.Unlock()
		return Snapshot{}, core.NewMessageError("operationBusy")
	}
	task, err := a.prepareOperation(name)
	if err != nil {
		a.journal.AddError(err)
		a.mu.Unlock()
		return Snapshot{}, err
	}
	ctx, cancel := context.WithTimeout(a.ctx, 2*time.Minute)
	op := &operation{cancel: cancel}
	a.operation = op
	a.mu.Unlock()
	commit, err := task(ctx)
	if err == nil {
		err = ctx.Err()
	}
	cancel()
	a.mu.Lock()
	defer a.mu.Unlock()
	a.operation = nil
	if a.closed {
		return Snapshot{}, context.Canceled
	}
	if err == nil {
		err = commit()
	}
	if err != nil {
		if errors.Is(err, context.Canceled) {
			err = core.NewMessageError("operationCancelled")
		}
		a.journal.AddError(err)
		return Snapshot{}, err
	}
	return a.snapshot()
}
func (a *App) prepareOperation(name string) (work, error) {
	switch name {
	case "check-updates":
		return func(ctx context.Context) (func() error, error) {
			r, err := a.updater.Latest(ctx)
			return func() error {
				a.latest = &r
				a.lastCheck = time.Now().Format(time.RFC3339)
				a.journal.AddMessage(core.NewMessage("release", r.Tag))
				return nil
			}, err
		}, nil
	case "check-gui-update":
		return func(ctx context.Context) (func() error, error) {
			next, err := a.guiUpdater.Check(ctx, Version, runtime.GOOS, runtime.GOARCH)
			return func() error { a.setGUIUpdate(next); return nil }, err
		}, nil
	case "download-gui-update":
		if runtime.GOOS != "windows" || runtime.GOARCH != "amd64" {
			return nil, core.NewMessageError("guiUpdateManual")
		}
		state := a.guiUpdate
		return func(ctx context.Context) (func() error, error) {
			next, err := a.guiUpdater.Download(ctx, a.root, Version, state)
			return func() error { a.guiUpdate = next; return nil }, err
		}, nil
	case "download-version":
		if err := a.idle(); err != nil {
			return nil, err
		}
		var release *core.Release
		if a.latest != nil {
			copy := *a.latest
			release = &copy
		}
		return func(ctx context.Context) (func() error, error) {
			if release == nil {
				r, err := a.updater.Latest(ctx)
				if err != nil {
					return nil, err
				}
				release = &r
			}
			if _, err := os.Stat(filepath.Join(a.versionsDir, release.Tag)); errors.Is(err, os.ErrNotExist) {
				if err = a.updater.Install(ctx, a.versionsDir, *release); err != nil {
					return nil, err
				}
			} else if err != nil {
				return nil, err
			}
			return func() error {
				a.latest = release
				a.journal.AddMessage(core.NewMessage("downloaded", release.Tag))
				return nil
			}, nil
		}, nil
	case "update-ipset":
		if err := a.idle(); err != nil {
			return nil, err
		}
		return func(ctx context.Context) (func() error, error) {
			b, err := a.updater.FetchData(ctx, "ipset-service.txt")
			if err != nil {
				return nil, err
			}
			if err = core.ValidateList("ipset-service.txt", b); err != nil {
				return nil, err
			}
			if err = core.AtomicWrite(filepath.Join(a.root, "overrides", "ipset-service.txt"), b); err != nil {
				return nil, err
			}
			return func() error { a.journal.AddMessage(core.NewMessage("ipsetUpdated")); return nil }, nil
		}, nil
	case "preview-hosts":
		return func(ctx context.Context) (func() error, error) {
			b, err := a.updater.FetchData(ctx, "hosts")
			if err != nil {
				return nil, err
			}
			if err = core.ValidateHosts(b); err != nil {
				return nil, err
			}
			return func() error { a.hostsPreview = string(b); return nil }, nil
		}, nil
	case "diagnostics":
		return func(ctx context.Context) (func() error, error) {
			checks := a.engine.Diagnostics(ctx)
			return func() error { a.checks = checks; return nil }, ctx.Err()
		}, nil
	}
	return nil, core.NewMessageError("error012")
}
