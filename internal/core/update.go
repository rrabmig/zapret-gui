package core

import (
	"archive/zip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

const Repository = "Flowseal/zapret-discord-youtube"
const maxArchive = 64 << 20
const maxExpanded = 192 << 20

type Asset struct {
	Name   string `json:"name"`
	URL    string `json:"browser_download_url"`
	Digest string `json:"digest"`
	Size   int64  `json:"size"`
}

type Release struct {
	Tag        string  `json:"tag_name"`
	Body       string  `json:"body"`
	URL        string  `json:"html_url"`
	Published  string  `json:"published_at"`
	Prerelease bool    `json:"prerelease"`
	Draft      bool    `json:"draft"`
	Assets     []Asset `json:"assets"`
}

type Updater struct {
	client *http.Client
	apiURL string
}

func NewUpdater() *Updater {
	client := &http.Client{Timeout: 90 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 10 {
			return NewMessageError("error056")
		}
		if req.URL.Scheme != "https" {
			return NewMessageError("error057")
		}
		switch req.URL.Host {
		case "github.com", "api.github.com", "raw.githubusercontent.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com":
			return nil
		default:
			return NewMessageError("error058")
		}
	}}
	return &Updater{client: client, apiURL: "https://api.github.com/repos/" + Repository + "/releases/latest"}
}

func (u *Updater) get(ctx context.Context, target string) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "GUIforzapret/0.1")
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := u.client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, NewMessageError("error059", fmt.Sprint(resp.StatusCode))
	}
	return resp, nil
}

func (u *Updater) Latest(ctx context.Context) (Release, error) {
	var r Release
	resp, err := u.get(ctx, u.apiURL)
	if err != nil {
		return r, err
	}
	defer resp.Body.Close()
	if err = json.NewDecoder(io.LimitReader(resp.Body, 2<<20)).Decode(&r); err != nil {
		return r, err
	}
	if !safeID.MatchString(r.Tag) || r.Draft || r.Prerelease {
		return r, NewMessageError("error060")
	}
	return r, nil
}

func zipAsset(r Release) (Asset, error) {
	for _, a := range r.Assets {
		if !strings.HasSuffix(strings.ToLower(a.Name), ".zip") || !strings.HasPrefix(a.Name, "zapret-discord-youtube-") {
			continue
		}
		u, err := url.Parse(a.URL)
		if err != nil || u.Scheme != "https" || u.Host != "github.com" || u.User != nil || !strings.HasPrefix(u.Path, "/"+Repository+"/releases/download/"+r.Tag+"/") {
			return a, NewMessageError("error061")
		}
		if a.Size <= 0 || a.Size > maxArchive {
			return a, NewMessageError("error062")
		}
		if !strings.HasPrefix(a.Digest, "sha256:") || len(a.Digest) != 71 {
			return a, NewMessageError("error063")
		}
		if _, err := hex.DecodeString(strings.TrimPrefix(a.Digest, "sha256:")); err != nil {
			return a, NewMessageError("error064")
		}
		return a, nil
	}
	return Asset{}, NewMessageError("error065")
}

