const { existsSync } = require('node:fs')
const { resolve, join } = require('node:path')
const { build } = require('../package.json')

const engine = process.env.VALE_SLIDES_ENGINE
const encoder = process.env.VALE_ENCODER_DIR
if (!engine || !existsSync(join(engine, 'program', 'soffice.exe'))) {
  throw new Error('Defina VALE_SLIDES_ENGINE para a pasta do LibreOffice extraído, com program/soffice.exe.')
}
if (!encoder || !existsSync(join(encoder, 'ffmpeg.exe')) || !existsSync(join(encoder, 'LICENSE'))) {
  throw new Error('Execute scripts/prepare-encoder.ps1 e defina VALE_ENCODER_DIR com a pasta retornada.')
}

module.exports = {
  ...build,
  nsis: { ...build.nsis, differentialPackage: false, useZip: true },
  portable: { ...build.portable, useZip: true },
  directories: { ...build.directories, output: resolve(process.env.VALE_RELEASE_DIR ?? '../../release') },
  extraResources: [
    { from: resolve('build/icon.ico'), to: 'brand/app.ico' },
    { from: resolve('../../COMMERCIAL-READINESS.md'), to: 'notices/COMMERCIAL-READINESS.md' },
    { from: resolve('../../LICENSE'), to: 'notices/VALE-LICENSE.txt' },
    { from: resolve(engine), to: 'slides-engine', filter: ['**/*', '!**/*.msi'] },
    { from: resolve(encoder), to: 'encoder', filter: ['ffmpeg.exe', 'LICENSE', 'README.txt'] }
  ]
}
