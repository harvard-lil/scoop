// js2md.js
'use strict'
import jsdoc2md from 'jsdoc-to-markdown'

const jsDocOpts = {
  files: '**/*.js',
  configure: 'jsdoc/config.json'
}

/* get template data */
const templateData = await jsdoc2md.getTemplateData(jsDocOpts)

// sort template data
// see: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/sort
templateData.sort(function (a, b) {
  const nameA = a.longname.toUpperCase() // ignore upper and lowercase
  const nameB = b.longname.toUpperCase() // ignore upper and lowercase
  if (nameA < nameB) {
    return -1
  }
  if (nameA > nameB) {
    return 1
  }

  return 0 // names must be equal
})

const renderOpts = {
  data: templateData,
  'example-lang': 'js',
  'member-index-format': 'list'
}

const output = await jsdoc2md.render(renderOpts)
process.stdout.write(output)
process.exit(0)