// Install stages and verifies a complete official asset. It never activates it,
// executes its code, edits the active package, or falls back to a moving branch.
func (u *Updater) Install(ctx context.Context, root string, release Release) error {
	if !safeID.MatchString(release.Tag) {
		return NewMessageError("error066")
	}
	a, err := zipAsset(release)
	if err != nil {
		return err
	}
	if _, err := os.Stat(filepath.Join(root, release.Tag)); err == nil {
		return NewMessageError("error067")
	}
	resp, err := u.get(ctx, a.URL)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if err := os.MkdirAll(root, 0700); err != nil {
		return err
	}
	stage, err := os.MkdirTemp(root, ".stage-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(stage)
	f, err := os.Create(filepath.Join(stage, "release.zip"))
	if err != nil {
		return err
	}
	hash := sha256.New()
	n, copyErr := io.Copy(io.MultiWriter(f, hash), io.LimitReader(resp.Body, maxArchive+1))
	closeErr := f.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	if n != a.Size || n > maxArchive {
		return NewMessageError("error068")
	}
	if hex.EncodeToString(hash.Sum(nil)) != strings.TrimPrefix(a.Digest, "sha256:") {
		return NewMessageError("error069")
	}
	unpacked := filepath.Join(stage, "unpacked")
	if err := ExtractZIP(filepath.Join(stage, "release.zip"), unpacked); err != nil {
		return err
	}
	packageRoot, err := findPackageRoot(unpacked)
	if err != nil {
		return err
	}
	metadata, _ := json.MarshalIndent(release, "", "  ")
	if err := AtomicWrite(filepath.Join(packageRoot, "release.json"), metadata); err != nil {
		return err
	}
	return os.Rename(packageRoot, filepath.Join(root, release.Tag))
}

func ExtractZIP(archive, dest string) error {
	z, err := zip.OpenReader(archive)
	if err != nil {
		return err
	}
	defer z.Close()
	if len(z.File) > 4096 {
		return NewMessageError("error070")
	}
	var expanded uint64
	seen := map[string]bool{}
	for _, f := range z.File {
		name := strings.ReplaceAll(f.Name, `\`, "/")
		clean := path.Clean(name)
		if clean == "." || path.IsAbs(clean) || strings.HasPrefix(clean, "../") || clean == ".." || strings.ContainsAny(clean, ":\x00") || f.Mode()&os.ModeSymlink != 0 || (!f.FileInfo().IsDir() && !f.Mode().IsRegular()) {
			return NewMessageError("error071", fmt.Sprint(f.Name))
		}
		for _, part := range strings.Split(clean, "/") {
			upper := strings.ToUpper(strings.SplitN(part, ".", 2)[0])
			if strings.HasSuffix(part, ".") || strings.HasSuffix(part, " ") || upper == "CON" || upper == "PRN" || upper == "AUX" || upper == "NUL" || (len(upper) == 4 && (strings.HasPrefix(upper, "COM") || strings.HasPrefix(upper, "LPT")) && upper[3] >= '0' && upper[3] <= '9') {
				return NewMessageError("error072")
			}
		}
		key := strings.ToLower(clean)
		if seen[key] {
			return NewMessageError("error073", fmt.Sprint(f.Name))
		}
		seen[key] = true
		if f.UncompressedSize64 > maxExpanded || expanded > maxExpanded-f.UncompressedSize64 {
			return NewMessageError("error074")
		}
		expanded += f.UncompressedSize64
		target := filepath.Join(dest, filepath.FromSlash(clean))
		if f.FileInfo().IsDir() {
			if err := os.MkdirAll(target, 0700); err != nil {
				return err
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0700); err != nil {
			return err
		}
		r, err := f.Open()
		if err != nil {
			return err
		}
		w, err := os.OpenFile(target, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
		if err != nil {
			r.Close()
			return err
		}
		n, copyErr := io.Copy(w, io.LimitReader(r, int64(f.UncompressedSize64)+1))
		r.Close()
		closeErr := w.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
		if uint64(n) != f.UncompressedSize64 {
			return NewMessageError("error075")
		}
	}
	return nil
}

func findPackageRoot(root string) (string, error) {
	var found []string
	err := filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if !d.IsDir() && d.Name() == "service.bat" {
			found = append(found, filepath.Dir(p))
		}
		return nil
	})
	if err != nil {
		return "", err
	}
	if len(found) != 1 {
		return "", NewMessageError("error076")
	}
	// Require runtime files only. Official release ZIPs may omit the repository
	// license file; preserve any notices present without inventing archive contents.
	for _, name := range []string{"bin/winws.exe", "general.bat", "lists/list-general.txt", "utils/test zapret.ps1"} {
		if st, err := os.Stat(filepath.Join(found[0], filepath.FromSlash(name))); err != nil || !st.Mode().IsRegular() {
			return "", NewMessageError("error077", fmt.Sprint(name))
		}
	}
	return found[0], nil
}

// FetchData is restricted to the two non-executable upstream data endpoints.
func (u *Updater) FetchData(ctx context.Context, name string) ([]byte, error) {
	if name != "ipset-service.txt" && name != "hosts" {
		return nil, NewMessageError("error078")
	}
	resp, err := u.get(ctx, "https://raw.githubusercontent.com/"+Repository+"/main/.service/"+name)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(io.LimitReader(resp.Body, (8<<20)+1))
	if err != nil {
		return nil, err
	}
	if len(b) == 0 || len(b) > 8<<20 {
		return nil, NewMessageError("error079")
	}
	return b, nil
}
