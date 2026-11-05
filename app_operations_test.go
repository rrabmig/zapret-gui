//go:build bindings

package main

import (
	"context"
	"github.com/rrabmig/zapret-gui/internal/core"
	"testing"
	"time"
)

type blockingEngine struct {
	core.Engine
	entered chan struct{}
	stopped chan struct{}
}

func (e *blockingEngine) State() core.EngineState {
	return core.EngineState{Supported: true, Running: true}
}
func (e *blockingEngine) Stop() error {
	select {
	case e.stopped <- struct{}{}:
	default:
	}
	return nil
}
func (e *blockingEngine) Diagnostics(ctx context.Context) []core.Check {
	close(e.entered)
	<-ctx.Done()
	return nil
}
func TestStopAndSnapshotDoNotWaitForDiagnostics(t *testing.T) {
	app, err := NewApp(t.TempDir(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	e := &blockingEngine{entered: make(chan struct{}), stopped: make(chan struct{}, 1)}
	app.engine = e
	defer app.shutdown(context.Background())
	done := make(chan error, 1)
	go func() { _, err := app.Action("diagnostics", ""); done <- err }()
	select {
	case <-e.entered:
	case <-time.After(time.Second):
		t.Fatal("operation did not start")
	}
	stop := make(chan error, 1)
	go func() { _, err := app.Action("stop", ""); stop <- err }()
	select {
	case <-e.stopped:
	case <-time.After(time.Second):
		t.Fatal("stop blocked behind diagnostics")
	}
	select {
	case err := <-stop:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(time.Second):
		t.Fatal("snapshot blocked behind diagnostics")
	}
	if _, err := app.Action("cancel-operation", ""); err != nil {
		t.Fatal(err)
	}
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("cancelled operation succeeded")
		}
	case <-time.After(time.Second):
		t.Fatal("cancellation blocked")
	}
}
func TestShutdownCancelsOperation(t *testing.T) {
	app, err := NewApp(t.TempDir(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	e := &blockingEngine{entered: make(chan struct{}), stopped: make(chan struct{}, 1)}
	app.engine = e
	done := make(chan error, 1)
	go func() { _, err := app.Action("diagnostics", ""); done <- err }()
	<-e.entered
	app.shutdown(context.Background())
	select {
	case err := <-done:
		if err == nil {
			t.Fatal("closed app committed operation")
		}
	case <-time.After(time.Second):
		t.Fatal("shutdown did not cancel operation")
	}
}
