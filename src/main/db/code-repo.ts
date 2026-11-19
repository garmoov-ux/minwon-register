import Database from 'better-sqlite3'
import { CodeCategory } from '@shared/types/domain'

export class CodeRepository {
  constructor(private readonly db: Database.Database) {}

  getAllCodes(): Record<CodeCategory, string[]> {
    const rows = this.db
      .prepare('SELECT category, value FROM code_items ORDER BY sort_order ASC, id ASC')
      .all() as Array<{ category: CodeCategory; value: string }>

    const grouped: Record<CodeCategory, string[]> = {
      접수구분: [],
      구역구분: [],
      검토결과: []
    }

    for (const r of rows) {
      if (grouped[r.category] && !grouped[r.category].includes(r.value)) {
        grouped[r.category].push(r.value)
      }
    }
    return grouped
  }

  ensureCodeItem(category: CodeCategory, value: string): void {
    const trimmed = (value || '').trim()
    if (!trimmed) return

    const maxRow = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM code_items WHERE category = ?')
      .get(category) as { maxOrder: number }

    this.db
      .prepare('INSERT OR IGNORE INTO code_items (category, value, sort_order) VALUES (?, ?, ?)')
      .run(category, trimmed, maxRow.maxOrder + 1)
  }

  deleteCodeItem(category: CodeCategory, value: string): boolean {
    const info = this.db
      .prepare('DELETE FROM code_items WHERE category = ? AND value = ?')
      .run(category, value.trim())
    return info.changes > 0
  }
}
