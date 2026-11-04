package core

import (
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type LogEntry struct {
	Time    string   `json:"time,omitempty"`
	Text    string   `json:"text,omitempty"`
	Message *Message `json:"message,omitempty"`
}

type Journal struct {
	mu    sync.Mutex
	file  *os.File
	lines []LogEntry
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
		j.lines = append(j.lines, LogEntry{Text: line})
	}
	if len(j.lines) > 250 {
		j.lines = j.lines[len(j.lines)-250:]
	}
	return j.file.Write(b)
}

func (j *Journal) Add(message string) {
	j.Write([]byte(time.Now().Format("15:04:05") + "  " + message + "\n"))
}

// AddMessage accepts only owned events. Write (external process output) always stays raw.
func (j *Journal) AddMessage(message Message) {
	j.mu.Lock()
	defer j.mu.Unlock()
	at := time.Now().Format("15:04:05")
	j.lines = append(j.lines, LogEntry{Time: at, Message: &message})
	if len(j.lines) > 250 {
		j.lines = j.lines[len(j.lines)-250:]
	}
	j.file.Write([]byte(at + "  " + message.Error() + "\n"))
}
func (j *Journal) AddError(err error) {
	var message Message
	if errors.As(err, &message) {
		j.AddMessage(message)
	} else {
		j.Add(err.Error())
	}
}
func WriteMessage(output io.Writer, message Message) {
	if journal, ok := output.(interface{ AddMessage(Message) }); ok {
		journal.AddMessage(message)
	} else {
		io.WriteString(output, message.Error()+"\n")
	}
}
func (j *Journal) Lines() []LogEntry {
	j.mu.Lock()
	defer j.mu.Unlock()
	return append([]LogEntry{}, j.lines...)
}
func (j *Journal) Close() { j.mu.Lock(); defer j.mu.Unlock(); j.file.Close() }
