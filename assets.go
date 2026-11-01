package main

import "embed"

//go:embed frontend/index.html frontend/style.css frontend/app.js
var assets embed.FS

var Version = "0.1.0-dev"
