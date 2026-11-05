package core

import "testing"

func TestEngineOwnership(t *testing.T) {
	for _, v := range []struct {
		name                string
		pid, child, service uint32
		foreign             bool
	}{
		{"winws.exe", 12, 12, 0, false}, {"WINWS.EXE", 14, 0, 14, false}, {"winws.exe", 16, 12, 14, true}, {"other.exe", 16, 12, 14, false}, {"winws.exe", 12, 0, 0, true},
	} {
		if got := IsForeignEngine(v.name, v.pid, v.child, v.service); got != v.foreign {
			t.Fatalf("%+v = %v", v, got)
		}
	}
}
