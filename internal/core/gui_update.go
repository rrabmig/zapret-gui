package core

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

const GUIRepository = "rrabmig/zapret-gui"
const maxGUIInstaller = 128 << 20

var guiVersion = regexp.MustCompile(`^v?(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9a-f]{8}))?$`)

// Stable release tags are exact vMAJOR.MINOR.PATCH. Our development builds
// compare as their numeric base; updating never downgrades or installs a prerelease.
func NewerGUIVersion(current, candidate string) bool {
	a, b := guiVersion.FindStringSubmatch(current), guiVersion.FindStringSubmatch(candidate)
	if a == nil || b == nil || !strings.HasPrefix(candidate, "v") || b[4] != "" {
		return false
	}
	var left, right [3]uint64
	for i := 0; i < 3; i++ {
		x, e := strconv.ParseUint(a[i+1], 10, 32)
		y, f := strconv.ParseUint(b[i+1], 10, 32)
		if e != nil || f != nil {
			return false
		}
		left[i], right[i] = x, y
	}
	for i := 0; i < 3; i++ {
		if left[i] != right[i] {
			return right[i] > left[i]
		}
	}
	return a[4] != ""
}

type GUIUpdate struct {
	Tag       string `json:"tag"`
	URL       string `json:"url"`
	Notes     string `json:"notes"`
	Size      int64  `json:"size"`
	Available bool   `json:"available"`
	Ready     bool   `json:"ready"`
	Checked   string `json:"checked"`
	Installer string `json:"-"`
	Asset     Asset  `json:"-"`
}
type GUIUpdater struct {
	mu       sync.Mutex
	client   *http.Client
	endpoint string
	etag     string
	cached   *Release
	next     time.Time
}

