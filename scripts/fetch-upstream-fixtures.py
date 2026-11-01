"""CI ONLY: retrieve upstream strategy TEXT, never extract or execute binaries.

The complete ZIP is checked in memory against the official asset's SHA-256.
Only general*.bat entries are written to the requested temporary directory.
"""
import hashlib
import io
import json
import os
import pathlib
import sys
import urllib.request
import zipfile


def fetch(url):
    headers = {"User-Agent": "ZapretDesktop-Compatibility/0.1"}
    if os.environ.get("GITHUB_TOKEN") and url.startswith("https://api.github.com/"):
        headers["Authorization"] = "Bearer " + os.environ["GITHUB_TOKEN"]
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=60) as response:
        data = response.read((64 << 20) + 1)
    if len(data) > 64 << 20:
        raise RuntimeError("upstream response exceeds size limit")
    return data


release = json.loads(fetch("https://api.github.com/repos/Flowseal/zapret-discord-youtube/releases/latest"))
asset = next(a for a in release["assets"] if a["name"].startswith("zapret-discord-youtube-") and a["name"].endswith(".zip"))
expected_prefix = "https://github.com/Flowseal/zapret-discord-youtube/releases/download/"
if not asset["browser_download_url"].startswith(expected_prefix):
    raise RuntimeError("unexpected asset host or path")
data = fetch(asset["browser_download_url"])
if asset.get("digest") != "sha256:" + hashlib.sha256(data).hexdigest():
    raise RuntimeError("official release checksum missing or mismatched")
dest = pathlib.Path(sys.argv[1])
dest.mkdir(parents=True, exist_ok=True)
count = 0
with zipfile.ZipFile(io.BytesIO(data)) as archive:
    for info in archive.infolist():
        name = pathlib.PurePosixPath(info.filename.replace("\\", "/")).name
        if name.lower().startswith("general") and name.lower().endswith(".bat"):
            if info.file_size > 1 << 20 or (dest / name).exists():
                raise RuntimeError("invalid strategy entry")
            (dest / name).write_bytes(archive.read(info))
            count += 1
print(f"Official release {release['tag_name']}: {count} text strategies; no engine extracted or executed")
if not count:
    raise RuntimeError("release has no strategies")
