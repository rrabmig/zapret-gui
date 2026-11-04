# Third-party components

Zapret Desktop is an independent GUI, not an official Flowseal release. The GUI
repository and its application archives do not contain zapret or WinDivert
binaries. An official release is downloaded separately on the user's request.

- [Flowseal/zapret-discord-youtube](https://github.com/Flowseal/zapret-discord-youtube):
  MIT, Copyright (c) 2024–2026 Flowseal. The repository's license is available
  [here](https://github.com/Flowseal/zapret-discord-youtube/blob/main/LICENSE.txt).
  Files and notices included in the official release ZIP are retained in the
  downloaded package and working copy. The ZIP may omit the repository license;
  the downloader does not require a particular license filename or alter the ZIP.
- [bol-van/zapret](https://github.com/bol-van/zapret): MIT,
  Copyright (c) 2016–2026 bol-van. Flowseal includes its Windows binaries.
- [WinDivert](https://github.com/basil00/WinDivert): distributed by upstream
  under the user's choice of LGPLv3 or GPLv2. Its terms apply to those binaries;
  this GUI's MIT license does not replace them. Source and license terms are
  available from the WinDivert repository and the official package notices.
- [Wails v2](https://github.com/wailsapp/wails): MIT. The Go module files pin
  the GUI framework and dependencies; each dependency retains its own license.
- [golang.org/x/sys](https://pkg.go.dev/golang.org/x/sys): BSD-3-Clause.

The strategy contract and minimal inert test fixtures describe upstream's
argument format. Normal execution does not modify or embed its batch code.
Future redistribution of engine binaries must retain their notices and comply
with their own license terms.

The UI uses system fonts. No corporate font files, report CSS, report data, or
client scripts are included. Visual similarity follows the user's requested
reference, with independently written markup and styles.

Frontend runtime dependencies (exact versions in `frontend/package-lock.json`):

- [React and React DOM](https://github.com/facebook/react): MIT,
  Copyright (c) Meta Platforms, Inc. and affiliates.
- [Radix Icons](https://github.com/radix-ui/icons): MIT,
  Copyright (c) 2022 WorkOS.

Vite, TypeScript, Storybook and Playwright are development/build dependencies;
Storybook and fixture code are excluded from the shipped frontend. Design craft
references from [Stageshow](https://github.com/benjitaylor/skills) were consulted;
its kit, examples and other assets are not copied into the application.

## MIT terms for the frontend runtime dependencies

MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.
Copyright (c) 2022 WorkOS.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
