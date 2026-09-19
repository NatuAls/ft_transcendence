## Card

<!-- Add the Trello card identifier and link. Example: DBCN-02. -->

## Objective

<!-- Explain what this pull request is intended to achieve. -->

## Changes

<!-- Summarize the implemented changes. -->

-

## Files changed

<!-- List the main files or areas changed and why. -->

-

## Tests / checks

<!--
CI runs all of these automatically and blocks the merge if any of them fails
(check `ci-success`). Tick what you also ran locally before pushing.
-->

- [ ] `npm run format:check`
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test --workspace=apps/api` (unit)
- [ ] `npm run test:integration --workspace=apps/api` (needs `make up-dev`)

## Documentation

<!-- Describe the documentation added or updated. Write "None" if it was not required. -->

## Known limitations

<!-- Describe known limitations. Write "None" if there are none. -->

## AI usage

<!-- State whether AI was used, for what purpose, and how its output was reviewed. Write "None" if it was not used. -->

## Merge discipline

<!--
These rules replace what branch rulesets would enforce and cannot be skipped.
Merges that reintroduce lint/format/test failures, or that overwrite files
owned by someone else, are reverted.
-->

- [ ] I merged the **target branch into this branch first** (`git merge origin/develop`), resolved conflicts **here**, and CI is green on the result.
- [ ] I did **not** resolve conflicts with a wholesale "take mine / take theirs" (`git checkout <branch> -- <dir>`); every conflict was read and resolved by hand.
- [ ] Every file listed in `.github/CODEOWNERS` that this PR touches has an approval from its owner.
- [ ] The approval is on the **last** commit of the PR (pushes after an approval need a new one).
- [ ] No `--force` was used on a shared branch.

## Checklist

- [ ] The changes match the card scope.
- [ ] The complete diff was reviewed.
- [ ] Documentation and limitations are recorded.
- [ ] AI usage is disclosed.
- [ ] No unrelated or sensitive information is included.
