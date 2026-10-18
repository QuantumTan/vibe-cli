---
trigger: model_decision
description: Load when editing filesystem links, NTFS junctions, Obsidian vault integration, hardware VRAM detection, or doctor checks.
globs:
  - "src/commands/link.ts"
  - "src/commands/doctor.ts"
  - "src/utils/fs-link.ts"
  - "src/utils/hardware-probe.ts"
---

# Rule 03: Cross-Platform Linker, Obsidian-Optional Mode & Hardware Probes

## 3-Tier Memory Linker (`src/utils/fs-link.ts`)
- **Windows Local NTFS** (`process.platform === 'win32'`): Use `fs.symlinkSync(target, linkPath, 'junction')`.
- **POSIX** (`darwin` / `linux`): Use `fs.symlinkSync(target, linkPath, 'dir')`.
- **Portable Fallback** (`--portable` or on `EPERM` / `EXDEV` / `EINVAL`):
  - Catch cross-filesystem errors (WSL2 `/mnt/c/`, exFAT USB drives, GitHub Codespaces) without crashing.
  - Create `.vibe/memory/` inside the project root and sync modified `.md` files by mtime/SHA-256 on scan and wrapup.

## Obsidian-Optional Output (`--no-obsidian`)
When `--no-obsidian` is active (or no vault path exists), emit standard relative Markdown links (`[file](./file.md)`) and fenced mermaid code blocks instead of `[[wikilinks]]` or `.canvas` JSON files.

## Hardware-Aware Local Model Matrix (`src/utils/hardware-probe.ts`)
- Probe total/free RAM via `os.totalmem()` / `os.freemem()`.
- Probe VRAM with a $1500\text{ ms}$ timeout via `nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits`, falling back to PowerShell `Win32_VideoController` on Windows or `sysctl hw.memsize` on macOS.
- **Recommendations for `vibe doctor --student`**:
  - $\text{VRAM} < 4\text{ GB}$ and $\text{RAM} \le 8\text{ GB}$: Cloud free tiers + optional `qwen2.5-coder:1.5b`.
  - $\text{VRAM} \approx 4\text{ GB}$ (e.g., mobile RTX 3050): `qwen2.5-coder:3b-instruct-q4_K_M` or `7b-instruct-q4_K_M` with hard `num_ctx: 4096` cap.
  - $\text{VRAM} \ge 8\text{ GB}$: `qwen2.5-coder:7b` or `14b`.
