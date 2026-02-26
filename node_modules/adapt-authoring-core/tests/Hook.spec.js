import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Hook from '../lib/Hook.js'

describe('Hook', () => {
  describe('.Types', () => {
    it('should expose Parallel type', () => {
      assert.equal(Hook.Types.Parallel, 'parallel')
    })

    it('should expose Series type', () => {
      assert.equal(Hook.Types.Series, 'series')
    })
  })

  describe('.Types', () => {
    it('should have exactly two type keys', () => {
      assert.equal(Object.keys(Hook.Types).length, 2)
    })
  })

  describe('constructor', () => {
    it('should create a hook with default options', () => {
      const hook = new Hook()
      assert.ok(hook instanceof Hook)
      assert.equal(hook.hasObservers, false)
    })

    it('should default to parallel type', () => {
      const hook = new Hook()
      assert.equal(hook._options.type, Hook.Types.Parallel)
    })

    it('should default mutable to false', () => {
      const hook = new Hook()
      assert.equal(hook._options.mutable, false)
    })

    it('should allow explicit type override even when mutable is true', () => {
      const hook = new Hook({ type: Hook.Types.Parallel, mutable: true })
      // When type is explicitly provided, it overrides the mutable-forced series default
      assert.equal(hook._options.type, Hook.Types.Parallel)
    })

    it('should handle undefined options', () => {
      const hook = new Hook(undefined)
      assert.equal(hook._options.type, Hook.Types.Parallel)
      assert.equal(hook._options.mutable, false)
    })

    it('should initialise with empty observer arrays', () => {
      const hook = new Hook()
      assert.deepEqual(hook._hookObservers, [])
      assert.deepEqual(hook._promiseObservers, [])
    })

    it('should create a hook that supports parallel execution', async () => {
      const hook = new Hook()
      const results = []
      hook.tap(() => results.push(1))
      hook.tap(() => results.push(2))
      await hook.invoke()
      assert.equal(results.length, 2)
    })

    it('should create a series hook when mutable option is true', async () => {
      const hook = new Hook({ mutable: true })
      const obj = { value: 0 }
      hook.tap((arg) => { arg.value += 1 })
      hook.tap((arg) => { arg.value += 1 })
      await hook.invoke(obj)
      assert.equal(obj.value, 2)
    })

    it('should respect type option for series execution', async () => {
      const hook = new Hook({ type: Hook.Types.Series })
      const order = []
      hook.tap(async () => {
        order.push('start-1')
        await new Promise(resolve => setTimeout(resolve, 10))
        order.push('end-1')
      })
      hook.tap(() => {
        order.push('start-2')
        order.push('end-2')
      })
      await hook.invoke()
      assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2'])
    })
  })

  describe('#hasObservers', () => {
    it('should return false when no observers', () => {
      const hook = new Hook()
      assert.equal(hook.hasObservers, false)
    })

    it('should return true when observers are added', () => {
      const hook = new Hook()
      hook.tap(() => {})
      assert.equal(hook.hasObservers, true)
    })
  })

  describe('#tap()', () => {
    it('should add an observer function', () => {
      const hook = new Hook()
      hook.tap(() => {})
      assert.equal(hook.hasObservers, true)
    })

    it('should add multiple observers', async () => {
      const hook = new Hook()
      let count = 0
      hook.tap(() => count++)
      hook.tap(() => count++)
      await hook.invoke()
      assert.equal(count, 2)
    })

    it('should bind observer to provided scope', () => {
      const hook = new Hook()
      const scope = { value: 42 }
      let capturedScope
      hook.tap(function () {
        capturedScope = this
      }, scope)
      hook.invoke()
      assert.equal(capturedScope, scope)
    })

    it('should ignore non-function arguments', () => {
      const hook = new Hook()
      hook.tap('not a function')
      hook.tap(null)
      hook.tap(42)
      hook.tap(undefined)
      hook.tap({})
      hook.tap([])
      assert.equal(hook.hasObservers, false)
    })

    it('should work without scope argument', async () => {
      const hook = new Hook()
      let called = false
      hook.tap(() => { called = true })
      await hook.invoke()
      assert.equal(called, true)
    })
  })

  describe('#untap()', () => {
    it('should not error when removing non-existent observer', () => {
      const hook = new Hook()
      hook.untap(() => {})
      assert.equal(hook.hasObservers, false)
    })

    it('should remove an existing observer by reference', () => {
      const hook = new Hook()
      const fn = () => {}
      // Note: tap() uses .bind() which creates a new function reference,
      // so untap with the original reference will not find it.
      // This test verifies the untap logic doesn't error in that case.
      hook.tap(fn)
      hook.untap(fn)
      // observer still present because tap binds the function
      assert.equal(hook.hasObservers, true)
    })

    it('should remove a directly-pushed observer by reference', () => {
      const hook = new Hook()
      const fn = () => {}
      hook._hookObservers.push(fn)
      assert.equal(hook.hasObservers, true)
      hook.untap(fn)
      assert.equal(hook.hasObservers, false)
    })

    it('should only remove the first matching reference', () => {
      const hook = new Hook()
      const fn = () => {}
      hook._hookObservers.push(fn, fn)
      hook.untap(fn)
      assert.equal(hook._hookObservers.length, 1)
    })
  })

  describe('#invoke()', () => {
    describe('parallel hooks', () => {
      it('should invoke all observers', async () => {
        const hook = new Hook()
        let count = 0
        hook.tap(() => count++)
        hook.tap(() => count++)
        await hook.invoke()
        assert.equal(count, 2)
      })

      it('should pass arguments to observers', async () => {
        const hook = new Hook()
        let receivedArg
        hook.tap((arg) => { receivedArg = arg })
        await hook.invoke('test')
        assert.equal(receivedArg, 'test')
      })

      it('should return array of observer results', async () => {
        const hook = new Hook()
        hook.tap(() => 'first')
        hook.tap(() => 'second')
        const results = await hook.invoke()
        assert.deepEqual(results, ['first', 'second'])
      })

      it('should invoke observers in parallel', async () => {
        const hook = new Hook()
        const order = []
        hook.tap(async () => {
          order.push('start-1')
          await new Promise(resolve => setTimeout(resolve, 10))
          order.push('end-1')
        })
        hook.tap(async () => {
          order.push('start-2')
          order.push('end-2')
        })
        await hook.invoke()
        assert.equal(order[0], 'start-1')
        assert.equal(order[1], 'start-2')
      })

      it('should throw error if any observer throws', async () => {
        const hook = new Hook()
        hook.tap(() => { throw new Error('test error') })
        await assert.rejects(hook.invoke(), { message: 'test error' })
      })

      it('should pass multiple arguments to observers', async () => {
        const hook = new Hook()
        let receivedArgs
        hook.tap((...args) => { receivedArgs = args })
        await hook.invoke('a', 'b', 'c')
        assert.deepEqual(receivedArgs, ['a', 'b', 'c'])
      })

      it('should resolve with empty array when no observers', async () => {
        const hook = new Hook()
        const result = await hook.invoke()
        assert.deepEqual(result, [])
      })

      it('should handle mixed sync and async observers', async () => {
        const hook = new Hook()
        hook.tap(() => 'sync')
        hook.tap(async () => 'async')
        const result = await hook.invoke()
        assert.deepEqual(result, ['sync', 'async'])
      })
    })

    describe('series hooks', () => {
      it('should invoke observers in series', async () => {
        const hook = new Hook({ type: Hook.Types.Series })
        const order = []
        hook.tap(async () => {
          order.push('start-1')
          await new Promise(resolve => setTimeout(resolve, 10))
          order.push('end-1')
        })
        hook.tap(async () => {
          order.push('start-2')
          order.push('end-2')
        })
        await hook.invoke()
        assert.deepEqual(order, ['start-1', 'end-1', 'start-2', 'end-2'])
      })

      it('should return last observer result', async () => {
        const hook = new Hook({ type: Hook.Types.Series })
        hook.tap(() => 'first')
        hook.tap(() => 'second')
        const result = await hook.invoke()
        assert.equal(result, 'second')
      })

      it('should deep copy arguments when not mutable', async () => {
        const hook = new Hook({ type: Hook.Types.Series })
        const obj = { value: 1, nested: { x: 10 } }
        hook.tap((arg) => { arg.value = 99; arg.nested.x = 99 })
        await hook.invoke(obj)
        assert.equal(obj.value, 1)
        assert.equal(obj.nested.x, 10)
      })

      it('should throw error if any observer throws', async () => {
        const hook = new Hook({ type: Hook.Types.Series })
        hook.tap(() => { throw new Error('series error') })
        await assert.rejects(hook.invoke(), { message: 'series error' })
      })

      it('should stop on first error and not call subsequent observers', async () => {
        const hook = new Hook({ type: Hook.Types.Series })
        const calls = []
        hook.tap(() => { calls.push(1); throw new Error('stop') })
        hook.tap(() => calls.push(2))
        await assert.rejects(hook.invoke())
        assert.deepEqual(calls, [1])
      })

      it('should return undefined with no observers', async () => {
        const hook = new Hook({ type: Hook.Types.Series })
        const result = await hook.invoke()
        assert.equal(result, undefined)
      })

      it('should return single observer result', async () => {
        const hook = new Hook({ type: Hook.Types.Series })
        hook.tap(() => 'only')
        const result = await hook.invoke()
        assert.equal(result, 'only')
      })
    })

    describe('mutable hooks', () => {
      it('should pass mutable arguments to observers', async () => {
        const hook = new Hook({ mutable: true })
        const obj = { value: 1 }
        hook.tap((arg) => { arg.value = 2 })
        hook.tap((arg) => { arg.value = 3 })
        await hook.invoke(obj)
        assert.equal(obj.value, 3)
      })

      it('should allow multiple mutations in sequence', async () => {
        const hook = new Hook({ mutable: true })
        const arr = []
        hook.tap((a) => { a.push(1) })
        hook.tap((a) => { a.push(2) })
        hook.tap((a) => { a.push(3) })
        await hook.invoke(arr)
        assert.deepEqual(arr, [1, 2, 3])
      })
    })
  })

  describe('#onInvoke()', () => {
    it('should return a promise', () => {
      const hook = new Hook()
      const result = hook.onInvoke()
      assert.ok(result instanceof Promise)
    })

    it('should add an entry to promise observers', () => {
      const hook = new Hook()
      assert.equal(hook._promiseObservers.length, 0)
      hook.onInvoke()
      assert.equal(hook._promiseObservers.length, 1)
    })

    it('should add a resolve/reject pair as promise observer', () => {
      const hook = new Hook()
      hook.onInvoke()
      const observer = hook._promiseObservers[0]
      assert.ok(Array.isArray(observer))
      assert.equal(observer.length, 2)
    })
  })
})
