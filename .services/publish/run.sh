# Step-by-step publish helper
cd ../../;

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
