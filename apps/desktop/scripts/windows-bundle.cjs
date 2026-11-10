const { existsSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { build } = require('../package.json')

const engine = process.env.VALE_SLIDES_ENGINE
if (!engine || !existsSync(join(engine, 'program', 'soffice.exe'))) {
  throw new Error('Defina VALE_SLIDES_ENGINE para a pasta do LibreOffice extraído, com program/soffice.exe.')
}

module.exports = {
  ...build,
  nsis: { ...build.nsis, differentialPackage: false, useZip: true },
  portable: { ...build.portable, useZip: true },
  directories: { ...build.directories, output: resolve(process.env.VALE_RELEASE_DIR ?? '../../release') },
  extraResources: [{ from: resolve(engine), to: 'slides-engine', filter: ['**/*', '!**/*.msi'] }]
}
