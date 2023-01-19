import jsdoc2md from 'jsdoc-to-markdown'

const jsDocOpts = {
  files: '**/*.js',
  configure: 'jsdoc/config.json'
}

const data = await jsdoc2md.getTemplateData(jsDocOpts)
data.sort((a, b) => a.longname.localeCompare(b.longname))

const renderOpts = {
  data,
  plugin: '@godaddy/dmd'
}

const output = await jsdoc2md.render(renderOpts)
process.stdout.write(output)
process.exit(0)
