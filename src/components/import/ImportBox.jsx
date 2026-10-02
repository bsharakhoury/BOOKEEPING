import { useRef, useState } from 'react'
import { detect } from '../../lib/parsers/index.js'
import { parseMashreqStatementFile } from '../../lib/parsers/mashreqStatement.js'
import { mergeParsedFiles } from '../../lib/parsers/multiFile.js'
import { Field } from '../ui/Field.jsx'

const UNRECOGNISED_MESSAGE =
  "Couldn't recognise this text or file. Supported: Mashreq SMS, Mashreq statement (.xlsx), RAK Bank (statement .txt, statement text or Account_Transactions_CSV), Stripe CSV."

export function ImportBox({ onParsed, fxRates }) {
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  function runDetectAndParse(text, fileName) {
    setError('')
    const parser = detect({ text, fileName })
    if (!parser) {
      setError(UNRECOGNISED_MESSAGE)
      return
    }
    const rows = parser.parse(text, { fxRates })
    if (rows.length === 0) {
      setError('Recognised the format but found no transactions in it.')
      return
    }
    onParsed(rows, { parserId: parser.id, label: parser.label, sourceName: fileName || 'Pasted text' })
  }

  function handlePasteSubmit() {
    if (!pasteText.trim()) return
    runDetectAndParse(pasteText, '')
  }

  // Reads one statement file into { fileName, parserId, label, rows }, or throws a readable error.
  async function parseFile(file) {
    const fileName = file.name
    if (fileName.toLowerCase().endsWith('.xlsx')) {
      const buffer = await file.arrayBuffer()
      let rows
      try {
        rows = await parseMashreqStatementFile(buffer, { fxRates })
      } catch (error) {
        throw new Error(`${fileName}: ${error.message || "couldn't read this .xlsx file."}`)
      }
      if (rows.length === 0) throw new Error(`${fileName}: recognised as a Mashreq statement but found no transactions in it.`)
      return { fileName, parserId: 'mashreqStatement', label: 'Mashreq (statement .xlsx)', rows }
    }

    const text = await file.text()
    const parser = detect({ text, fileName })
    if (!parser) throw new Error(`${fileName}: ${UNRECOGNISED_MESSAGE}`)
    const rows = parser.parse(text, { fxRates })
    if (rows.length === 0) throw new Error(`${fileName}: recognised the format but found no transactions in it.`)
    return { fileName, parserId: parser.id, label: parser.label, rows }
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return
    setError('')
    try {
      const results = []
      for (const file of files) results.push(await parseFile(file))
      const merged = mergeParsedFiles(results)
      onParsed(merged.rows, { parserId: merged.parserId, label: merged.label, sourceName: merged.sourceName })
    } catch (error) {
      setError(error.message)
    }
  }

  async function handleFileSelected(event) {
    await handleFiles(event.target.files)
    event.target.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragOver(false)
    handleFiles(event.dataTransfer.files)
  }

  function handleDragOver(event) {
    event.preventDefault()
    setDragOver(true)
  }

  return (
    <div className="import-box">
      <Field label="Paste SMS or statement text">
        <textarea
          rows={6}
          value={pasteText}
          onChange={(event) => setPasteText(event.target.value)}
          placeholder="Paste Mashreq SMS alerts or a RAK Bank statement…"
        />
      </Field>
      <div className="import-box__actions">
        <button type="button" className="primary" onClick={handlePasteSubmit} disabled={!pasteText.trim()}>
          Parse pasted text
        </button>
        <span className="import-box__or">or</span>
        <button type="button" onClick={() => fileInputRef.current?.click()}>
          Choose statement files (.txt, .csv, .xlsx)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,text/csv,.txt,text/plain,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          hidden
          onChange={handleFileSelected}
        />
      </div>
      <div
        className={dragOver ? 'import-box__dropzone import-box__dropzone--active' : 'import-box__dropzone'}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        or drag one or more statement files here (RAK .txt, Mashreq .xlsx, CSV)
      </div>
      {error && <p className="import-box__error">{error}</p>}
    </div>
  )
}
