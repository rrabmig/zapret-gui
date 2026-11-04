package core

import (
	"errors"
	"fmt"
	"io/fs"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var ListNames = []string{"list-general-user.txt", "list-exclude-user.txt", "ipset-extra-user.txt", "ipset-exclude-user.txt", "targets.txt"}
var domainName = regexp.MustCompile(`^(?i:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?i:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$`)

func ValidateList(name string, data []byte) error {
	found := false
	for _, n := range ListNames {
		if name == n {
			found = true
		}
	}
	if name == "ipset-service.txt" {
		found = true
	}
	if !found {
		return NewMessageError("error023")
	}
	if len(data) > 8<<20 || strings.ContainsRune(string(data), 0) {
		return NewMessageError("error024")
	}
	for i, line := range strings.Split(string(data), "\n") {
		v := strings.TrimSpace(strings.SplitN(line, "#", 2)[0])
		if v == "" {
			continue
		}
		if strings.HasPrefix(name, "ipset") {
			if net.ParseIP(v) == nil {
				if _, _, err := net.ParseCIDR(v); err != nil {
					return NewMessageError("error025", fmt.Sprint(i+1))
				}
			}
		} else if len(v) > 253 || !domainName.MatchString(v) {
			return NewMessageError("error026", fmt.Sprint(i+1))
		}
	}
	return nil
}

func ReadList(root, name string) (string, error) {
	if err := ValidateList(name, nil); err != nil {
		return "", err
	}
	b, err := os.ReadFile(filepath.Join(root, "overrides", name))
	if errors.Is(err, os.ErrNotExist) {
		return "", nil
	}
	return string(b), err
}

func WriteList(root, name, content string) error {
	if err := ValidateList(name, []byte(content)); err != nil {
		return err
	}
	return AtomicWrite(filepath.Join(root, "overrides", name), []byte(content))
}

func CopyTree(source, dest string) error {
	return filepath.WalkDir(source, func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(source, p)
		if err != nil {
			return err
		}
		target := filepath.Join(dest, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0700)
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return NewMessageError("error027")
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		return AtomicWrite(target, b)
	})
}

// PrepareRuntime recreates a disposable execution tree from a pristine package.
// Caller must ensure that no process or service is using this directory.
func PrepareRuntime(root string, c Config) (string, error) {
	if err := c.Validate(); err != nil {
		return "", err
	}
	if c.Active == "" {
		return "", NewMessageError("error028")
	}
	base := filepath.Join(root, "packages", c.Active)
	run := filepath.Join(root, "runtime", c.Active)
	if err := os.RemoveAll(run); err != nil {
		return "", err
	}
	if err := CopyTree(base, run); err != nil {
		return "", err
	}
	for _, name := range ListNames {
		b, err := os.ReadFile(filepath.Join(root, "overrides", name))
		if err != nil && !errors.Is(err, os.ErrNotExist) {
			return "", err
		}
		if name == "targets.txt" && errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err := ValidateList(name, b); err != nil {
			return "", err
		}
		if name == "ipset-extra-user.txt" {
			continue
		}
		dir := "lists"
		if name == "targets.txt" {
			dir = "utils"
		}
		// Upstream treats empty files as match-all in some filters.
		if len(strings.TrimSpace(string(b))) == 0 && name != "targets.txt" {
			if strings.HasPrefix(name, "ipset") {
				b = []byte("203.0.113.113/32\n")
			} else {
				b = []byte("domain.example.abc\n")
			}
		}
		if err := AtomicWrite(filepath.Join(run, dir, name), b); err != nil {
			return "", err
		}
	}
	ipset, err := os.ReadFile(filepath.Join(root, "overrides", "ipset-service.txt"))
	if errors.Is(err, os.ErrNotExist) {
		ipset, err = os.ReadFile(filepath.Join(base, "lists", "ipset-all.txt"))
	}
	if err != nil {
		return "", err
	}
	extra, err := ReadList(root, "ipset-extra-user.txt")
	if err != nil {
		return "", err
	}
	ipset = append(append(ipset, '\n'), []byte(extra)...)
	if err := ValidateList("ipset-service.txt", ipset); err != nil {
		return "", err
	}
	if err := AtomicWrite(filepath.Join(run, "lists", "ipset-all.txt.backup"), ipset); err != nil {
		return "", err
	}
	switch c.IPSet {
	case "none":
		ipset = []byte("203.0.113.113/32\n")
	case "any":
		ipset = nil
	case "loaded":
		if len(strings.TrimSpace(string(ipset))) == 0 {
			return "", NewMessageError("error029")
		}
	}
	if err := AtomicWrite(filepath.Join(run, "lists", "ipset-all.txt"), ipset); err != nil {
		return "", err
	}
	game := fmt.Sprintf("mode=%s\ntcp=%s\nudp=%s\n", c.GameMode, c.GameTCP, c.GameUDP)
	if err := AtomicWrite(filepath.Join(run, "utils", "game_filter.enabled"), []byte(game)); err != nil {
		return "", err
	}
	// The GUI owns update checks; do not start the batch script's background check.
	if err := os.Remove(filepath.Join(run, "utils", "check_updates.enabled")); err != nil && !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	for target, source := range map[string]string{"ACTIVE_DISCORD_UDP.bin": c.DiscordFake, "ACTIVE_GAME_UDP.bin": c.GameFake} {
		if source == "" {
			continue
		}
		if filepath.Base(source) != source || !strings.HasSuffix(source, ".bin") {
			return "", NewMessageError("error006")
		}
		b, err := os.ReadFile(filepath.Join(base, "bin", source))
		if err != nil {
			return "", err
		}
		if err := AtomicWrite(filepath.Join(run, "bin", target), b); err != nil {
			return "", err
		}
	}
	return run, nil
}

const hostsBegin = "# BEGIN ZapretDesktop"
const hostsEnd = "# END ZapretDesktop"

func ValidateHosts(data []byte) error {
	if len(data) == 0 || len(data) > 1<<20 {
		return NewMessageError("error030")
	}
	for i, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(strings.SplitN(line, "#", 2)[0])
		if len(fields) == 0 {
			continue
		}
		if len(fields) < 2 || net.ParseIP(fields[0]) == nil {
			return NewMessageError("error031", fmt.Sprint(i+1))
		}
		for _, domain := range fields[1:] {
			if !domainName.MatchString(domain) {
				return NewMessageError("error032", fmt.Sprint(i+1))
			}
		}
	}
	return nil
}

// MergeHosts updates only our marked block and refuses malformed existing markers.
func MergeHosts(existing, additions string) (string, error) {
	if err := ValidateHosts([]byte(additions)); err != nil {
		return "", err
	}
	normalized := strings.ReplaceAll(existing, "\r\n", "\n")
	start, end := -1, -1
	lines := strings.Split(normalized, "\n")
	for i, line := range lines {
		if strings.TrimSpace(line) == hostsBegin {
			if start >= 0 {
				return "", NewMessageError("error033")
			}
			start = i
		}
		if strings.TrimSpace(line) == hostsEnd {
			if end >= 0 {
				return "", NewMessageError("error033")
			}
			end = i
		}
	}
	if (start >= 0) != (end >= 0) || (start >= 0 && start > end) {
		return "", NewMessageError("error034")
	}
	if start >= 0 {
		lines = append(lines[:start], lines[end+1:]...)
	}
	out := strings.TrimRight(strings.Join(lines, "\n"), "\n") + "\n\n" + hostsBegin + "\n" + strings.TrimSpace(additions) + "\n" + hostsEnd + "\n"
	return strings.ReplaceAll(out, "\n", "\r\n"), nil
}
