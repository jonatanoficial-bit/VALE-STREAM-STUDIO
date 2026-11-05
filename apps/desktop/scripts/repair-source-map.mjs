// Some pnpm-on-Windows virtual stores omit source-map's legacy root entrypoint
// even though its bundled equivalent exists. electron-builder's current
// source-map-support dependency still requires that entrypoint. Repair only
// the generated dependency cache, and only when the file is absent.
import { access, copyFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'

const packageRoot = resolve(process.cwd(), '../../node_modules/.pnpm/source-map@0.6.1/node_modules/source-map')
const target = resolve(packageRoot, 'source-map.js')
const bundled = resolve(packageRoot, 'dist/source-map.js')

try {
  await access(target, constants.F_OK)
} catch {
  await copyFile(bundled, target)
  console.log('Repaired source-map legacy entrypoint for electron-builder.')
}
