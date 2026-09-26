# Security Policy

## Supported versions

open-doc is pre-1.0. Only the latest published version of each package receives security fixes:

| Package | Supported |
| --- | --- |
| `@open-document/core` | latest release |
| `@open-document/cli` | latest release |
| `@open-document/mcp` | latest release |
| older versions | :x: |

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it privately through [GitHub Security Advisories](https://github.com/simonliu-ai-product/open-doc/security/advisories/new), or by email to simonliuyuwei@gmail.com.

Include:

- the affected package and version,
- what an attacker can do,
- a minimal reproduction (a scaffolded project plus the request or file that triggers it is ideal).

You can expect an acknowledgement within 7 days and an assessment within 14 days. If the report is accepted, we'll agree on a disclosure timeline with you, ship a patch release, and credit you in the advisory unless you'd rather stay anonymous. If it's declined, you'll get the reasoning — and you're free to disclose publicly after that.

## Threat model

Worth knowing before you file:

- **The dev server is a local authoring tool, not a hardened service.** `open-doc dev` mounts endpoints that read and write files under the project directory (`/__assets/*`, `/__design`, `/__edit/*`, `/__folders`) and are dev-only (`apply: 'serve'`). They are meant to be bound to localhost and are not exposed by `open-doc build` / `preview`. Bugs that let a request **escape the project directory**, bypass `validateMutationRequest`, or be triggered cross-origin from a page the user merely visits **are in scope**.
- **The MCP server (`open-doc dev --mcp`) is opt-in** and inherits the same trust boundary: it exposes the `ops` layer over Streamable HTTP for a local agent. Path traversal or missing validation in an `ops` function is in scope.
- **Document sources are code.** A document is a React component that the framework executes and the scaffolder's template is authored by you. "A malicious `docs/<id>/index.tsx` can run code" is expected behaviour, not a vulnerability.
- **Exports run in the browser.** PDF/HTML export serializes the rendered DOM. Report anything that lets an exported artifact reach outside the project or leak files that weren't part of the document.
