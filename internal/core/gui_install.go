package core

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
)

func copyGUIFile(from, to string) error {
	r, err := os.Open(from)
	if err != nil {
		return err
	}
	defer r.Close()
	w, err := os.OpenFile(to, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return err
	}
	_, err = io.Copy(w, r)
	closeErr := w.Close()
	if err != nil {
		return err
	}
	return closeErr
}

// Installation policy is separate from OS process plumbing so rollback and
// cancellation are exercised with inert installers on every runner platform.
func installGUI(j GUIUpdateJob, jobName string, setup func() error, restart func() error) error {
	if err := verifyGUIInstaller(j.Installer, j.Asset); err != nil {
		return err
	}
	target := filepath.Join(j.Target, "GUIforzapret.exe")
	backup := filepath.Join(filepath.Dir(jobName), "previous-"+filepath.Base(jobName)+".exe")
	if err := copyGUIFile(target, backup); err != nil {
		return err
	}
	if err := setup(); err != nil {
		restore := target + ".restore"
		_ = os.Remove(restore)
		if e := copyGUIFile(backup, restore); e != nil {
			return fmt.Errorf("%v; restore: %w (backup: %s)", err, e, backup)
		}
		if e := os.Rename(restore, target); e != nil {
			return fmt.Errorf("%v; restore: %w (backup: %s)", err, e, backup)
		}
		return err
	}
	if st, err := os.Stat(target); err != nil || !st.Mode().IsRegular() {
		return guiError()
	}
	if j.Restart {
		if err := restart(); err != nil {
			return err
		}
	}
	_ = os.Remove(j.Installer)
	_ = os.Remove(backup)
	_ = os.Remove(jobName + ".ready")
	_ = os.Remove(jobName)
	return nil
}
