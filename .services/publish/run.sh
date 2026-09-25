# Step-by-step publish helper
cd ../../;

# Between releases, dependencies may be pinned to git commits (for example
# portal, while a paired change is unreleased). A published package must not
# depend on git: release the dependency first and depend on that version.
git_dependencies=$(node -e '
  const { dependencies = {} } = require("./package.json")
  for (const [name, spec] of Object.entries(dependencies)) {
    if (/^(github:|git\+|git:|[\w.-]+\/[\w.-]+(#|$))/.test(spec)) console.log(`${name}: ${spec}`)
  }
')
if [ -n "$git_dependencies" ]; then
    echo "These dependencies are git references; release them and depend on a version first:"
    echo "$git_dependencies"
    exit 1
fi

read -p "Run linter (y/n)? " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    if npm run lint ; then
        echo "Lint OK"
    else
        echo "Lint step failed"
    fi
fi

read -p "Run tests (y/n)? " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    if npm run test ; then
        echo "Tests OK"
    else
        echo "Tests failed"
    fi
fi

read -p "Bump version number (y/n)? " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    npm version patch --no-git-tag-version;
fi

read -p "Do a publish dry-run (y/n)? " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    npm publish --dry-run;
fi

read -p "⚠️ Publish on NPM (y/n)? " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    npm publish --access public;
fi

# Between releases, main carries the next patch as a prerelease (x.y.z-dev.0),
# so a build installed from a git commit reports that commit in its version
# (see utils/version.js) instead of claiming to be the release before it.
read -p "Set the next development version (y/n)? " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    npm version prepatch --preid dev --no-git-tag-version;
fi
