/* global describe, expect, it, jest */
import { handler, toStringFn, toRegExpFn, toJspathFn, toWhitelistFn } from '../src/index'

describe('index', () => {
  describe('handler', () => {
    it('handler should be a function', () => {
      expect(typeof handler).toBe('function')
    })
  })
  describe('toStringFn', () => {
    it('tests positive', () => {
      expect(toStringFn('abc')('x\ty\tabcd')).toBe(true)
    })
    it('tests negative', () => {
      expect(toStringFn('abc.*')('x\ty\tabc')).toBe(false)
    })
  })
  describe('toRegExpFn', () => {
    it('tests positive', () => {
      expect(toRegExpFn('/abc$/')('x\ty\tabc')).toBe(true)
    })
    it('tests negative', () => {
      expect(toRegExpFn('/abc$/')('x\ty\tabd')).toBe(false)
    })
  })
  describe('toJspathFn', () => {
    it('tests positive', () => {
      expect(toJspathFn('{ .level === "ERROR" }')(`x\ty\t${JSON.stringify({ level: 'ERROR' }, null, 2)}\n`)).toBe(true)
    })
    it('tests negative', () => {
      expect(toJspathFn('{ .level === "ERROR" }')(`x\ty\t${JSON.stringify({ level: 'INFO' }, null, 2)}\n`)).toBe(false)
    })
    it('handles not JSON', () => {
      expect(toJspathFn('{ .level === "ERROR" }')('x\ty\tblablabla')).toBe(false)
    })
  })
  describe('toWhitelistFn', () => {
    it('returns correct function', () => {
      expect.assertions(3)
      expect(toWhitelistFn('/abc$/')('x\ty\tabc')).toBe(true)
      expect(toWhitelistFn('{ .level === "ERROR" }')(`x\ty\t${JSON.stringify({ level: 'ERROR' }, null, 2)}\n`)).toBe(true)
      expect(toWhitelistFn('abc')('easy\tas\tabc')).toBe(true)
    })
  })
})
