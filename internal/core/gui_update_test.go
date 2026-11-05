package core

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestGUISemVer(t *testing.T) {
	for _, v := range []struct {
		current, tag string
		newer        bool
	}{
		{"0.1.0", "v0.2.0", true}, {"v0.1.0", "v0.1.1", true}, {"0.1.0-1234abcd", "v0.1.0", true},
		{"0.2.0", "v0.1.9", false}, {"0.2.0", "v0.2.0", false}, {"0.2.0", "v0.3.0-beta", false},
		{"0.2.0", "0.3.0", false}, {"unknown", "v1.0.0", false}, {"0.1.0", "v01.2.0", false},
		{"0.1.0", "v999999999999.0.0", false}, {"1.9.9", "v2.0.0", true},
	} {
		if got := NewerGUIVersion(v.current, v.tag); got != v.newer {
			t.Errorf("%s -> %s = %v", v.current, v.tag, got)
		}
	}
}
func guiFixture() (Release, []byte) {
	data := []byte("inert installer bytes; never execute")
	sum := sha256.Sum256(data)
	tag := "v0.2.0"
	name := "GUIforzapret-Setup-0.2.0-x64.exe"
	return Release{Tag: tag, URL: guiReleaseURL(tag), Body: "release notes", Assets: []Asset{{Name: name, Size: int64(len(data)), Digest: "sha256:" + hex.EncodeToString(sum[:]), URL: "https://github.com/" + GUIRepository + "/releases/download/" + tag + "/" + name}}}, data
}
func TestGUIReleaseRejectsUntrustedAssets(t *testing.T) {
	mutations := []func(*Release){
		func(r *Release) { r.Draft = true }, func(r *Release) { r.Prerelease = true }, func(r *Release) { r.Tag = "v0.2.0-beta" },
		func(r *Release) { r.URL = "https://example.com" }, func(r *Release) { r.Assets[0].URL = strings.Replace(r.Assets[0].URL, "rrabmig", "someone", 1) },
		func(r *Release) { r.Assets[0].URL += "?redirect=1" }, func(r *Release) { r.Assets[0].URL = strings.Replace(r.Assets[0].URL, "https:", "http:", 1) },
		func(r *Release) { r.Assets[0].Name = "archive.zip" }, func(r *Release) { r.Assets[0].Size = maxGUIInstaller + 1 }, func(r *Release) { r.Assets[0].Size = 0 },
		func(r *Release) { r.Assets[0].Digest = "" }, func(r *Release) { r.Assets[0].Digest = "sha256:" + strings.Repeat("z", 64) }, func(r *Release) { r.Assets = append(r.Assets, r.Assets[0]) },
	}
	for i, mutate := range mutations {
		r, _ := guiFixture()
		mutate(&r)
		if _, err := guiAsset(r); err == nil {
			t.Fatalf("accepted mutation %d", i)
		}
	}
}
func TestGUICheckETagBackoffAndNoReleases(t *testing.T) {
	r, _ := guiFixture()
	calls := 0
	status := 200
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		calls++
		if calls == 2 {
			if req.Header.Get("If-None-Match") != "fixture" {
				t.Error("missing ETag")
			}
		}
		w.Header().Set("ETag", "fixture")
		w.WriteHeader(status)
		if status == 200 {
			json.NewEncoder(w).Encode(r)
		}
	}))
	defer server.Close()
	u := NewGUIUpdater()
	u.endpoint = server.URL
	u.client = server.Client()
	state, err := u.Check(context.Background(), "0.1.0", "windows", "amd64")
	if err != nil || !state.Available || state.Notes != r.Body {
		t.Fatalf("%+v %v", state, err)
	}
	if _, err = u.Check(context.Background(), "0.1.0", "windows", "amd64"); err == nil || calls != 1 {
		t.Fatal("no backoff")
	}
	status = 304
	u.next = time.Time{}
	state, err = u.Check(context.Background(), "0.1.0", "windows", "amd64")
	if err != nil || state.Tag != r.Tag {
		t.Fatalf("304: %+v %v", state, err)
	}
	status = 429
	u.next = time.Time{}
	if _, err = u.Check(context.Background(), "0.1.0", "windows", "amd64"); err == nil || time.Until(u.next) < 14*time.Minute {
		t.Fatal("rate limit not honored")
	}
	status = 404
	u.next = time.Time{}
	state, err = u.Check(context.Background(), "0.1.0", "linux", "amd64")
	if err != nil || state.Available || state.Checked == "" {
		t.Fatal("no-release should be an empty checked state")
	}
}

