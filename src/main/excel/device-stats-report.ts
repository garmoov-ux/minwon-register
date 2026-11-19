import { DeviceOperationStats } from '@shared/types/domain'

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

interface ChartSeriesInput {
  idx: number
  titleCellRef: string
  titleText: string
  valCellRange: string
  values: number[]
  colorHex: string
}

function buildBarChartXml(params: {
  chartTitle: string
  sheetName: string
  catCellRange: string
  categories: Array<string | number>
  seriesList: ChartSeriesInput[]
}): string {
  const { chartTitle, sheetName, catCellRange, categories, seriesList } = params
  const escapedSheet = `'${escapeXml(sheetName)}'`

  const catPtsXml = categories
    .map((c, i) => `<c:pt idx="${i}"><c:v>${escapeXml(c)}</c:v></c:pt>`)
    .join('')

  const seriesXml = seriesList
    .map((ser) => {
      const valPtsXml = ser.values
        .map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)
        .join('')

      return `<c:ser>
        <c:idx val="${ser.idx}"/>
        <c:order val="${ser.idx}"/>
        <c:tx>
          <c:strRef>
            <c:f>${escapedSheet}!${ser.titleCellRef}</c:f>
            <c:strCache>
              <c:ptCount val="1"/>
              <c:pt idx="0"><c:v>${escapeXml(ser.titleText)}</c:v></c:pt>
            </c:strCache>
          </c:strRef>
        </c:tx>
        <c:spPr>
          <a:solidFill><a:srgbClr val="${ser.colorHex}"/></a:solidFill>
        </c:spPr>
        <c:cat>
          <c:numRef>
            <c:f>${escapedSheet}!${catCellRange}</c:f>
            <c:numCache>
              <c:formatCode>General</c:formatCode>
              <c:ptCount val="${categories.length}"/>
              ${catPtsXml}
            </c:numCache>
          </c:numRef>
        </c:cat>
        <c:val>
          <c:numRef>
            <c:f>${escapedSheet}!${ser.valCellRange}</c:f>
            <c:numCache>
              <c:formatCode>General</c:formatCode>
              <c:ptCount val="${ser.values.length}"/>
              ${valPtsXml}
            </c:numCache>
          </c:numRef>
        </c:val>
      </c:ser>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:lang val="ko-KR"/>
  <c:roundedCorners val="0"/>
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr><a:defRPr sz="1100" b="1"><a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/></a:defRPr></a:pPr>
            <a:r><a:rPr lang="ko-KR" sz="1100" b="1"><a:latin typeface="맑은 고딕"/><a:ea typeface="맑은 고딕"/></a:rPr><a:t>${escapeXml(chartTitle)}</a:t></a:r>
          </a:p>
        </c:rich>
      </c:tx>
      <c:overlay val="0"/>
    </c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        ${seriesXml}
        <c:gapWidth val="150"/>
        <c:axId val="1001"/>
        <c:axId val="1002"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="1001"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="b"/>
        <c:majorTickMark val="out"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="1002"/>
        <c:crosses val="autoZero"/>
        <c:auto val="1"/>
        <c:lblAlgn val="ctr"/>
        <c:lblOffset val="100"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="1002"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/>
        <c:axPos val="l"/>
        <c:majorGridlines/>
        <c:numFmt formatCode="General" sourceLinked="1"/>
        <c:majorTickMark val="out"/>
        <c:minorTickMark val="none"/>
        <c:tickLblPos val="nextTo"/>
        <c:crossAx val="1001"/>
        <c:crosses val="autoZero"/>
        <c:crossBetween val="between"/>
      </c:valAx>
    </c:plotArea>
    <c:legend>
      <c:legendPos val="b"/>
      <c:overlay val="0"/>
    </c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
</c:chartSpace>`
}

export function buildDeviceStatsReportFiles(
  stats: DeviceOperationStats
): Array<{ name: string; content: Buffer }> {
  const sheetName = '무인교통단속장비 운영현황'
  const headers = [
    '연번',
    '설치년도',
    '일반구역',
    '어린이보호구역',
    '노인보호구역',
    '장애인보호구역',
    '신호과속(고)',
    '과속(고)',
    '구간(고)',
    '운행제한(고)',
    '진입금지(고)',
    '과속(이)',
    '합계'
  ]

  const colWidths = [8, 11, 11, 15, 13, 15, 13, 11, 11, 13, 13, 11, 11]
  const colsXml = colWidths
    .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
    .join('')

  // 1행: 무인교통단속장비 운영현황 (A1:M1 병합, 26pt Bold)
  const row1Cells = Array.from({ length: 13 }, (_, cIdx) => {
    const ref = `${colLetter(cIdx)}1`
    if (cIdx === 0) {
      return `<c r="${ref}" s="1" t="inlineStr"><is><t>무인교통단속장비 운영현황</t></is></c>`
    }
    return `<c r="${ref}" s="1"/>`
  }).join('')

  // 3행: ○ 무인교통단속장비 유형별 통계 (A3, 16pt Bold Blue), L3('총'), M3(총 대수)
  const row3Xml = `<row r="3" ht="30" customHeight="1">
    <c r="A3" s="2" t="inlineStr"><is><t>○ 무인교통단속장비 유형별 통계</t></is></c>
    <c r="L3" s="3" t="inlineStr"><is><t>총</t></is></c>
    <c r="M3" s="4"><v>${stats.totals.totalCount}</v></c>
  </row>`

  // 5행: 테이블 헤더 (A5:M5, 10pt Bold, 얇은 테두리)
  const row5Cells = headers
    .map((h, cIdx) => `<c r="${colLetter(cIdx)}5" s="5" t="inlineStr"><is><t>${escapeXml(h)}</t></is></c>`)
    .join('')

  // 6행 ~ (5+N)행: 연도별 데이터 (11pt, 얇은 테두리)
  const startDataRow = 6
  const dataRowsXml = stats.rows
    .map((r, idx) => {
      const rowNum = startDataRow + idx
      const vals = [
        r.seq,
        r.installYear,
        r.zoneGeneral,
        r.zoneChild,
        r.zoneElder,
        r.zoneDisabled,
        r.fixedSignalSpeed,
        r.fixedSpeed,
        r.fixedSection,
        r.fixedRestriction,
        r.fixedNoEntry,
        r.mobileSpeed,
        r.totalCount
      ]
      const cells = vals
        .map((v, cIdx) => `<c r="${colLetter(cIdx)}${rowNum}" s="6"><v>${v}</v></c>`)
        .join('')
      return `<row r="${rowNum}" ht="22" customHeight="1">${cells}</row>`
    })
    .join('')

  const lastDataRow = Math.max(startDataRow, startDataRow + stats.rows.length - 1)
  const totalRowNum = startDataRow + stats.rows.length

  // 합계 행 (A{totalRowNum}:B{totalRowNum} 병합, 11pt Bold)
  const totalVals = [
    stats.totals.zoneGeneral,
    stats.totals.zoneChild,
    stats.totals.zoneElder,
    stats.totals.zoneDisabled,
    stats.totals.fixedSignalSpeed,
    stats.totals.fixedSpeed,
    stats.totals.fixedSection,
    stats.totals.fixedRestriction,
    stats.totals.fixedNoEntry,
    stats.totals.mobileSpeed,
    stats.totals.totalCount
  ]
  const totalValueCells = totalVals
    .map((v, idx) => `<c r="${colLetter(idx + 2)}${totalRowNum}" s="7"><v>${v}</v></c>`)
    .join('')

  const totalRowXml = `<row r="${totalRowNum}" ht="24" customHeight="1">
    <c r="A${totalRowNum}" s="7" t="inlineStr"><is><t>합계</t></is></c>
    <c r="B${totalRowNum}" s="7"/>
    ${totalValueCells}
  </row>`

  const footerText =
    '&amp;L작성일: &amp;D&amp;R본 자료는 중요 공무 자료이므로 외부 유출 및 무단 배포를 금지합니다.'

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="16.5"/>
  <cols>${colsXml}</cols>
  <sheetData>
    <row r="1" ht="40" customHeight="1">${row1Cells}</row>
    ${row3Xml}
    <row r="5" ht="24" customHeight="1">${row5Cells}</row>
    ${dataRowsXml}
    ${totalRowXml}
  </sheetData>
  <mergeCells count="2">
    <mergeCell ref="A1:M1"/>
    <mergeCell ref="A${totalRowNum}:B${totalRowNum}"/>
  </mergeCells>
  <printOptions horizontalCentered="1"/>
  <pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
  <pageSetup paperSize="9" scale="73" fitToHeight="0" orientation="landscape"/>
  <headerFooter>
    <oddFooter>${footerText}</oddFooter>
  </headerFooter>
  <drawing r:id="rId1"/>
</worksheet>`

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="7">
    <font><sz val="11"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="26"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="16"/><color rgb="FF1F4E78"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="12"/><name val="맑은 고딕"/></font>
    <font><sz val="12"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="10"/><name val="맑은 고딕"/></font>
    <font><b/><sz val="11"/><name val="맑은 고딕"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="4">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color auto="1"/></left>
      <right style="thin"><color auto="1"/></right>
      <top style="thin"><color auto="1"/></top>
      <bottom style="thin"><color auto="1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color auto="1"/></left>
      <right style="hair"><color auto="1"/></right>
      <top style="thin"><color auto="1"/></top>
      <bottom style="thin"><color auto="1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="hair"><color auto="1"/></left>
      <right style="thin"><color auto="1"/></right>
      <top style="thin"><color auto="1"/></top>
      <bottom style="thin"><color auto="1"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="8">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1">
      <alignment vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="0" borderId="2" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="4" fillId="0" borderId="3" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="5" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="6" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`

  const categories = stats.rows.map((r) => r.installYear)
  const catCellRange = `$B$${startDataRow}:$B$${lastDataRow}`

  // 차트 1: 설치년도별 보호구역 현황
  const chart1Xml = buildBarChartXml({
    chartTitle: '설치년도별 보호구역 단속장비 현황',
    sheetName,
    catCellRange,
    categories,
    seriesList: [
      {
        idx: 0,
        titleCellRef: '$C$5',
        titleText: '일반구역',
        valCellRange: `$C$${startDataRow}:$C$${lastDataRow}`,
        values: stats.rows.map((r) => r.zoneGeneral),
        colorHex: '2563EB'
      },
      {
        idx: 1,
        titleCellRef: '$D$5',
        titleText: '어린이보호구역',
        valCellRange: `$D$${startDataRow}:$D$${lastDataRow}`,
        values: stats.rows.map((r) => r.zoneChild),
        colorHex: 'D97706'
      },
      {
        idx: 2,
        titleCellRef: '$E$5',
        titleText: '노인보호구역',
        valCellRange: `$E$${startDataRow}:$E$${lastDataRow}`,
        values: stats.rows.map((r) => r.zoneElder),
        colorHex: '059669'
      },
      {
        idx: 3,
        titleCellRef: '$F$5',
        titleText: '장애인보호구역',
        valCellRange: `$F$${startDataRow}:$F$${lastDataRow}`,
        values: stats.rows.map((r) => r.zoneDisabled),
        colorHex: '7C3AED'
      }
    ]
  })

  // 차트 2: 설치년도별 단속종류별 운영현황
  const chart2Xml = buildBarChartXml({
    chartTitle: '설치년도별 단속종류별 운영현황',
    sheetName,
    catCellRange,
    categories,
    seriesList: [
      {
        idx: 0,
        titleCellRef: '$G$5',
        titleText: '신호과속(고)',
        valCellRange: `$G$${startDataRow}:$G$${lastDataRow}`,
        values: stats.rows.map((r) => r.fixedSignalSpeed),
        colorHex: '1D4ED8'
      },
      {
        idx: 1,
        titleCellRef: '$H$5',
        titleText: '과속(고)',
        valCellRange: `$H$${startDataRow}:$H$${lastDataRow}`,
        values: stats.rows.map((r) => r.fixedSpeed),
        colorHex: '0284C7'
      },
      {
        idx: 2,
        titleCellRef: '$I$5',
        titleText: '구간(고)',
        valCellRange: `$I$${startDataRow}:$I$${lastDataRow}`,
        values: stats.rows.map((r) => r.fixedSection),
        colorHex: '0D9488'
      },
      {
        idx: 3,
        titleCellRef: '$L$5',
        titleText: '과속(이)',
        valCellRange: `$L$${startDataRow}:$L$${lastDataRow}`,
        values: stats.rows.map((r) => r.mobileSpeed),
        colorHex: '4F46E5'
      }
    ]
  })

  const chartStartRow0 = totalRowNum + 1 // 0-indexed row below total row
  const chartEndRow0 = chartStartRow0 + 15

  const drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>0</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chartStartRow0}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>6</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chartEndRow0}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="2" name="보호구역별 차트"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId1"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
  <xdr:twoCellAnchor>
    <xdr:from><xdr:col>6</xdr:col><xdr:colOff>150000</xdr:colOff><xdr:row>${chartStartRow0}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>13</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${chartEndRow0}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="3" name="단속종류별 차트"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId2"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`

  const sheetRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>
