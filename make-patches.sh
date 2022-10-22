#-------------------------------------------------------------------------------
# Generates local patches based on changes in `node_modules`.
# Patches are applied automatically during npm post-install phase.
#-------------------------------------------------------------------------------

# Patches to be applied to `@webrecorder/wabac`
# - Add `type: module` to package.json
# - Fix some of the imports (append ".js") so we can import the files we need without a build step. 
npx patch-package @webrecorder/wabac --exclude //;
