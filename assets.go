package main

import "embed"

//go:embed all:frontend/dist
var assets embed.FS

var Version = "0.1.0-dev"
