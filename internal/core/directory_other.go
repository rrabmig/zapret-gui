//go:build !windows

package core

import (
	"os/exec"
	"runtime"
)

func OpenDirectory(path string) error {
	program := "xdg-open"
	if runtime.GOOS == "darwin" {
		program = "open"
	}
	return exec.Command(program, path).Run()
}
