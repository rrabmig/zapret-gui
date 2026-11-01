package core

import (
	"archive/zip"
	"bytes"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestSettingsRejectInvalidInputs(t *testing.T) {
	for _, ports := range []string{"", "0", "65536", "80-1", "80,,443", "80&calc", "1-2-3", " 443", "+443", "0x50"} {
		if ValidatePorts(ports) == nil {
			t.Errorf("accepted invalid ports %q", ports)
		}
	}
	for _, ports := range []string{"443", "1024-65535", "80,443,8000-9000"} {
		if err := ValidatePorts(ports); err != nil {
			t.Error(err)
		}
	}
	c := DefaultConfig()
	c.Active = "../outside"
	if c.Validate() == nil {
		t.Fatal("accepted a package traversal")
	}
	root := t.TempDir()
	c = DefaultConfig()
	if err := SaveConfig(root, c); err != nil {
		t.Fatal(err)
	}
	loaded, err := LoadConfig(root)
	if err != nil || !reflect.DeepEqual(c, loaded) {
		t.Fatalf("settings roundtrip: %v", err)
	}
	if loaded.EngineAllowed || loaded.AutoCheck {
		t.Fatal("fresh install must not start an engine or make update requests")
	}
}

func TestStrategyParserNeverEvaluatesShell(t *testing.T) {
	root := filepath.Join(t.TempDir(), "a path with spaces")
	if err := os.MkdirAll(root, 0700); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(root, "general.bat")
	fixture := "@echo off\r\ncall service.bat status_zapret\r\nstart \"zapret\" /min \"%BIN%winws.exe\" --wf-tcp=80,443,%GameFilterTCP% ^\r\n--hostlist=\"%LISTS%list-general-user.txt\" --dpi-desync=fake --new --filter-udp=%GameFilterUDP%\r\n"
	if err := os.WriteFile(path, []byte(fixture), 0600); err != nil {
		t.Fatal(err)
	}
	c := DefaultConfig()
	c.GameMode = "udp"
	c.GameUDP = "1234-1236"
	args, err := StrategyArgs(root, "general.bat", c)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"--wf-tcp=80,443,12", "--hostlist=" + filepath.Join(root, "lists", "list-general-user.txt"), "--dpi-desync=fake", "--new", "--filter-udp=1234-1236"}
	if !reflect.DeepEqual(args, want) {
		t.Fatalf("args\n got %#v\nwant %#v", args, want)
	}
	for _, tail := range []string{" & calc.exe", " | calc.exe", " > overwritten", " %UNKNOWN%", " \"unclosed"} {
		if err := os.WriteFile(path, []byte(strings.TrimSpace(strings.ReplaceAll(fixture, "\r\n", "\n"))+tail), 0600); err != nil {
			t.Fatal(err)
		}
		if _, err := StrategyArgs(root, "general.bat", c); err == nil {
			t.Errorf("accepted unsupported batch expression %q", tail)
		}
	}
	if _, err := StrategyArgs(root, "../general.bat", c); err == nil {
		t.Fatal("accepted path traversal")
	}
}

func TestArgumentGroupsPreserveLiteralWindowsPaths(t *testing.T) {
	args, err := splitArguments(`--hostlist="C:\Users\A B\lists\file.txt" --dpi-desync-fake-tls-mod="rnd,dupsid,sni=example.org"`)
	if err != nil {
		t.Fatal(err)
	}
	if args[0] != `--hostlist=C:\Users\A B\lists\file.txt` {
		t.Fatalf("path mangled: %q", args[0])
	}
	args, err = splitArguments(`--dpi-desync-fake-tls=^! --hostlist="C:\Users\literal^!\list.txt"`)
	if err != nil || args[0] != "--dpi-desync-fake-tls=!" || args[1] != `--hostlist=C:\Users\literal^!\list.txt` {
		t.Fatalf("literal bang escape: %#v, %v", args, err)
	}
}

func TestZIPRejectsTraversalLinksAndWindowsAliases(t *testing.T) {
	for _, name := range []string{"../outside", "/outside", `..\outside`, "C:/outside", "bin/CON.txt", "bin/file.", "bin/file ", "NUL"} {
		t.Run(strings.ReplaceAll(name, "/", "_"), func(t *testing.T) {
			archive := makeZIP(t, map[string]string{name: "bad"})
			if err := ExtractZIP(archive, filepath.Join(t.TempDir(), "out")); err == nil {
				t.Fatal("accepted unsafe entry")
			}
		})
	}
	var b bytes.Buffer
	w := zip.NewWriter(&b)
	h := &zip.FileHeader{Name: "bin/link"}
	h.SetMode(os.ModeSymlink | 0777)
	f, err := w.CreateHeader(h)
	if err != nil {
		t.Fatal(err)
	}
	f.Write([]byte("../../outside"))
	w.Close()
	p := filepath.Join(t.TempDir(), "link.zip")
	os.WriteFile(p, b.Bytes(), 0600)
	if err := ExtractZIP(p, filepath.Join(t.TempDir(), "out")); err == nil {
		t.Fatal("accepted symlink")
	}
	archive := makeZIP(t, map[string]string{"bin/WinWS.exe": "a", "bin/winws.exe": "b"})
	if err := ExtractZIP(archive, filepath.Join(t.TempDir(), "out")); err == nil {
		t.Fatal("accepted case-insensitive duplicate")
	}
}

