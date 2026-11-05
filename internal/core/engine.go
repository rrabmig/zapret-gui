package core

import (
	"context"
	"io"
	"strings"
)

type EngineState struct {
	Supported               bool   `json:"supported"`
	Elevated                bool   `json:"elevated"`
	Running                 bool   `json:"running"`
	ServiceInstalled        bool   `json:"serviceInstalled"`
	ServiceRunning          bool   `json:"serviceRunning"`
	ExternalRunning         bool   `json:"externalRunning"`
	ForeignServiceInstalled bool   `json:"foreignServiceInstalled"`
	StatusError             string `json:"statusError,omitempty"`
	Message                 string `json:"message"`
}

type Check struct {
	Name   string `json:"name"`
	State  string `json:"state"`
	Detail string `json:"detail"`
}

// Engine is implemented per platform; the Flowseal package has a Windows engine.
// Unsupported platforms deliberately cannot run a shell fallback.
type Engine interface {
	State() EngineState
	Start(root string, args []string, output io.Writer) error
	Stop() error
	Service(action, root string, args []string) error
	OpenTool(root, tool string) error
	Elevate(dataDir string) error
	Diagnostics(context.Context) []Check
	ApplyHosts(preview string) error
	ClearDiscordCache() (string, error)
}

// Owned processes include both the GUI child and the SCM service. Classification
// stays independent of WinAPI so real process facts can be tested without execution.
func IsForeignEngine(name string, pid, childPID, servicePID uint32) bool {
	return strings.EqualFold(name, "winws.exe") && pid != childPID && pid != servicePID
}
