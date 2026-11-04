package core

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"unicode"
)

type Strategy struct {
	Name       string `json:"name"`
	Label      string `json:"label"`
	Compatible bool   `json:"compatible"`
	Problem    string `json:"problem,omitempty"`
}

func Strategies(root string, config Config) ([]Strategy, error) {
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, err
	}
	out := []Strategy{}
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasPrefix(strings.ToLower(name), "general") || !strings.HasSuffix(strings.ToLower(name), ".bat") {
			continue
		}
		_, err := StrategyArgs(root, name, config)
		s := Strategy{Name: name, Label: strings.TrimSuffix(name, ".bat"), Compatible: err == nil}
		if err != nil {
			s.Problem = err.Error()
		}
		out = append(out, s)
	}
	sort.Slice(out, func(i, j int) bool { return naturalLess(out[i].Name, out[j].Name) })
	return out, nil
}

// Keep ALT2 before ALT10 without a dependency or a hardcoded strategy catalogue.
func naturalLess(a, b string) bool {
	if a == b {
		return false
	}
	re := regexp.MustCompile(`[0-9]+`)
	pad := func(s string) string {
		return re.ReplaceAllStringFunc(s, func(n string) string { return strings.Repeat("0", max(0, 10-len(n))) + n })
	}
	if a == "general.bat" {
		return true
	}
	if b == "general.bat" {
		return false
	}
	return pad(a) < pad(b)
}

// Read only the winws argument block. Never execute, interpolate via cmd.exe,
// or source a downloaded batch file to obtain arguments.
func StrategyArgs(root, name string, config Config) ([]string, error) {
	if filepath.Base(name) != name || strings.ContainsAny(name, `/\:`) || !strings.HasPrefix(strings.ToLower(name), "general") || !strings.HasSuffix(strings.ToLower(name), ".bat") {
		return nil, NewMessageError("error048")
	}
	b, err := os.ReadFile(filepath.Join(root, name))
	if err != nil {
		return nil, err
	}
	text := strings.ReplaceAll(strings.TrimPrefix(string(b), "\ufeff"), "\r\n", "\n")
	text = strings.ReplaceAll(text, "^\n", " ")
	var block string
	for _, line := range strings.Split(text, "\n") {
		i := strings.Index(strings.ToLower(line), `winws.exe"`)
		if i < 0 {
			continue
		}
		if block != "" {
			return nil, NewMessageError("error049")
		}
		block = strings.TrimSpace(line[i+len(`winws.exe"`):])
	}
	if block == "" {
		return nil, NewMessageError("error050")
	}
	// Resolve only variables in the known upstream contract.
	tcp, udp := "12", "12"
	if config.GameMode == "all" || config.GameMode == "tcp" {
		tcp = config.GameTCP
	}
	if config.GameMode == "all" || config.GameMode == "udp" {
		udp = config.GameUDP
	}
	game := tcp
	if config.GameMode == "udp" {
		game = udp
	}
	replacements := map[string]string{
		"bin":           filepath.Join(root, "bin") + string(os.PathSeparator),
		"lists":         filepath.Join(root, "lists") + string(os.PathSeparator),
		"gamefiltertcp": tcp, "gamefilterudp": udp, "gamefilter": game,
	}
	var unresolved bool
	block = regexp.MustCompile(`%[^%]+%`).ReplaceAllStringFunc(block, func(s string) string {
		if v, ok := replacements[strings.ToLower(strings.Trim(s, "%"))]; ok {
			return v
		}
		unresolved = true
		return s
	})
	if unresolved {
		return nil, NewMessageError("error051")
	}
	args, err := splitArguments(block)
	if err != nil {
		return nil, err
	}
	if len(args) == 0 || !strings.HasPrefix(args[0], "--wf-") {
		return nil, NewMessageError("error052")
	}
	return args, nil
}

// Batch uses quotes for grouping but backslashes are literal path separators.
// Shell operators outside quotes fail closed instead of changing their meaning.
func splitArguments(text string) ([]string, error) {
	var args []string
	var b strings.Builder
	quoted := false
	flush := func() {
		if b.Len() > 0 {
			args = append(args, b.String())
			b.Reset()
		}
	}
	runes := []rune(text)
	for i := 0; i < len(runes); i++ {
		r := runes[i]
		switch {
		case r == '"':
			quoted = !quoted
		case !quoted && r == '^' && i+1 < len(runes) && runes[i+1] == '!':
			// FAKE TLS AUTO uses cmd's ^! escape for the literal ! fake.
			b.WriteRune('!')
			i++
		case r == 0 || r == '\r' || r == '\n':
			return nil, NewMessageError("error053")
		case !quoted && strings.ContainsRune("&|<>^", r):
			return nil, NewMessageError("error054", fmt.Sprintf("%c", r))
		case !quoted && unicode.IsSpace(r):
			flush()
		default:
			b.WriteRune(r)
		}
	}
	if quoted {
		return nil, NewMessageError("error055")
	}
	flush()
	return args, nil
}
