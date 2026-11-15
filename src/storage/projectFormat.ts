import type { ProjectFile } from '../core/types'

export const CURRENT_FORMAT_VERSION = 1 as const

export function serializeProject(project: ProjectFile): string {
  // Strip any accidental secrets
  const clean: ProjectFile = {
    ...project,
    formatVersion: 1,
  }
  const json = JSON.stringify(clean, null, 2)
  if (/GEMINI|API_KEY|apiKey/i.test(json)) {
    throw new Error('Refusing to export project that appears to contain API keys')
  }
  return json
}

export function parseProject(json: string): ProjectFile {
  const data = JSON.parse(json) as ProjectFile
  if (data.formatVersion !== 1) {
    throw new Error(`Unsupported project formatVersion: ${String(data.formatVersion)}`)
  }
  if (!data.circuit || !data.breadboard) {
    throw new Error('Invalid project: missing circuit or breadboard')
  }
  return data
}

export function downloadProject(project: ProjectFile, filename?: string): void {
  const blob = new Blob([serializeProject(project)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? `${project.name.replace(/\s+/g, '-').toLowerCase()}.co.json`
  a.click()
  URL.revokeObjectURL(url)
}
