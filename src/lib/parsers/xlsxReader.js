// Minimal, dependency-free .xlsx reader — no new package, same spirit as this codebase's other
// from-scratch binary work (the CSV tokenizer, the PNG encoder). An .xlsx is a ZIP file holding
// XML parts; we only need two of them (the shared-string table and the first worksheet), so we
// read the ZIP central directory ourselves and inflate just those two entries with the browser's
// built-in DecompressionStream — no bundled zip/xlsx library required.
const EOCD_SIGNATURE = 0x06054b50
const CENTRAL_DIR_SIGNATURE = 0x02014b50
const LOCAL_HEADER_SIGNATURE = 0x04034b50

function findEndOfCentralDirectory(view) {
  // The EOCD record is near the end of the file; scan backward for its signature (it can be
  // preceded by a variable-length comment, so a fixed offset from the end isn't reliable).
  for (let i = view.byteLength - 22; i >= 0; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i
  }
  throw new Error('Not a valid .xlsx file (no ZIP end-of-central-directory record found).')
}

function readCentralDirectory(buffer) {
  const view = new DataView(buffer)
  const eocdOffset = findEndOfCentralDirectory(view)
  const entryCount = view.getUint16(eocdOffset + 10, true)
  let offset = view.getUint32(eocdOffset + 16, true)

  const entries = new Map()
  const decoder = new TextDecoder('utf-8')

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_DIR_SIGNATURE) break
    const compressionMethod = view.getUint16(offset + 10, true)
    const compressedSize = view.getUint32(offset + 20, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const localHeaderOffset = view.getUint32(offset + 42, true)
    const nameBytes = new Uint8Array(buffer, offset + 46, nameLength)
    const name = decoder.decode(nameBytes)

    entries.set(name, { compressionMethod, compressedSize, localHeaderOffset })
    offset += 46 + nameLength + extraLength + commentLength
  }

  return entries
}

async function inflateRaw(bytes) {
  const source = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    }
  })
  const inflated = await new Response(source.pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()
  return new Uint8Array(inflated)
}

async function readEntryText(buffer, entries, name) {
  const entry = entries.get(name)
  if (!entry) return null

  const view = new DataView(buffer)
  const { localHeaderOffset, compressionMethod, compressedSize } = entry
  if (view.getUint32(localHeaderOffset, true) !== LOCAL_HEADER_SIGNATURE) {
    throw new Error(`Corrupt .xlsx: local file header missing for ${name}.`)
  }
  const nameLength = view.getUint16(localHeaderOffset + 26, true)
  const extraLength = view.getUint16(localHeaderOffset + 28, true)
  const dataStart = localHeaderOffset + 30 + nameLength + extraLength
  const compressedBytes = new Uint8Array(buffer, dataStart, compressedSize)

  const bytes = compressionMethod === 0 ? compressedBytes : await inflateRaw(compressedBytes)
  return new TextDecoder('utf-8').decode(bytes)
}

// Shared strings are referenced by index from numbered cells (t="s"). Each <si> can hold plain
// text directly or several rich-text <r><t> runs that need concatenating.
function parseSharedStrings(xml) {
  if (!xml) return []
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.getElementsByTagName('si')).map((si) => {
    const runs = si.getElementsByTagName('t')
    return Array.from(runs).map((t) => t.textContent).join('')
  })
}

function columnLetterToIndex(cellRef) {
  const letters = cellRef.match(/^[A-Z]+/)?.[0] || 'A'
  let index = 0
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64)
  return index - 1
}

function parseSheetRows(xml, sharedStrings) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const rowEls = Array.from(doc.getElementsByTagName('row'))

  return rowEls.map((rowEl) => {
    const cells = Array.from(rowEl.getElementsByTagName('c'))
    const row = []
    cells.forEach((cellEl) => {
      const ref = cellEl.getAttribute('r') || ''
      const col = columnLetterToIndex(ref)
      const type = cellEl.getAttribute('t')
      const valueEl = cellEl.getElementsByTagName('v')[0]
      let value = ''
      if (type === 's') {
        value = sharedStrings[Number(valueEl?.textContent)] ?? ''
      } else if (type === 'inlineStr') {
        value = cellEl.getElementsByTagName('t')[0]?.textContent ?? ''
      } else {
        value = valueEl?.textContent ?? ''
      }
      row[col] = value
    })
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = ''
    return row
  })
}

// Reads the first worksheet of an .xlsx file into an array of row arrays of cell strings
// (numeric cells come through as their literal text — this format's dates/amounts are already
// stored as plain text, so no numeric/date-serial conversion is needed).
export async function readXlsxRows(arrayBuffer) {
  const entries = readCentralDirectory(arrayBuffer)
  const sheetName =
    Array.from(entries.keys()).find((name) => /^xl\/worksheets\/sheet1\.xml$/i.test(name)) ||
    Array.from(entries.keys()).find((name) => /^xl\/worksheets\/.+\.xml$/i.test(name))
  if (!sheetName) throw new Error('No worksheet found in this .xlsx file.')

  const [sharedStringsXml, sheetXml] = await Promise.all([
    readEntryText(arrayBuffer, entries, 'xl/sharedStrings.xml'),
    readEntryText(arrayBuffer, entries, sheetName)
  ])

  const sharedStrings = parseSharedStrings(sharedStringsXml)
  return parseSheetRows(sheetXml, sharedStrings)
}
