---
name: ship-release
description: Prepare a release: version bump, changelog, and a deploy checklist.
keywords: release, changelog, version bump, deploy checklist
---

# Ship a release

Load this skill when the task is cutting a release.

1. List what changed since the last version, in the words a user would recognize.
2. Bump the version only after the changelog matches the diff.
3. End with a short deploy checklist: build, migrate, smoke check, rollback.
