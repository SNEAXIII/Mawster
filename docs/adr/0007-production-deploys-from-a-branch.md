# Production deploys from a branch, not from a tag

Merging the release pull request tags `vX.Y.Z`, writes the CHANGELOG and bumps the version. It
ships nothing. A version reaches production only when `main` is promoted onto the `release`
branch, and staging only when `main` is promoted onto `staging`. The push on one of those two
branches is what builds the five images and runs the swarm deploy — no workflow listens on tags.

Deploying on the tag was the obvious alternative, and it collapses two statements into one: a tag
says *this version exists*, a branch tip says *this version runs*. Keeping them apart buys a
manual gate. Several tagged versions can ship in a single deploy, and a version can sit published
but undeployed while something is verified — 1.8.2 tagged with 1.8.0 in production is a normal
state here, not an incident. Holding a release back costs nothing, whereas retracting a tag is
public and messy.

## Consequences

The production job refuses content that is not exactly the last tag (`released != true`). It
compares *trees*, not commits, because promotion is a merge commit: `release` is never *on* the
tag even when it carries identical content. The release pull request must therefore be merged
before promoting, otherwise the images would ship under the previous version number.

Staging carries no such requirement: it deploys whatever `main` holds, tagged or not, and its
images are named after `git describe` (`staging-1.8.2-3-gabc123`). Staging is where content is
tested *before* it earns a tag — requiring a tag there would make staging and production ship the
same thing, leaving nothing to test.

What runs in production is not readable from the tag list: it is the tip of `release`, and its
version is the last tag reachable from there. `/release-pr` is the only supported way to move
that tip.

Reversing this means moving the gate somewhere else — tag-triggered workflows, an environment
approval, or both — and reworking the image tag scheme, the staging path and the swarm deploy
that all key off the branch name.
