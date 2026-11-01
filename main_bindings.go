//go:build bindings

package main

import (
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
)

// Wails executes a small helper when generating bindings. Keep that path inert:
// no configuration, OS lock, journal, engine construction, or startup flags.
func main() {
	app := &App{}
	if err := wails.Run(&options.App{
		Bind: []interface{}{app}, OnStartup: app.startup, OnShutdown: app.shutdown,
	}); err != nil {
		panic(err)
	}
}
