//go:build !windows

package core

func StartGUIUpdate(root string, state GUIUpdate, language string) error {
	return NewMessageError("guiUpdateManual")
}
func RunGUIUpdate(name string) error { return NewMessageError("guiUpdateManual") }