type guiTransport func(*http.Request) (*http.Response, error)

func (f guiTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func TestGUIDownloadVerifiesBeforeReadyAndKeepsInstallation(t *testing.T) {
	for _, mode := range []string{"valid", "corrupt", "short", "extra", "cancelled"} {
		t.Run(mode, func(t *testing.T) {
			r, data := guiFixture()
			a, _ := guiAsset(r)
			payload := append([]byte(nil), data...)
			switch mode {
			case "corrupt":
				payload[0] = 'x'
			case "short":
				payload = payload[:3]
			case "extra":
				payload = append(payload, 'x')
			}
			u := NewGUIUpdater()
			u.client = &http.Client{Transport: guiTransport(func(req *http.Request) (*http.Response, error) {
				if req.URL.String() != a.URL {
					t.Error("wrong target")
				}
				if err := req.Context().Err(); err != nil {
					return nil, err
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(string(payload)))}, nil
			})}
			root := t.TempDir()
			sentinel := filepath.Join(root, "config.json")
			os.WriteFile(sentinel, []byte("keep"), 0600)
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			if mode == "cancelled" {
				cancel()
			}
			state, err := u.Download(ctx, root, "0.1.0", GUIUpdate{Tag: r.Tag, URL: r.URL, Asset: a, Available: true})
			if mode == "valid" {
				if err != nil || !state.Ready {
					t.Fatalf("%+v %v", state, err)
				}
				os.WriteFile(state.Installer, []byte("tampered"), 0600)
				if verifyGUIInstaller(state.Installer, a) == nil {
					t.Fatal("accepted tampered cached installer")
				}
			} else {
				if err == nil {
					t.Fatal("accepted failed download")
				}
				entries, _ := os.ReadDir(filepath.Join(root, "gui-updates"))
				if len(entries) != 0 {
					t.Fatal("partial file retained")
				}
			}
			b, _ := os.ReadFile(sentinel)
			if string(b) != "keep" {
				t.Fatal("data changed")
			}
		})
	}
}

func TestGUIInstallCancellationRestoresPreviousExecutableAndPreservesData(t *testing.T) {
	for _, mode := range []string{"success", "cancelled", "partial-failure", "restart-failure"} {
		t.Run(mode, func(t *testing.T) {
			r, data := guiFixture()
			root := t.TempDir()
			target := filepath.Join(root, "application with spaces")
			os.MkdirAll(target, 0700)
			exe := filepath.Join(target, "GUIforzapret.exe")
			os.WriteFile(exe, []byte("previous GUI"), 0600)
			sentinel := filepath.Join(target, "versions", "kept")
			AtomicWrite(sentinel, []byte("keep"))
			installer := filepath.Join(root, r.Assets[0].Name)
			os.WriteFile(installer, data, 0600)
			jobName := filepath.Join(root, "job.json")
			os.WriteFile(jobName, []byte("job"), 0600)
			j := GUIUpdateJob{Installer: installer, Asset: r.Assets[0], Target: target, DataDir: root, Restart: true}
			restarted := false
			err := installGUI(j, jobName, func() error {
				if mode == "cancelled" {
					return io.EOF
				}
				os.WriteFile(exe, []byte("new GUI"), 0600)
				if mode == "partial-failure" {
					return io.ErrUnexpectedEOF
				}
				return nil
			}, func() error {
				restarted = true
				if mode == "restart-failure" {
					return io.EOF
				}
				return nil
			})
			b, _ := os.ReadFile(sentinel)
			if string(b) != "keep" {
				t.Fatal("lost versions")
			}
			b, _ = os.ReadFile(exe)
			if mode == "success" {
				if err != nil || !restarted || string(b) != "new GUI" {
					t.Fatalf("%v, restarted %v", err, restarted)
				}
				if _, e := os.Stat(installer); !os.IsNotExist(e) {
					t.Fatal("successful download retained")
				}
			} else {
				if err == nil {
					t.Fatal("lost error")
				}
				if mode != "restart-failure" && (restarted || string(b) != "previous GUI") {
					t.Fatal("failed installation not restored")
				}
				if _, e := os.Stat(installer); e != nil {
					t.Fatal("retry installer lost")
				}
			}
		})
	}
}
