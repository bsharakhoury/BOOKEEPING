import { useRef, useState } from 'react'
import { detect } from '../../lib/parsers/index.js'
import { parseMashreqStatementFile } from '../../lib/parsers/mashreqStatement.js'
import { Field } from '../ui/Field.jsx'

export function ImportBox({ onParsed, fxRates }) {
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef(null)

  function runDetectAndParse(text, fileName) {
    setError('')
    const parser = detect({ text, fileName })
    if (!parser) {
      setError(
        "Couldn't recognise this text or file. Supported: Mashreq SMS, Mashreq statement (.xlsx), RAK Bank (statement text or Account_Transactions_CSV), Stripe CSV."
      )
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

  async function handleFile(file) {
    if (!file) return

    if (file.name.toLowerCase().endsWith('.xlsx')) {
      setError('')
      try {
        const buffer = await file.arrayBuffer()
        const rows = await parseMashreqStatementFile(buffer, { fxRates })
        if (rows.length === 0) {
          setError('Recognised this as a Mashreq statement but found no transactions in it.')
        } else {
          onParsed(rows, { parserId: 'mashreqStatement', label: 'Mashreq (statement .xlsx)', sourceName: file.name })
        }
      } catch (error) {
        setError(error.message || "Couldn't read this .xlsx file.")
      }
      return
    }

    const text = await file.text()
    runDetectAndParse(text, file.name)
  }

  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    await handleFile(file)
    event.target.value = ''
  }

  function handleDrop(event) {
    event.preventDefault()
    setDragOver(false)
    const file = event.dataTransfer.files?.[0]
    handleFile(file)
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
          Upload CSV or Mashreq statement (.xlsx)
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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
        or drag a CSV or Mashreq statement (.xlsx) file here
      </div>
      {error && <p className="import-box__error">{error}</p>}
    </div>
  )
}
