/* global describe, expect, it, jest */
import { handler, toRegExpFn, toJspathFn, toWhitelistFn } from '../src/index'

describe('index', () => {
  describe('handler', () => {
    it('handler should be a function', () => {
      expect(typeof handler).toBe('function')
    })
  })
  describe('toRegExpFn', () => {
    it('tests positive', () => {
      expect(toRegExpFn('^abc$')('abc')).toBe(true)
    })
    it('tests negative', () => {
      expect(toRegExpFn('^abc$')('abd')).toBe(false)
    })
  })
  describe('toJspathFn', () => {
    it('tests positive', () => {
      expect(toJspathFn('{ .level === "ERROR" }')(`\t${JSON.stringify({ level: 'ERROR' })}`)).toBe(true)
    })
    it('tests negative', () => {
      expect(toJspathFn('{ .level === "ERROR" }')(`\t${JSON.stringify({ level: 'INFO' })}`)).toBe(false)
    })
  })
  describe('toWhitelistFn', () => {
    it('returns correct function', () => {
      expect.assertions(2)
      expect(toWhitelistFn('^abc$')('abc')).toBe(true)
      expect(toWhitelistFn('{ .level === "ERROR" }')(`\t${JSON.stringify({ level: 'ERROR' })}`)).toBe(true)
    })
  })
})
