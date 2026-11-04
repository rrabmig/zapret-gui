package core

import "encoding/json"

// Message is a stable GUI code with named values, independent of the UI language.
// OS errors and external utility output remain technical details, never matched by text.
type Message struct {
	Code   string            `json:"code"`
	Params map[string]string `json:"params"`
}

func NewMessage(code string, values ...string) Message {
	params := map[string]string{}
	for i, value := range values {
		params["value"+string(rune('1'+i))] = value
	}
	return Message{Code: code, Params: params}
}

// Error is the explicit JSON envelope transported through Wails' string rejection API.
func (m Message) Error() string                           { b, _ := json.Marshal(m); return string(b) }
func NewMessageError(code string, values ...string) error { return NewMessage(code, values...) }
