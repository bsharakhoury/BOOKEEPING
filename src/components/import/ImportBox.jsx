import { useRef, useState } from 'react'
import { detect } from '../../lib/parsers/index.js'
import { Field } from '../ui/Field.jsx'

export function ImportBox({ onParsed, fxRates }) {
  const [pasteText, setPasteText] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  function runDetectAndParse(text, fileName) {
    setError('')
    const parser = detect({ text, fileName })
    if (!parser) {
      setError(
        "Couldn't recognise this text or file. Supported: Mashreq SMS, RAK Bank (statement text or Account_Transactions_CSV), Stripe CSV."
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

  async function handleFileSelected(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const text = await file.text()
    runDetectAndParse(text, file.name)
    event.target.value = ''
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
          Upload CSV
        </button>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv" hidden onChange={handleFileSelected} />
      </div>
      {error && <p className="import-box__error">{error}</p>}
    </div>
  )
}
