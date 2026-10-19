#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C.UTF-8

mode=commit
if [[ "$#" -eq 1 && "$1" == --title ]]; then
  mode=title
elif [[ "$#" -ne 0 ]]; then
  printf '%s\n' 'usage: check-msg.sh [--title] < message' >&2
  exit 2
fi

message=$(git stripspace)
header=${message%%$'\n'*}
if [[ "$mode" == commit ]]; then
  stripped=$(printf '%s\n' "$message" | git stripspace --strip-comments)
  if [[ "$header" != "${stripped%%$'\n'*}" ]]; then
    printf '%s\n' 'commit-msg: header changes when Git removes comments' >&2
    exit 1
  fi
  case "$header" in
    'Merge branch '*|'Merge remote-tracking branch '*|'Merge tag '*|'Merge pull request '*|'Merge commit '*|'Revert "'*|'Reapply "'*|'fixup! '*|'squash! '*|'amend! '*) exit 0 ;;
  esac
fi

pattern='^(feat|fix|docs|refactor|test|chore|perf|build|ci|style|revert)(\([^)]+\))?!?: .+'
if [[ ! "$header" =~ $pattern ]]; then
  printf '%s\n' 'commit-msg: expected a Conventional Commits header' >&2
  exit 1
fi
if [[ "${#header}" -gt 100 ]]; then
  printf '%s\n' 'commit-msg: header exceeds 100 characters' >&2
  exit 1
fi
if [[ "$message" == *$'\n'* ]]; then
  remainder=${message#*$'\n'}
  if [[ -n "${remainder%%$'\n'*}" ]]; then
    printf '%s\n' 'commit-msg: second line must be empty' >&2
    exit 1
  fi
fi
