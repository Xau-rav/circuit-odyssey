import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ProjectFile } from '../core/types'
import { parseProject, serializeProject } from './projectFormat'

interface CircuitOdysseyDB extends DBSchema {
  projects: {
    key: string
    value: { id: string; name: string; updatedAt: string; json: string }
  }
}

let dbPromise: Promise<IDBPDatabase<CircuitOdysseyDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<CircuitOdysseyDB>('circuit-odyssey', 1, {
      upgrade(db) {
        db.createObjectStore('projects', { keyPath: 'id' })
      },
    })
  }
  return dbPromise
}

export async function saveProjectToIdb(
  id: string,
  project: ProjectFile,
): Promise<void> {
  const db = await getDb()
  await db.put('projects', {
    id,
    name: project.name,
    updatedAt: new Date().toISOString(),
    json: serializeProject(project),
  })
}

export async function loadProjectFromIdb(id: string): Promise<ProjectFile | null> {
  const db = await getDb()
  const row = await db.get('projects', id)
  if (!row) return null
  return parseProject(row.json)
}

export async function listProjectsFromIdb(): Promise<
  Array<{ id: string; name: string; updatedAt: string }>
> {
  const db = await getDb()
  const all = await db.getAll('projects')
  return all
    .map((r) => ({ id: r.id, name: r.name, updatedAt: r.updatedAt }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
