// package-check is CI-only: verify the actual official ZIP using production code.
// Extracted executables remain inert files. No engine, script, driver or probe runs.
package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/rrabmig/zapret-gui/internal/core"
)

func check(root string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	defer cancel()
	updater := core.NewUpdater()
	release, err := updater.Latest(ctx)
	if err != nil {
		return err
	}
	versionsDir := filepath.Join(root, "versions")
	if err := updater.Install(ctx, versionsDir, release); err != nil {
		return err
	}
	versions, err := core.ListVersions(versionsDir, core.DefaultConfig())
	if err != nil {
		return err
	}
	if len(versions) != 1 || versions[0].Tag != release.Tag || versions[0].Problem != "" {
		return fmt.Errorf("installed package is not selectable: %+v", versions)
	}
	config, err := core.SelectVersion(versionsDir, release.Tag, core.DefaultConfig())
	if err != nil {
		return err
	}
	strategies, err := core.Strategies(filepath.Join(versionsDir, release.Tag), config)
	if err != nil {
		return err
	}
	for _, strategy := range strategies {
		if !strategy.Compatible {
			return fmt.Errorf("%s: %s", strategy.Name, strategy.Problem)
		}
	}
	runtimeDir, err := core.PrepareRuntime(filepath.Join(root, "data"), versionsDir, config)
	if err != nil {
		return err
	}
	if _, err := core.StrategyArgs(runtimeDir, config.Strategy, config); err != nil {
		return err
	}
	if _, err := os.Stat(filepath.Join(runtimeDir, "bin", "winws.exe")); err != nil {
		return err
	}
	_, licenseErr := os.Stat(filepath.Join(versionsDir, release.Tag, "LICENSE.txt"))
	fmt.Printf("Official ZIP %s: SHA-256 verified, installed, catalogued, selected, runtime prepared; %d compatible strategies; LICENSE.txt present=%t; no code executed\n", release.Tag, len(strategies), licenseErr == nil)
	return nil
}
func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: package-check <runner-temp-directory>")
		os.Exit(2)
	}
	if err := check(os.Args[1]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
