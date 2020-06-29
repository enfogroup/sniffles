/* global describe, expect, it, jest */
import { handler } from '../src/index'

describe('index', () => {
  describe('handler', () => {
    it('handler should be a function', () => {
      expect(typeof handler).toBe('function')
    })
  })
})
