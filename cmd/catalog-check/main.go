// catalog-check inspects text files only. It never starts an engine or probes a site.
package main

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/rrabmig/zapret-desktop/internal/core"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: catalog-check <official-release-directory>")
		os.Exit(2)
	}
	strategies, err := core.Strategies(os.Args[1], core.DefaultConfig())
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	json.NewEncoder(os.Stdout).Encode(strategies)
	if len(strategies) == 0 {
		fmt.Fprintln(os.Stderr, "no strategies found")
		os.Exit(1)
	}
	for _, strategy := range strategies {
		if !strategy.Compatible {
			fmt.Fprintln(os.Stderr, strategy.Name+": "+strategy.Problem)
			os.Exit(1)
		}
	}
}
