package core

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// GUIUpdateJob is created only after an explicit update confirmation. The
// helper runs unelevated, outside the install directory, before any Wails code.
type GUIUpdateJob struct {
	Parent    uint32 `json:"parent"`
	Installer string `json:"installer"`
	Asset     Asset  `json:"asset"`
	Target    string `json:"target"`
	DataDir   string `json:"dataDir"`
	Language  string `json:"language"`
	Restart   bool   `json:"restart"`
}

func writeGUIJob(name string, j GUIUpdateJob) error {
	data, err := json.Marshal(j)
	if err != nil {
		return err
	}
	return AtomicWrite(name, data)
}
func readGUIJob(name string) (GUIUpdateJob, error) {
	var j GUIUpdateJob
	data, err := os.ReadFile(name)
	if err != nil {
		return j, err
	}
	if len(data) > 16384 {
		return j, guiError()
	}
	if err = json.Unmarshal(data, &j); err != nil {
		return j, err
	}
	if j.Parent == 0 || !filepath.IsAbs(j.Target) || !filepath.IsAbs(j.DataDir) || !filepath.IsAbs(j.Installer) || filepath.Base(j.Installer) != j.Asset.Name {
		return j, guiError()
	}
	return j, nil
}
