//go:build !bindings

package main

import (
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"time"

	"github.com/rrabmig/zapret-gui/internal/core"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

func main() {
	rootFlag := flag.String("data-dir", "", "GUI settings and working-copy directory")
	waitLock := flag.Bool("wait-lock", false, "wait for an elevated GUI replacement")
	flag.Parse()
	root := *rootFlag
	if root == "" {
		base, err := os.UserConfigDir()
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			return
		}
		root = filepath.Join(base, "ZapretDesktop")
	}
	root, err := filepath.Abs(root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	unlock, err := core.AcquireLock(root)
	if *waitLock {
		deadline := time.Now().Add(10 * time.Second)
		for err != nil && time.Now().Before(deadline) {
			time.Sleep(200 * time.Millisecond)
			unlock, err = core.AcquireLock(root)
		}
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	defer unlock()
	versionsDir, err := core.DefaultVersionsDir(root)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	app, err := NewApp(root, versionsDir)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	frontend, err := fs.Sub(assets, "frontend/dist")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return
	}
	err = wails.Run(&options.App{
		Title: "Zapret Desktop", Width: 1100, Height: 790, MinWidth: 760, MinHeight: 600,
		AssetServer:      &assetserver.Options{Assets: frontend},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 255},
		OnStartup:        app.startup, OnShutdown: app.shutdown,
		Bind: []interface{}{app},
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
	}
}
