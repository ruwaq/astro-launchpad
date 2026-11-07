/**
 * Estampa el service worker con un id derivado del index construido. Así cada
 * deploy usa una caché distinta y `activate` puede borrar las viejas sin
 * mezclar assets de versiones.
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const indexPath = new URL('index.html', dist)
const swPath = new URL('sw.js', dist)

const index = await readFile(indexPath, 'utf8')
const buildId = createHash('sha256').update(index).digest('hex').slice(0, 12)
const sw = await readFile(swPath, 'utf8')
await writeFile(swPath, sw.replaceAll('__BUILD_ID__', buildId))
console.log(`sw.js estampado · floodgate-shell-${buildId}`)
