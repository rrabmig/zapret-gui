package core

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// Config belongs to the GUI. Official release files are never modified.
type Config struct {
	Schema        int    `json:"schema"`
	Active        string `json:"active"`
	Previous      string `json:"previous"`
	Strategy      string `json:"strategy"`
	EngineAllowed bool   `json:"engineAllowed"`
	AutoCheck     bool   `json:"autoCheck"`
	Language      string `json:"language"`
	Theme         string `json:"theme"`
	GameMode      string `json:"gameMode"`
	GameTCP       string `json:"gameTCP"`
	GameUDP       string `json:"gameUDP"`
	IPSet         string `json:"ipset"`
	DiscordFake   string `json:"discordFake"`
	GameFake      string `json:"gameFake"`
}

var safeID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$`)

func DefaultConfig() Config {
	return Config{Schema: 1, Strategy: "general.bat", Theme: "system", Language: "ru", GameMode: "disabled", GameTCP: "1024-65535", GameUDP: "1024-65535", IPSet: "loaded"}
}

func LoadConfig(root string) (Config, error) {
	c := DefaultConfig()
	b, err := os.ReadFile(filepath.Join(root, "config.json"))
	if errors.Is(err, os.ErrNotExist) {
		return c, nil
	}
	if err != nil {
		return c, err
	}
	if err := json.Unmarshal(b, &c); err != nil {
		return c, NewMessageError("error013", fmt.Sprint(err))
	}
	c.Language = NormalizeLanguage(c.Language)
	return c, c.Validate()
}

func (c Config) Validate() error {
	if c.Schema != 1 {
		return NewMessageError("error014")
	}
	for _, id := range []string{c.Active, c.Previous} {
		if id != "" && !safeID.MatchString(id) {
			return NewMessageError("error015")
		}
	}
	if c.Theme != "system" && c.Theme != "light" && c.Theme != "dark" {
		return NewMessageError("error016")
	}
	if c.GameMode != "disabled" && c.GameMode != "all" && c.GameMode != "tcp" && c.GameMode != "udp" {
		return NewMessageError("error017")
	}
	if c.IPSet != "loaded" && c.IPSet != "none" && c.IPSet != "any" {
		return NewMessageError("error018")
	}
	if err := ValidatePorts(c.GameTCP); err != nil {
		return err
	}
	if err := ValidatePorts(c.GameUDP); err != nil {
		return err
	}
	for _, name := range []string{c.Strategy, c.DiscordFake, c.GameFake} {
		if name != "" && (filepath.Base(name) != name || strings.ContainsAny(name, `/\:`) || strings.ContainsAny(name, "\x00\r\n")) {
			return NewMessageError("error019")
		}
	}
	return nil
}

func ValidatePorts(value string) error {
	if len(value) == 0 || len(value) > 512 {
		return NewMessageError("error020")
	}
	for _, group := range strings.Split(value, ",") {
		parts := strings.Split(group, "-")
		if len(parts) > 2 {
			return NewMessageError("error021", fmt.Sprint(group))
		}
		last := 0
		for _, part := range parts {
			if part == "" || strings.Trim(part, "0123456789") != "" {
				return NewMessageError("error022", fmt.Sprint(part))
			}
			n, err := strconv.Atoi(part)
			if err != nil || n < 1 || n > 65535 || n < last {
				return NewMessageError("error021", fmt.Sprint(group))
			}
			last = n
		}
	}
	return nil
}

func NormalizeLanguage(value string) string {
	if value == "en" {
		return "en"
	}
	return "ru"
}

func SaveConfig(root string, c Config) error {
	c.Language = NormalizeLanguage(c.Language)
	if err := c.Validate(); err != nil {
		return err
	}
	b, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}
	return AtomicWrite(filepath.Join(root, "config.json"), append(b, '\n'))
}

// AtomicWrite keeps the previous file on a failed write. Rename replaces a file
// atomically on Unix and uses Go's replace-file implementation on Windows.
func AtomicWrite(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(path), ".write-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if _, err = f.Write(data); err != nil {
		f.Close()
		return err
	}
	if err = f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}
