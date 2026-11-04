package core

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func versionFixture(t *testing.T, dir, tag string) string {
	t.Helper()
	root := filepath.Join(dir, tag)
	files := map[string]string{
		"service.bat":            "@echo off",
		"general.bat":            "start \"zapret\" /min \"%BIN%winws.exe\" --wf-tcp=443\n",
		"bin/winws.exe":          "inert, never executed",
		"lists/list-general.txt": "example.org\n",
		"utils/test zapret.ps1":  "# inert",
		"LICENSE.txt":            "fixture",
	}
	b, _ := json.Marshal(Release{Tag: tag})
	files["release.json"] = string(b)
	for name, content := range files {
		if err := AtomicWrite(filepath.Join(root, filepath.FromSlash(name)), []byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func TestVersionsSelectionAndCatalog(t *testing.T) {
	dir := t.TempDir()
	for _, tag := range []string{"1.9.0", "1.10.0"} {
		versionFixture(t, dir, tag)
	}
	if err := os.MkdirAll(filepath.Join(dir, ".stage-incomplete"), 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "unverified"), 0700); err != nil {
		t.Fatal(err)
	}
	c := DefaultConfig()
	c.Active, c.Strategy, c.DiscordFake = "1.9.0", "general (removed).bat", "removed.bin"
	before := c
	next, err := SelectVersion(dir, "1.10.0", c)
	if err != nil {
		t.Fatal(err)
	}
	if c != before || next.Active != "1.10.0" || next.Previous != "1.9.0" || next.Strategy != "general.bat" || next.DiscordFake != "" {
		t.Fatalf("unexpected selection: %+v", next)
	}
	versions, err := ListVersions(dir, c)
	if err != nil {
		t.Fatal(err)
	}
	tags := []string{}
	for _, v := range versions {
		tags = append(tags, v.Tag)
		if v.Size == 0 || v.DownloadedAt == "" || v.Strategy != "general.bat" || v.Problem != "" {
			t.Fatalf("incomplete metadata: %+v", v)
		}
	}
	if !reflect.DeepEqual(tags, []string{"1.10.0", "1.9.0"}) {
		t.Fatalf("unexpected order/partial versions: %v", tags)
	}
	if err := os.Remove(filepath.Join(dir, "1.10.0", "bin", "winws.exe")); err != nil {
		t.Fatal(err)
	}
	if _, err := SelectVersion(dir, "1.10.0", c); err == nil {
		t.Fatal("selected an incomplete release")
	}
	versions, err = ListVersions(dir, c)
	if err != nil || versions[0].Problem == "" {
		t.Fatalf("damaged version was not reported: %v", err)
	}
}

func TestDeleteVersionRejectsTraversalAndSymlink(t *testing.T) {
	dir := t.TempDir()
	outside := t.TempDir()
	sentinel := filepath.Join(outside, "keep")
	if err := os.WriteFile(sentinel, []byte("keep"), 0600); err != nil {
		t.Fatal(err)
	}
	for _, tag := range []string{"", "..", "../outside", "a/b", `a\b`} {
		if err := DeleteVersion(dir, tag); err == nil {
			t.Fatalf("accepted %q", tag)
		}
	}
	if err := os.Symlink(outside, filepath.Join(dir, "linked")); err == nil {
		if err := DeleteVersion(dir, "linked"); err == nil {
			t.Fatal("accepted symlink")
		}
	}
	if _, err := os.Stat(sentinel); err != nil {
		t.Fatal("deleted outside versions directory")
	}
	versionFixture(t, dir, "1.0.0")
	if err := DeleteVersion(dir, "1.0.0"); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, "1.0.0")); !os.IsNotExist(err) {
		t.Fatal("version still exists")
	}
}
