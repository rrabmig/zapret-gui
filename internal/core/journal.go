package core

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Journal struct {
	mu    sync.Mutex
	file  *os.File
	lines []string
}

func NewJournal(root string) (*Journal, error) {
	if err := os.MkdirAll(root, 0700); err != nil {
		return nil, err
	}
	path := filepath.Join(root, "app.log")
	if info, err := os.Stat(path); err == nil && info.Size() > 4<<20 {
		if err := os.Rename(path, path+".previous"); err != nil {
			if err := os.Remove(path + ".previous"); err != nil && !os.IsNotExist(err) {
				return nil, err
			}
			if err := os.Rename(path, path+".previous"); err != nil {
				return nil, err
			}
		}
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0600)
	if err != nil {
		return nil, err
	}
	return &Journal{file: f}, nil
}

func (j *Journal) Write(b []byte) (int, error) {
	j.mu.Lock()
	defer j.mu.Unlock()
	for _, line := range strings.Split(strings.TrimSpace(string(b)), "\n") {
		if len(line) > 4096 {
			line = line[:4096] + "…"
		}
		j.lines = append(j.lines, line)
	}
	if len(j.lines) > 250 {
		j.lines = j.lines[len(j.lines)-250:]
	}
	return j.file.Write(b)
}

func (j *Journal) Add(message string) {
	j.Write([]byte(time.Now().Format("15:04:05") + "  " + message + "\n"))
}
func (j *Journal) Lines() []string {
	j.mu.Lock()
	defer j.mu.Unlock()
	return append([]string{}, j.lines...)
}
func (j *Journal) Close() { j.mu.Lock(); defer j.mu.Unlock(); j.file.Close() }
