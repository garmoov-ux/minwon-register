import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { DeviceOperationStats, MinwonRecord } from '@shared/types/domain'
import { resolveAppPaths } from '../config/app-paths'
import { buildDeviceStatsReportFiles } from './device-stats-report'

function escapeXml(str: string | number | null | undefined): string {
  const s = String(str ?? '')
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function colLetter(colIdx0: number): string {
  let n = colIdx0 + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

function computeVisualWidth(text: string): number {
  let w = 0
  for (const ch of text) {
    w += ch.charCodeAt(0) > 127 ? 1.85 : 1.05
  }
  return Math.max(10, Math.min(48, Math.ceil(w + 4)))
}

/**
 * 외부 무거운 의존성 없이 순수 Node.js zlib Deflate로 표준 OpenXML(.xlsx) ZIP 아카이브를 생성한다.
 */
export function createZipBuffer(files: Array<{ name: string; content: Buffer }>): Buffer {
  const localHeaders: Buffer[] = []
  const centralHeaders: Buffer[] = []
  let offset = 0

  const crcTable = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    crcTable[n] = c >>> 0
  }

  function crc32(buf: Buffer): number {
    let c = 0xffffffff
    for (let i = 0; i < buf.length; i += 1) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
    }
    return (c ^ 0xffffffff) >>> 0
  }

  for (const file of files) {
    const nameBuf = Buffer.from(file.name, 'utf-8')
    const uncompressedSize = file.content.length
    const crc = crc32(file.content)
    const compressed = zlib.deflateRawSync(file.content)
    const compressedSize = compressed.length

    const localHeader = Buffer.alloc(30 + nameBuf.length)
    localHeader.writeUInt32LE(0x04034b50, 0)
    localHeader.writeUInt16LE(20, 4)
    localHeader.writeUInt16LE(0x0800, 6) // UTF-8 flag
    localHeader.writeUInt16LE(8, 8) // Deflate
    localHeader.writeUInt16LE(0, 10)
    localHeader.writeUInt16LE(0, 12)
    localHeader.writeUInt32LE(crc, 14)
    localHeader.writeUInt32LE(compressedSize, 18)
    localHeader.writeUInt32LE(uncompressedSize, 22)
    localHeader.writeUInt16LE(nameBuf.length, 26)
    localHeader.writeUInt16LE(0, 28)
    nameBuf.copy(localHeader, 30)

    localHeaders.push(localHeader, compressed)

    const centralHeader = Buffer.alloc(46 + nameBuf.length)
    centralHeader.writeUInt32LE(0x02014b50, 0)
    centralHeader.writeUInt16LE(20, 4)
    centralHeader.writeUInt16LE(20, 6)
    centralHeader.writeUInt16LE(0x0800, 8)
    centralHeader.writeUInt16LE(8, 10)
    centralHeader.writeUInt16LE(0, 12)
    centralHeader.writeUInt16LE(0, 14)
    centralHeader.writeUInt32LE(crc, 16)
    centralHeader.writeUInt32LE(compressedSize, 20)
    centralHeader.writeUInt32LE(uncompressedSize, 24)
    centralHeader.writeUInt16LE(nameBuf.length, 28)
    centralHeader.writeUInt16LE(0, 30)
    centralHeader.writeUInt16LE(0, 32)
    centralHeader.writeUInt16LE(0, 34)
    centralHeader.writeUInt16LE(0, 36)
    centralHeader.writeUInt32LE(0, 38)
    centralHeader.writeUInt32LE(offset, 42)
    nameBuf.copy(centralHeader, 46)

    centralHeaders.push(centralHeader)
    offset += localHeader.length + compressed.length
  }

  const centralDirBuf = Buffer.concat(centralHeaders)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(files.length, 8)
  eocd.writeUInt16LE(files.length, 10)
  eocd.writeUInt32LE(centralDirBuf.length, 12)
  eocd.writeUInt32LE(offset, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...localHeaders, centralDirBuf, eocd])
}