func NewGUIUpdater() *GUIUpdater {
	client := &http.Client{Timeout: 90 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 10 || req.URL.Scheme != "https" || req.URL.User != nil {
			return guiError()
		}
		switch req.URL.Host {
		case "github.com", "api.github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com":
			return nil
		default:
			return guiError()
		}
	}}
	return &GUIUpdater{client: client, endpoint: "https://api.github.com/repos/" + GUIRepository + "/releases/latest"}
}
func guiError() error { return NewMessageError("guiUpdateInvalid") }
func guiReleaseURL(tag string) string {
	return "https://github.com/" + GUIRepository + "/releases/tag/" + tag
}
func guiAsset(r Release) (Asset, error) {
	version := guiVersion.FindStringSubmatch(r.Tag)
	if version == nil || !strings.HasPrefix(r.Tag, "v") || version[4] != "" || r.Draft || r.Prerelease || r.URL != guiReleaseURL(r.Tag) {
		return Asset{}, guiError()
	}
	name := "GUIforzapret-Setup-" + strings.TrimPrefix(r.Tag, "v") + "-x64.exe"
	var found *Asset
	for _, a := range r.Assets {
		if a.Name == name {
			if found != nil {
				return Asset{}, guiError()
			}
			copy := a
			found = &copy
		}
	}
	if found == nil {
		return Asset{}, guiError()
	}
	a := *found
	u, err := url.Parse(a.URL)
	if err != nil || u.Scheme != "https" || u.Host != "github.com" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || u.Path != "/"+GUIRepository+"/releases/download/"+r.Tag+"/"+name {
		return Asset{}, guiError()
	}
	if a.Size <= 0 || a.Size > maxGUIInstaller || len(a.Digest) != 71 || !strings.HasPrefix(a.Digest, "sha256:") {
		return Asset{}, guiError()
	}
	if _, err := hex.DecodeString(a.Digest[7:]); err != nil {
		return Asset{}, guiError()
	}
	return a, nil
}
func (u *GUIUpdater) Check(ctx context.Context, current, platform, arch string) (GUIUpdate, error) {
	u.mu.Lock()
	defer u.mu.Unlock()
	var state GUIUpdate
	now := time.Now()
	if now.Before(u.next) {
		return state, NewMessageError("guiUpdateWait", u.next.Format(time.RFC3339))
	}
	u.next = now.Add(time.Minute)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.endpoint, nil)
	if err != nil {
		return state, err
	}
	req.Header.Set("User-Agent", "GUIforzapret/"+current)
	req.Header.Set("Accept", "application/vnd.github+json")
	if u.etag != "" {
		req.Header.Set("If-None-Match", u.etag)
	}
	resp, err := u.client.Do(req)
	if err != nil {
		return state, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 404 {
		return GUIUpdate{Checked: now.Format(time.RFC3339)}, nil
	}
	if resp.StatusCode == 403 || resp.StatusCode == 429 {
		u.next = now.Add(15 * time.Minute)
		if reset, e := strconv.ParseInt(resp.Header.Get("X-RateLimit-Reset"), 10, 64); e == nil && time.Unix(reset, 0).After(u.next) {
			u.next = time.Unix(reset, 0)
		}
		return state, NewMessageError("guiUpdateWait", u.next.Format(time.RFC3339))
	}
	var r Release
	if resp.StatusCode == 304 && u.cached != nil {
		r = *u.cached
	} else {
		if resp.StatusCode != 200 {
			return state, NewMessageError("error059", fmt.Sprint(resp.StatusCode))
		}
		data, err := io.ReadAll(io.LimitReader(resp.Body, (2<<20)+1))
		if err != nil {
			return state, err
		}
		if len(data) > 2<<20 {
			return state, guiError()
		}
		if err = json.Unmarshal(data, &r); err != nil {
			return state, guiError()
		}
	}
	asset, err := guiAsset(r)
	if err != nil {
		return state, err
	}
	copy := r
	u.cached = &copy
	if resp.StatusCode == 200 {
		u.etag = resp.Header.Get("ETag")
	}
	return GUIUpdate{Tag: r.Tag, URL: r.URL, Notes: r.Body, Size: asset.Size, Available: NewerGUIVersion(current, r.Tag), Checked: now.Format(time.RFC3339), Asset: asset}, nil
}
func verifyGUIInstaller(name string, a Asset) error {
	f, err := os.Open(name)
	if err != nil {
		return err
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil {
		return err
	}
	if !st.Mode().IsRegular() || st.Size() != a.Size || a.Size <= 0 || a.Size > maxGUIInstaller {
		return guiError()
	}
	hash := sha256.New()
	n, err := io.Copy(hash, io.LimitReader(f, maxGUIInstaller+1))
	if err != nil {
		return err
	}
	if n != a.Size || "sha256:"+hex.EncodeToString(hash.Sum(nil)) != a.Digest {
		return guiError()
	}
	return nil
}

// Download is explicit. No installation or engine activity is performed here.
func (u *GUIUpdater) Download(ctx context.Context, root, current string, state GUIUpdate) (GUIUpdate, error) {
	r := Release{Tag: state.Tag, URL: state.URL, Assets: []Asset{state.Asset}}
	a, err := guiAsset(r)
	if err != nil || !NewerGUIVersion(current, state.Tag) {
		return state, guiError()
	}
	cache := filepath.Join(root, "gui-updates")
	if err = os.MkdirAll(cache, 0700); err != nil {
		return state, err
	}
	stage, err := os.MkdirTemp(cache, "download-")
	if err != nil {
		return state, err
	}
	keep := false
	defer func() {
		if !keep {
			os.RemoveAll(stage)
		}
	}()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.URL, nil)
	if err != nil {
		return state, err
	}
	req.Header.Set("User-Agent", "GUIforzapret/"+current)
	response, err := u.client.Do(req)
	if err != nil {
		return state, err
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return state, NewMessageError("error059", fmt.Sprint(response.StatusCode))
	}
	name := filepath.Join(stage, a.Name)
	f, err := os.OpenFile(name, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return state, err
	}
	n, copyErr := io.Copy(f, io.LimitReader(response.Body, a.Size+1))
	closeErr := f.Close()
	if copyErr != nil {
		return state, copyErr
	}
	if closeErr != nil {
		return state, closeErr
	}
	if n != a.Size {
		return state, guiError()
	}
	if err = verifyGUIInstaller(name, a); err != nil {
		return state, err
	}
	state.Ready = true
	state.Installer = name
	keep = true
	return state, nil
}
