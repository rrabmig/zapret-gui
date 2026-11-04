//go:build windows

package core

// OpenDirectory opens only an application-owned, already resolved directory.
func OpenDirectory(path string) error { return shellExecute("open", path, "", path) }