export function buildStandardXlsxBuffer(params: {
  sheetName: string
  headers: string[]
  rows: Array<Array<string | number>>
}): Buffer {
  const { sheetName, headers, rows } = params
  const colCount = headers.length
  const lastCol = colLetter(colCount - 1)
  const totalRows = rows.length + 1

  const colWidths = headers.map((h, cIdx) => {
    let maxW = computeVisualWidth(h)
    for (const r of rows) {
      const cellStr = String(r[cIdx] ?? '')
      const w = computeVisualWidth(cellStr)
      if (w > maxW) maxW = w
    }
    return maxW
  })

  const colsXml = colWidths
    .map(
      (w, idx) =>
        `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`
    )
    .join('')

  const headerCellsXml = headers
    .map((h, cIdx) => {
      const ref = `${colLetter(cIdx)}1`
      return `<c r="${ref}" s="1" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`
    })
    .join('')

  const dataRowsXml = rows
    .map((row, rIdx) => {
      const rowNum = rIdx + 2
      const cells = row
        .map((val, cIdx) => {
          const ref = `${colLetter(cIdx)}${rowNum}`
          if (typeof val === 'number' && Number.isFinite(val)) {
            return `<c r="${ref}" s="2"><v>${val}</v></c>`
          }
          return `<c r="${ref}" s="2" t="inlineStr"><is><t>${escapeXml(val)}</t></is></c>`
        })
        .join('')
      return `<row r="${rowNum}" ht="25" customHeight="1">${cells}</row>`
    })
    .join('')

  const footerText =
    '&amp;L작성일: &amp;D&amp;R본 자료는 중요 공무 자료이므로 외부 유출 및 무단 배포를 금지합니다.'

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr>
    <pageSetUpPr fitToPage="1"/>
  </sheetPr>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
      <selection pane="bottomLeft" activeCell="A2" sqref="A2"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="25" customHeight="1"/>
  <cols>${colsXml}</cols>
  <sheetData>
    <row r="1" ht="25" customHeight="1">${headerCellsXml}</row>
    ${dataRowsXml}
  </sheetData>
  <autoFilter ref="A1:${lastCol}${totalRows}"/>
  <printOptions horizontalCentered="1" verticalCentered="0"/>
  <pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.25" footer="0.25"/>
  <pageSetup paperSize="9" fitToWidth="1" fitToHeight="0" orientation="landscape"/>
  <headerFooter>
    <oddFooter>${footerText}</oddFooter>
  </headerFooter>
</worksheet>`

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="10"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="10"/><name val="맑은 고딕"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFD9E1F2"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFBFBFBF"/></left>
      <right style="thin"><color rgb="FFBFBFBF"/></right>
      <top style="thin"><color rgb="FFBFBFBF"/></top>
      <bottom style="thin"><color rgb="FFBFBFBF"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="3">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
  </cellXfs>
</styleSheet>`

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`

  return createZipBuffer([
    { name: '[Content_Types].xml', content: Buffer.from(contentTypesXml, 'utf-8') },
    { name: '_rels/.rels', content: Buffer.from(rootRelsXml, 'utf-8') },
    { name: 'xl/workbook.xml', content: Buffer.from(workbookXml, 'utf-8') },
    { name: 'xl/_rels/workbook.xml.rels', content: Buffer.from(workbookRelsXml, 'utf-8') },
    { name: 'xl/styles.xml', content: Buffer.from(stylesXml, 'utf-8') },
    { name: 'xl/worksheets/sheet1.xml', content: Buffer.from(sheetXml, 'utf-8') }
  ])
}

function getTimestampSuffix(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const ss = String(now.getSeconds()).padStart(2, '0')
  return `${y}${m}${d}_${hh}${mm}${ss}`
}

export function exportMinwonRecordsToExcel(
  records: MinwonRecord[],
  prefix: '전체' | '조회' = '전체',
  customFilePath?: string
): { filePath: string; buffer: Buffer } {
  const headers = [
    '연번',
    '접수일자',
    '접수구분',
    '접수번호',
    '이름',
    '연락처',
    '위치',
    '구역구분',
    '민원내용',
    '공단 검토일자',
    '공단 검토결과',
    '개선결과',
    '비고'
  ]

  const rows = records.map((r, idx) => [
    prefix === '조회' ? idx + 1 : r.id,
    r.receivedDate,
    r.receptionType,
    r.receptionNo,
    r.complainantName,
    r.contact,
    r.location,
    r.zoneType,
    r.content,
    r.reviewDate,
    r.reviewResult,
    r.improvementResult,
    r.note
  ])

  const buffer = buildStandardXlsxBuffer({
    sheetName: prefix === '조회' ? `조회_${getTimestampSuffix().slice(0, 8)}` : '전체',
    headers,
    rows
  })

  const { exportDir } = resolveAppPaths()
  const fileName = `${prefix}_${getTimestampSuffix()}.xlsx`
  const filePath = customFilePath || path.join(exportDir, fileName)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, buffer)

  return { filePath, buffer }
}

export function exportDeviceOperationStatsToExcel(
  stats: DeviceOperationStats,
  customFilePath?: string
): { filePath: string; buffer: Buffer } {
  const reportFiles = buildDeviceStatsReportFiles(stats)
  const buffer = createZipBuffer(reportFiles)

  const { exportDir } = resolveAppPaths()
  const fileName = `통계_${getTimestampSuffix()}.xlsx`
  const filePath = customFilePath || path.join(exportDir, fileName)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, buffer)

  return { filePath, buffer }
}
