package core

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// Regression: the official 1.10.4 release ZIP does not contain LICENSE.txt.
func TestInstallVerifiesLicenseLessArchiveAndDoesNotActivate(t *testing.T) {
	archive := makeZIP(t, map[string]string{
		"release/service.bat": "@echo off", "release/general.bat": "@echo off",
		"release/bin/winws.exe":          "inert test fixture, never executable",
		"release/lists/list-general.txt": "example.com\n",
		"release/utils/test zapret.ps1":  "# inert fixture",
	})
	b, err := os.ReadFile(archive)
	if err != nil {
		t.Fatal(err)
	}
	h := sha256.Sum256(b)
	r := Release{Tag: "1.0.0", Assets: []Asset{{Name: "zapret-discord-youtube-1.0.0.zip", URL: "https://github.com/" + Repository + "/releases/download/1.0.0/release.zip", Size: int64(len(b)), Digest: "sha256:" + hex.EncodeToString(h[:])}}}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/latest" {
			json.NewEncoder(w).Encode(r)
			return
		}
		w.Write(b)
	}))
	defer server.Close()
	serverURL, _ := url.Parse(server.URL)
	client := &http.Client{Transport: transportFunc(func(req *http.Request) (*http.Response, error) {
		clone := req.Clone(req.Context())
		u := *req.URL
		clone.URL = &u
		clone.URL.Scheme, clone.URL.Host = serverURL.Scheme, serverURL.Host
		return http.DefaultTransport.RoundTrip(clone)
	})}
	u := &Updater{client: client, apiURL: server.URL + "/latest"}
	root := t.TempDir()
	if err := SaveConfig(root, DefaultConfig()); err != nil {
		t.Fatal(err)
	}
	latest, err := u.Latest(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if err := u.Install(context.Background(), filepath.Join(root, "versions"), latest); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "versions", "1.0.0", "service.bat")); err != nil {
		t.Fatal(err)
	}
	c, err := LoadConfig(root)
	if err != nil || c.Active != "" {
		t.Fatalf("installation unexpectedly activated or changed settings: %v", err)
	}
	if err := u.Install(context.Background(), filepath.Join(root, "versions"), latest); err == nil {
		t.Fatal("overwrote an installed package")
	}
	badRoot := t.TempDir()
	r.Assets[0].Digest = "sha256:" + strings.Repeat("0", 64)
	if err := u.Install(context.Background(), filepath.Join(badRoot, "versions"), r); err == nil {
		t.Fatal("accepted mismatched checksum")
	}
	if _, err := os.Stat(filepath.Join(badRoot, "versions", "1.0.0")); !os.IsNotExist(err) {
		t.Fatal("published corrupt package")
	}
}

func TestMetadataAndNetworkErrors(t *testing.T) {
	for _, status := range []int{403, 404, 429, 500} {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(status) }))
		u := &Updater{client: server.Client(), apiURL: server.URL}
		if _, err := u.Latest(context.Background()); err == nil {
			t.Errorf("ignored HTTP %d", status)
		}
		server.Close()
	}
	u := &Updater{client: &http.Client{Transport: transportFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"tag_name":"../escape"}`)), Header: http.Header{}}, nil
	})}, apiURL: "https://api.github.com/latest"}
	if _, err := u.Latest(context.Background()); err == nil {
		t.Fatal("accepted unsafe release tag")
	}
	if _, err := zipAsset(Release{Tag: "1.0.0", Assets: []Asset{{Name: "zapret-discord-youtube-1.zip", URL: "https://attacker.example/release.zip", Digest: "sha256:" + strings.Repeat("a", 64), Size: 10}}}); err == nil {
		t.Fatal("accepted third-party executable download")
	}
}