</Relationships>`

  const drawingRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart2.xml"/>
</Relationships>`

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
  <Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>
  <Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
  <Override PartName="/xl/charts/chart2.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>
</Types>`

  return [
    { name: '[Content_Types].xml', content: Buffer.from(contentTypesXml, 'utf-8') },
    { name: '_rels/.rels', content: Buffer.from(rootRelsXml, 'utf-8') },
    { name: 'xl/workbook.xml', content: Buffer.from(workbookXml, 'utf-8') },
    { name: 'xl/_rels/workbook.xml.rels', content: Buffer.from(workbookRelsXml, 'utf-8') },
    { name: 'xl/styles.xml', content: Buffer.from(stylesXml, 'utf-8') },
    { name: 'xl/worksheets/sheet1.xml', content: Buffer.from(sheetXml, 'utf-8') },
    { name: 'xl/worksheets/_rels/sheet1.xml.rels', content: Buffer.from(sheetRelsXml, 'utf-8') },
    { name: 'xl/drawings/drawing1.xml', content: Buffer.from(drawingXml, 'utf-8') },
    { name: 'xl/drawings/_rels/drawing1.xml.rels', content: Buffer.from(drawingRelsXml, 'utf-8') },
    { name: 'xl/charts/chart1.xml', content: Buffer.from(chart1Xml, 'utf-8') },
    { name: 'xl/charts/chart2.xml', content: Buffer.from(chart2Xml, 'utf-8') }
  ]
}
