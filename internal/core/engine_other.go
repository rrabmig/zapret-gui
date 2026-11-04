//go:build !windows

package core

import (
	"io"
	"os"
	"path/filepath"
	"syscall"
)

var errWindows = NewMessageError("error035")

type unsupportedEngine struct{}

func NewEngine() Engine { return &unsupportedEngine{} }
func (*unsupportedEngine) State() EngineState {
	return EngineState{Message: NewMessage("error035").Error()}
}
func (*unsupportedEngine) Start(string, []string, io.Writer) error { return errWindows }
func (*unsupportedEngine) Stop() error                             { return errWindows }
func (*unsupportedEngine) Service(string, string, []string) error  { return errWindows }
func (*unsupportedEngine) OpenTool(string, string) error           { return errWindows }
func (*unsupportedEngine) Elevate(string) error                    { return errWindows }
func (*unsupportedEngine) Diagnostics() []Check {
	return []Check{{Name: NewMessage("engine").Error(), State: "unavailable", Detail: errWindows.Error()}}
}
func (*unsupportedEngine) ApplyHosts(string) error            { return errWindows }
func (*unsupportedEngine) ClearDiscordCache() (string, error) { return "", errWindows }

func AcquireLock(root string) (func(), error) {
	if err := os.MkdirAll(root, 0700); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(filepath.Join(root, "app.lock"), os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, err
	}
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		f.Close()
		return nil, NewMessageError("error036")
	}
	return func() { syscall.Flock(int(f.Fd()), syscall.LOCK_UN); f.Close() }, nil
}
