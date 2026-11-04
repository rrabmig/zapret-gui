package core

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"time"
)

// InstalledVersion describes a complete, downloaded Flowseal release.
type InstalledVersion struct {
	Tag          string `json:"tag"`
	DownloadedAt string `json:"downloadedAt"`
	Size         int64  `json:"size"`
	Strategy     string `json:"strategy"`
	Problem      string `json:"problem,omitempty"`
}

// Windows stores downloads beside the installed executable, independent of cwd
// and --data-dir. Other platforms keep writable data outside their app bundles.
func DefaultVersionsDir(dataDir string) (string, error) {
	if runtime.GOOS != "windows" {
		return filepath.Join(dataDir, "versions"), nil
	}
	exe, err := os.Executable()
	if err != nil {
		return "", err
	}
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return "", err
	}
	return filepath.Join(filepath.Dir(exe), "versions"), nil
}

func versionPath(dir, tag string) (string, error) {
	if !safeID.MatchString(tag) {
		return "", NewMessageError("error015")
	}
	path := filepath.Join(dir, tag)
	st, err := os.Lstat(path)
	if err != nil {
		return "", err
	}
	if !st.IsDir() || st.Mode()&os.ModeSymlink != 0 {
		return "", NewMessageError("invalidVersion", tag)
	}
	return path, nil
}

// SelectVersion is a read-only preview used both by the UI catalog and activation.
func SelectVersion(dir, tag string, current Config) (Config, error) {
	c := current
	path, err := versionPath(dir, tag)
	if err != nil {
		return c, err
	}
	if _, err := findPackageRoot(path); err != nil {
		return c, err
	}
	strategies, err := Strategies(path, c)
	if err != nil {
		return c, err
	}
	c.Strategy = ""
	for _, s := range strategies {
		if s.Compatible && (c.Strategy == "" || s.Name == current.Strategy) {
			c.Strategy = s.Name
		}
		if s.Compatible && s.Name == current.Strategy {
			break
		}
	}
	if c.Strategy == "" {
		return c, NewMessageError("error005")
	}
	c.Active, c.Previous = tag, current.Active
	for _, name := range []*string{&c.DiscordFake, &c.GameFake} {
		if *name != "" {
			if _, err := os.Stat(filepath.Join(path, "bin", *name)); err != nil {
				if !errors.Is(err, os.ErrNotExist) {
					return c, err
				}
				*name = ""
			}
		}
	}
	return c, c.Validate()
}

func ListVersions(dir string, c Config) ([]InstalledVersion, error) {
	versions := []InstalledVersion{}
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return versions, nil
	}
	if err != nil {
		return nil, err
	}
	for _, entry := range entries {
		if !entry.IsDir() || !safeID.MatchString(entry.Name()) {
			continue
		}
		path, err := versionPath(dir, entry.Name())
		if err != nil {
			return nil, err
		}
		v := InstalledVersion{Tag: entry.Name()}
		// Only packages with our verified release metadata are displayed.
		b, err := os.ReadFile(filepath.Join(path, "release.json"))
		var release Release
		if err != nil || json.Unmarshal(b, &release) != nil || release.Tag != v.Tag {
			continue
		}
		info, err := os.Stat(filepath.Join(path, "release.json"))
		if err != nil {
			return nil, err
		}
		v.DownloadedAt = info.ModTime().UTC().Format(time.RFC3339)
		err = filepath.WalkDir(path, func(_ string, d fs.DirEntry, err error) error {
			if err != nil {
				return err
			}
			st, err := d.Info()
			if err != nil {
				return err
			}
			if !st.IsDir() && !st.Mode().IsRegular() {
				return NewMessageError("invalidVersion", v.Tag)
			}
			if st.Mode().IsRegular() {
				v.Size += st.Size()
			}
			return nil
		})
		if err != nil {
			v.Problem = err.Error()
		} else if next, err := SelectVersion(dir, v.Tag, c); err != nil {
			v.Problem = err.Error()
		} else {
			v.Strategy = next.Strategy
		}
		versions = append(versions, v)
	}
	sort.Slice(versions, func(i, j int) bool {
		return naturalLess(versions[j].Tag, versions[i].Tag)
	})
	return versions, nil
}

func DeleteVersion(dir, tag string) error {
	path, err := versionPath(dir, tag)
	if err != nil {
		return err
	}
	return os.RemoveAll(path)
}