func TestHostsMergeIsIdempotentAndPreservesUserEntries(t *testing.T) {
	original := "# my hosts\r\n127.0.0.1 localhost\r\n192.0.2.5 private.example\r\n"
	addition := "203.0.113.1 discord.com\n"
	merged, err := MergeHosts(original, addition)
	if err != nil {
		t.Fatal(err)
	}
	second, err := MergeHosts(merged, addition)
	if err != nil || second != merged {
		t.Fatalf("merge is not idempotent: %v", err)
	}
	if !strings.Contains(merged, "192.0.2.5 private.example") {
		t.Fatal("user entry lost")
	}
	if _, err := MergeHosts(original+hostsBegin+"\n", addition); err == nil {
		t.Fatal("accepted unmatched marker")
	}
	if _, err := MergeHosts(original, "not-an-ip example.com"); err == nil {
		t.Fatal("accepted invalid address")
	}
}

func TestRuntimeIsSeparateAndPreservesOverrides(t *testing.T) {
	root := t.TempDir()
	base := filepath.Join(root, "packages", "1.0.0")
	for name, content := range map[string]string{"general.bat": "original", "lists/ipset-all.txt": "192.0.2.0/24\n", "bin/fake.bin": "fake", "bin/ACTIVE_GAME_UDP.bin": "default", "utils/targets.txt": "example.com\n"} {
		if err := AtomicWrite(filepath.Join(base, filepath.FromSlash(name)), []byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := WriteList(root, "list-general-user.txt", "custom.example\n"); err != nil {
		t.Fatal(err)
	}
	if err := WriteList(root, "ipset-extra-user.txt", "203.0.113.0/24\n"); err != nil {
		t.Fatal(err)
	}
	c := DefaultConfig()
	c.Active = "1.0.0"
	c.GameFake = "fake.bin"
	run, err := PrepareRuntime(root, c)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(filepath.Join(run, "lists", "list-general-user.txt"))
	if string(b) != "custom.example\n" {
		t.Fatal("lost user domains")
	}
	b, _ = os.ReadFile(filepath.Join(run, "lists", "ipset-all.txt"))
	if !strings.Contains(string(b), "203.0.113.0/24") {
		t.Fatal("lost additional IPs")
	}
	b, _ = os.ReadFile(filepath.Join(base, "bin", "ACTIVE_GAME_UDP.bin"))
	if string(b) != "default" {
		t.Fatal("modified pristine package")
	}
	b, _ = os.ReadFile(filepath.Join(run, "bin", "ACTIVE_GAME_UDP.bin"))
	if string(b) != "fake" {
		t.Fatal("fake not applied")
	}
	c.IPSet = "none"
	run, err = PrepareRuntime(root, c)
	if err != nil {
		t.Fatal(err)
	}
	b, _ = os.ReadFile(filepath.Join(run, "lists", "ipset-all.txt"))
	if string(b) != "203.0.113.113/32\n" {
		t.Fatal("wrong none semantics")
	}
	c.IPSet = "any"
	run, err = PrepareRuntime(root, c)
	if err != nil {
		t.Fatal(err)
	}
	b, _ = os.ReadFile(filepath.Join(run, "lists", "ipset-all.txt"))
	if len(b) != 0 {
		t.Fatal("wrong any semantics")
	}
}

func TestListValidation(t *testing.T) {
	for name, content := range map[string]string{"list-general-user.txt": "https://example.org/a", "ipset-extra-user.txt": "192.0.2.500", "../../config.json": "{}"} {
		if err := ValidateList(name, []byte(content)); err == nil {
			t.Errorf("accepted invalid %s", name)
		}
	}
	if err := ValidateList("ipset-extra-user.txt", []byte("# comment\n2001:db8::/32\n192.0.2.1\n")); err != nil {
		t.Fatal(err)
	}
}

func makeZIP(t *testing.T, files map[string]string) string {
	t.Helper()
	var b bytes.Buffer
	w := zip.NewWriter(&b)
	for name, content := range files {
		f, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := f.Write([]byte(content)); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	p := filepath.Join(t.TempDir(), "release.zip")
	if err := os.WriteFile(p, b.Bytes(), 0600); err != nil {
		t.Fatal(err)
	}
	return p
}
