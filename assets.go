package main

import "embed"

//go:embed all:frontend/dist
var assets embed.FS

var Version = "0.2.0-dev"
