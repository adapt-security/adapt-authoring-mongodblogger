import { describe, it, mock, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const routesJson = JSON.parse(readFileSync(resolve(__dirname, '../routes.json'), 'utf8'))

/**
 * MongoDBLoggerModule extends AbstractApiModule which requires the full
 * app framework. We import only the module file and build a lightweight
 * stub that lets us exercise the concrete methods (setValues, logToDb)
 * without booting the entire application.
 */

// Stub out the parent modules so the import succeeds
const AbstractApiModule = class {}

// Register the stubs before importing the module under test
mock.module('adapt-authoring-api', {
  namedExports: { AbstractApiModule }
})

const { default: MongoDBLoggerModule } = await import('../lib/MongoDBLoggerModule.js')

describe('MongoDBLoggerModule', () => {
  describe('setValues', () => {
    let instance

    beforeEach(() => {
      instance = Object.create(MongoDBLoggerModule.prototype)
    })

    it('should set schemaName to "log"', async () => {
      await instance.setValues()
      assert.equal(instance.schemaName, 'log')
    })

    it('should set collectionName to "logs"', async () => {
      await instance.setValues()
      assert.equal(instance.collectionName, 'logs')
    })
  })

  describe('logToDb', () => {
    let instance

    beforeEach(() => {
      instance = Object.create(MongoDBLoggerModule.prototype)
      instance.logInternalErrors = false
      instance.insert = mock.fn(async () => {})
      instance.log = mock.fn(() => {})
    })

    it('should call insert with correct data', async () => {
      const date = new Date('2024-06-15T10:30:00.000Z')
      await instance.logToDb(date, 'info', 'testModule', 'message1')
      assert.equal(instance.insert.mock.callCount(), 1)
      const args = instance.insert.mock.calls[0].arguments
      assert.deepEqual(args[0], {
        timestamp: '2024-06-15T10:30:00.000Z',
        level: 'info',
        module: 'testModule',
        data: ['message1']
      })
    })

    it('should convert date to ISO string for timestamp', async () => {
      const date = new Date('2025-01-01T00:00:00.000Z')
      await instance.logToDb(date, 'error', 'mod')
      const insertArg = instance.insert.mock.calls[0].arguments[0]
      assert.equal(insertArg.timestamp, '2025-01-01T00:00:00.000Z')
    })

    it('should collect rest parameters into data array', async () => {
      const date = new Date()
      await instance.logToDb(date, 'debug', 'mod', 'arg1', 'arg2', 'arg3')
      const insertArg = instance.insert.mock.calls[0].arguments[0]
      assert.deepEqual(insertArg.data, ['arg1', 'arg2', 'arg3'])
    })

    it('should pass empty data array when no extra args provided', async () => {
      const date = new Date()
      await instance.logToDb(date, 'warn', 'mod')
      const insertArg = instance.insert.mock.calls[0].arguments[0]
      assert.deepEqual(insertArg.data, [])
    })

    it('should not throw when insert fails and logInternalErrors is false', async () => {
      instance.insert = mock.fn(async () => { throw new Error('DB error') })
      instance.logInternalErrors = false
      await assert.doesNotReject(async () => {
        await instance.logToDb(new Date(), 'info', 'mod', 'msg')
      })
    })

    it('should not log error when insert fails and logInternalErrors is false', async () => {
      instance.insert = mock.fn(async () => { throw new Error('DB error') })
      instance.logInternalErrors = false
      await instance.logToDb(new Date(), 'info', 'mod', 'msg')
      assert.equal(instance.log.mock.callCount(), 0)
    })

    it('should log error when insert fails and logInternalErrors is true', async () => {
      instance.insert = mock.fn(async () => { throw new Error('DB error') })
      instance.logInternalErrors = true
      await instance.logToDb(new Date(), 'info', 'mod', 'msg')
      assert.equal(instance.log.mock.callCount(), 1)
      const logArgs = instance.log.mock.calls[0].arguments
      assert.equal(logArgs[0], 'error')
      assert.ok(logArgs[1].includes('failed to add log message to database'))
      assert.ok(logArgs[1].includes('DB error'))
    })

    it('should handle non-string data arguments', async () => {
      const date = new Date()
      const objArg = { key: 'value' }
      const numArg = 42
      await instance.logToDb(date, 'info', 'mod', objArg, numArg)
      const insertArg = instance.insert.mock.calls[0].arguments[0]
      assert.deepEqual(insertArg.data, [objArg, numArg])
    })

    it('should handle Error objects in data arguments', async () => {
      const date = new Date()
      const err = new Error('something went wrong')
      await instance.logToDb(date, 'error', 'mod', err)
      const insertArg = instance.insert.mock.calls[0].arguments[0]
      assert.equal(insertArg.data.length, 1)
      assert.ok(insertArg.data[0] instanceof Error)
    })
  })

  describe('class structure', () => {
    it('should export a class', () => {
      assert.equal(typeof MongoDBLoggerModule, 'function')
      assert.ok(MongoDBLoggerModule.prototype.constructor === MongoDBLoggerModule)
    })

    it('should extend AbstractApiModule', () => {
      assert.ok(MongoDBLoggerModule.prototype instanceof AbstractApiModule)
    })

    it('should have a setValues method', () => {
      assert.equal(typeof MongoDBLoggerModule.prototype.setValues, 'function')
    })

    it('should have an init method', () => {
      assert.equal(typeof MongoDBLoggerModule.prototype.init, 'function')
    })

    it('should have a logToDb method', () => {
      assert.equal(typeof MongoDBLoggerModule.prototype.logToDb, 'function')
    })
  })

  describe('routes.json', () => {
    it('should set root to "logs"', () => {
      assert.equal(routesJson.root, 'logs')
    })

    it('should set useDefaultRoutes to false', () => {
      assert.equal(routesJson.useDefaultRoutes, false)
    })

    it('should define exactly 3 routes', () => {
      assert.equal(routesJson.routes.length, 3)
    })

    it('should define a GET / route with validate false', () => {
      const route = routesJson.routes.find(r => r.route === '/')
      assert.ok(route, 'GET / route should exist')
      assert.equal(route.handlers.get, 'default')
      assert.equal(route.validate, false)
      assert.deepEqual(route.permissions.get, ['read:${scope}'])
    })

    it('should define a GET /:_id route', () => {
      const route = routesJson.routes.find(r => r.route === '/:_id')
      assert.ok(route, 'GET /:_id route should exist')
      assert.equal(route.handlers.get, 'default')
      assert.deepEqual(route.permissions.get, ['read:${scope}'])
    })

    it('should define a POST /query route with validate false and modifying false', () => {
      const route = routesJson.routes.find(r => r.route === '/query')
      assert.ok(route, 'POST /query route should exist')
      assert.equal(route.handlers.post, 'query')
      assert.equal(route.validate, false)
      assert.equal(route.modifying, false)
      assert.deepEqual(route.permissions.post, ['read:${scope}'])
    })
  })
})
