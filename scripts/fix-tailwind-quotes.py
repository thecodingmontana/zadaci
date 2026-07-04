#!/usr/bin/env python3
"""
Fix prettier-plugin-tailwindcss quote escaping corruption.

The plugin re-serializes class strings with Tailwind arbitrary-value selectors
like [class*='size-'] without preserving the backslash-escaped single quotes
inside single-quoted JavaScript strings. This script restores the escaping.

Handles two patterns:
  [class*='X-']   → [class*=\'X-\']   (both quotes unescaped)
  [class*=\'X-']   → [class*=\'X-\']   (only closing quote unescaped)
"""

import glob
import re

P1 = re.compile(r"\[class\*='([a-zA-Z]+)-'\]")
P2 = re.compile(r"\[class\*=\\'([a-zA-Z]+)-'\]")
REPLACEMENT = r"[class*=\\'\1-\\']"


def fix_file(filepath):
    with open(filepath) as f:
        content = f.read()

    original = content
    content = P1.sub(REPLACEMENT, content)
    content = P2.sub(REPLACEMENT, content)

    if content != original:
        with open(filepath, "w") as f:
            f.write(content)
        return True
    return False


def main():
    vue_files = glob.glob("**/*.vue", recursive=True)
    fixed = [f for f in sorted(vue_files) if fix_file(f)]
    if fixed:
        for f in fixed:
            print(f"Fixed: {f}")
        print(f"\nFixed {len(fixed)} files")
    else:
        print("No files needed fixing")


if __name__ == "__main__":
    main()
