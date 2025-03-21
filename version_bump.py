#!/usr/bin/env python3
"""
Version bumper script for spatial-detector.
Usage:
  python version_bump.py [major|minor|patch] [--notes]

Example:
  python version_bump.py patch  # Updates from 0.1.0 to 0.1.1
  python version_bump.py minor  # Updates from 0.1.0 to 0.2.0
  python version_bump.py major  # Updates from 0.1.0 to 1.0.0
  python version_bump.py patch --notes  # Also opens editor for release notes
"""

import re
import sys
import os
import subprocess
import datetime
from pathlib import Path

def get_current_version():
    """Extract version from pyproject.toml."""
    pyproject_path = Path("pyproject.toml")
    if not pyproject_path.exists():
        print("Error: pyproject.toml not found")
        sys.exit(1)
        
    content = pyproject_path.read_text()
    version_match = re.search(r'version = "(\d+\.\d+\.\d+)"', content)
    if not version_match:
        print("Error: Could not find version in pyproject.toml")
        sys.exit(1)
        
    return version_match.group(1)

def bump_version(current_version, bump_type):
    """Bump version according to semver rules."""
    major, minor, patch = map(int, current_version.split('.'))
    
    if bump_type == "major":
        return f"{major + 1}.0.0"
    elif bump_type == "minor":
        return f"{major}.{minor + 1}.0"
    elif bump_type == "patch":
        return f"{major}.{minor}.{patch + 1}"
    else:
        print(f"Error: Unknown bump type: {bump_type}")
        sys.exit(1)

def update_version_in_file(new_version):
    """Update version in pyproject.toml."""
    pyproject_path = Path("pyproject.toml")
    content = pyproject_path.read_text()
    updated_content = re.sub(
        r'version = "\d+\.\d+\.\d+"',
        f'version = "{new_version}"',
        content
    )
    pyproject_path.write_text(updated_content)
    
    # Also update in __init__.py if it has a version
    init_path = Path("spatial_detector/__init__.py")
    if init_path.exists():
        init_content = init_path.read_text()
        updated_init = re.sub(
            r'__version__ = "\d+\.\d+\.\d+"',
            f'__version__ = "{new_version}"',
            init_content
        )
        init_path.write_text(updated_init)

def update_changelog(new_version):
    """Update CHANGELOG.md with new version."""
    changelog_path = Path("CHANGELOG.md")
    if not changelog_path.exists():
        print("Warning: CHANGELOG.md not found, creating it")
        changelog_content = """# Changelog

All notable changes to the Spatial Detector project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

"""
    else:
        changelog_content = changelog_path.read_text()
    
    today = datetime.date.today().isoformat()
    new_version_header = f"\n## [{new_version}] - {today}\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- \n"
    
    # Insert after the header
    pattern = r"(# Changelog.*?adherence to \[Semantic Versioning\].*?\n)"
    if re.search(pattern, changelog_content, re.DOTALL):
        updated_changelog = re.sub(
            pattern,
            r"\1" + new_version_header,
            changelog_content,
            flags=re.DOTALL
        )
    else:
        # If header not found, just prepend
        updated_changelog = new_version_header + changelog_content
    
    changelog_path.write_text(updated_changelog)
    return changelog_path

def create_release_notes(new_version):
    """Create or update release notes file."""
    release_path = Path("RELEASE_NOTES.md")
    
    # Create template release notes
    release_content = f"""# Release Notes - Spatial Detector v{new_version}

## 🌟 Highlights

- 

## 🛠️ Features

- 

## 🔍 Improvements

- 

## 🐛 Bug Fixes

- 

## 📋 Installation & Usage

```bash
uv pip install spatial-detector=={new_version}
```

## 🔮 What's Next

- 
"""
    
    release_path.write_text(release_content)
    return release_path

def open_editor(file_path):
    """Open file in default editor."""
    editor = os.environ.get('EDITOR', 'vim')  # Default to vim if EDITOR not set
    try:
        subprocess.run([editor, file_path])
    except Exception as e:
        print(f"Warning: Could not open editor ({e}), please edit {file_path} manually")

def create_git_tag(new_version):
    """Create a git tag for the new version."""
    # Add changes
    subprocess.run(["git", "add", "pyproject.toml", "spatial_detector/__init__.py", 
                    "CHANGELOG.md", "RELEASE_NOTES.md"], check=False)
    
    # Commit changes
    subprocess.run(["git", "commit", "-m", f"Bump version to {new_version}"], check=False)
    
    # Create tag
    subprocess.run(["git", "tag", f"v{new_version}"], check=False)
    
    print(f"Created git tag v{new_version}")
    print("To push changes and trigger release workflow, run:")
    print(f"  git push && git push origin v{new_version}")

def main():
    if len(sys.argv) < 2 or sys.argv[1] not in ["major", "minor", "patch"]:
        print(__doc__)
        sys.exit(1)
        
    bump_type = sys.argv[1]
    edit_notes = "--notes" in sys.argv
    
    current_version = get_current_version()
    new_version = bump_version(current_version, bump_type)
    
    print(f"Bumping version: {current_version} → {new_version}")
    
    # Update version in files
    update_version_in_file(new_version)
    
    # Update changelog
    changelog_path = update_changelog(new_version)
    if edit_notes:
        print(f"Opening CHANGELOG.md for editing...")
        open_editor(changelog_path)
    
    # Create release notes
    release_notes_path = create_release_notes(new_version)
    if edit_notes:
        print(f"Opening RELEASE_NOTES.md for editing...")
        open_editor(release_notes_path)
    
    create_git_tag(new_version)

if __name__ == "__main__":
    main()