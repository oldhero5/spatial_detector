# Release Management Guide

This guide explains how to manage releases for the Spatial Detector project, including maintaining changelogs and release notes.

## Understanding Release Files

This project uses two main files for documenting releases:

1. **CHANGELOG.md** - A chronological list of all notable changes for each version
2. **RELEASE_NOTES.md** - A user-friendly description of the current release

## Release Process

### 1. Update Your Code

Make your changes to the codebase as normal.

### 2. Document Changes in CHANGELOG.md

As you work, document significant changes in `CHANGELOG.md` under the appropriate section:
- **Added** - New features
- **Changed** - Changes to existing functionality
- **Fixed** - Bug fixes
- **Removed** - Features that were removed
- **Security** - Security fixes

### 3. Create a New Release

When you're ready to release, use the version bump script:

```bash
# Create a new version with basic changelog
python version_bump.py patch  # or minor/major

# Create a new version and edit notes
python version_bump.py patch --notes
```

This script will:
1. Increase the version number
2. Update version references in pyproject.toml and __init__.py
3. Add a new section to CHANGELOG.md
4. Create a template RELEASE_NOTES.md file
5. Create a git tag for the new version

### 4. Edit Release Notes

The `RELEASE_NOTES.md` file should be user-friendly and highlight key improvements. The template includes:

- Highlights - The most important changes
- Features - New functionality
- Improvements - Enhancements to existing features
- Bug Fixes - Issues that were resolved
- Installation & Usage - How to install and use the new version
- What's Next - Future plans

### 5. Push the Release

```bash
git push && git push origin v0.1.0  # Replace with your version
```

### 6. Review GitHub Actions

The GitHub Actions workflow will automatically:
1. Build your package
2. Deploy to PyPI
3. Create a GitHub Release including:
   - Your RELEASE_NOTES.md content
   - Changes from CHANGELOG.md
   - Links to download the package

### 7. Verify on PyPI

Check that your package appears on PyPI with the correct version:
```
https://pypi.org/project/spatial-detector/
```

## Best Practices

1. **Keep changelog entries concise** - Brief, meaningful descriptions of changes
2. **Reference issues and PRs** - Include GitHub issue/PR numbers (e.g., "#42")
3. **Update as you go** - Document changes when you make them, not at release time
4. **Use user-friendly language** in release notes - Avoid technical jargon
5. **Follow semantic versioning**:
   - MAJOR: Breaking changes
   - MINOR: New features (backwards compatible)
   - PATCH: Bug fixes (backwards compatible)