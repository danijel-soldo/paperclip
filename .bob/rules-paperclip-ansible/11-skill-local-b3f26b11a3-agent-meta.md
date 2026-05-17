# Skill: local/b3f26b11a3/agent-meta

---
required: true
---

# Knowledge Contribution

When you discover something non-obvious about this codebase or project — a gotcha,
a pattern that worked, a decision with non-obvious rationale, a constraint that
must not be violated — document it in your issue comment using this format:

```
[LEARNING]: <category> — <concise description>
<2-5 lines of detail. Link to relevant issue if possible.>
```

**Example:**
```
[LEARNING]: db — users table uses soft deletes
The `users` table has a `deleted_at` column. All queries must include
`WHERE deleted_at IS NULL` or results will include deleted users.
```

**Categories:** `db`, `api`, `architecture`, `convention`, `pattern`, `decision`, `gotcha`

The CTO agent synthesizes these weekly into `skills/project-learnings/`. Your tagging
is what makes the knowledge base grow — be generous with learnings.

