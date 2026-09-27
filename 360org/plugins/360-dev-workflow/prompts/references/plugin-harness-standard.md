# AIAC Plugin Harness Standard

Rule: **everything is a plugin harness**.

Any new AIAC development standard, skill, command, hook, agent, connector, workflow, reference guide, or reusable prompt must be packaged as a plug-and-play plugin under:

```text
/Volumes/DATA/DEV/aiac/360org/plugins/<plugin-name>/
```

Do not create standalone source-of-truth skills under runtime folders such as `.claude/skills/*`. Runtime skill entries may exist only as generated shims, symlinks, or install artifacts that point back to the plugin source.

## Required plugin shape

```text
360org/plugins/<plugin-name>/
├── plugin.json
├── README.md
├── prompts/
│   ├── SKILL.md
│   └── references/
│       └── <topic>.md
├── hooks/          # optional
├── connectors/     # optional
├── scripts/        # optional
└── tests/          # optional, when behavior is testable
```

## Hard rules

1. **Single source of truth**: one canonical reference per workflow/standard. Other files link to it; they do not duplicate the full procedure.
2. **Plug-and-play installability**: a plugin can be copied/installed independently and still carry its prompts, references, hooks, connectors, and scripts.
3. **Harness-first**: design the plugin as a local harness package, like DeepSeek Harness: explicit entrypoint, predictable folders, no hidden dependency on a user-specific runtime path.
4. **No runtime-source drift**: never treat `/Volumes/DATA/ENV/.claude/skills/*`, `~/.claude/skills/*`, or IDE-generated folders as source. They are runtime/cache/symlink targets only.
5. **No duplicate standalone skill**: if a workflow belongs to an existing plugin, add it under that plugin's `prompts/references/` and link from `prompts/SKILL.md`.
6. **Manifest-safe**: when editing Claude plugin manifests, follow `/Volumes/DATA/DEV/aiac/.claude-plugin/PLUGIN_SCHEMA_NOTES.md`.

## Decision ladder

- Existing plugin covers it? Add a reference/section there.
- New domain? Create a new `360org/plugins/<plugin-name>/` plugin.
- Need slash command/runtime exposure? Generate a thin shim pointing to the plugin, not a second copy.
