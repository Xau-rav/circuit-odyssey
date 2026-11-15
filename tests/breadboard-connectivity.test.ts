import { describe, expect, it } from 'vitest'
import { build830Breadboard } from '../src/breadboard/geometry'
import {
  connectedHoles,
  holesAreConnected,
} from '../src/breadboard/connectivity'

describe('830 breadboard connectivity', () => {
  const board = build830Breadboard()

  it('connects A–E within the same column', () => {
    expect(holesAreConnected(board, 'A10', 'E10')).toBe(true)
    expect(holesAreConnected(board, 'A10', 'A11')).toBe(false)
  })

  it('does not bridge the center channel', () => {
    expect(holesAreConnected(board, 'E10', 'F10')).toBe(false)
  })

  it('segments power rails every 5 columns', () => {
    expect(holesAreConnected(board, 'rail-top+-1', 'rail-top+-5')).toBe(true)
    expect(holesAreConnected(board, 'rail-top+-1', 'rail-top+-6')).toBe(false)
    expect(holesAreConnected(board, 'rail-top+-1', 'rail-top--1')).toBe(false)
  })

  it('returns full terminal group', () => {
    const g = connectedHoles(board, 'C20')
    expect(g.has('A20')).toBe(true)
    expect(g.has('E20')).toBe(true)
    expect(g.has('F20')).toBe(false)
  })
})
