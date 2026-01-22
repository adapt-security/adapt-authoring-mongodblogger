import { AbstractApiModule, AbstractApiUtils } from 'adapt-authoring-api'
import apidefs from './apidefs.js'
/**
 * Module for logging message to the MongoDB
 * @memberof mongodblogger
 * @extends {AbstractApiModule}
 */
class MongoDBLoggerModule extends AbstractApiModule {
  /** @override */
  async setValues () {
    /** @ignore */ this.root = 'logs'
    /** @ignore */ this.schemaName = 'log'
    /** @ignore */ this.collectionName = 'logs'
    /** @ignore */ this.routes = [
      {
        route: '/',
        validate: false,
        handlers: { get: this.queryHandler() },
        permissions: { get: ['read:logs'] },
        meta: apidefs.getLogs
      },
      {
        route: '/:_id',
        handlers: { get: this.requestHandler() },
        permissions: { get: ['read:logs'] },
        meta: apidefs.getLog
      },
      {
        route: '/query',
        validate: false,
        handlers: { post: this.queryHandler() },
        permissions: { post: ['read:logs'] },
        meta: apidefs.queryLogs
      }
    ]
    AbstractApiUtils.generateApiMetadata(this)
  }

  /** @override */
  async init () {
    await super.init()
    /**
     * Whether internal errors should be logged
     * @type {Boolean}
     */
    this.logInternalErrors = this.getConfig('logInternalErrors')
    // try and create the capped collection
    const [db, logger] = await this.app.waitForModule('mongodb', 'logger')
    try {
      const max = this.getConfig('maxLogCount')
      if (max > 0) {
        await db.client.db().createCollection(this.collectionName, { capped: true, max, size: max * 1000 })
      }
    } catch (e) {
      if (e.code !== 48) {
        return this.log('error', e)
      }
      if (!await db.getCollection(this.collectionName).isCapped()) {
        return this.log('warn', `'${this.collectionName}' collection already exists and is not capped`)
      }
    }
    logger.logHook.tap(this.logToDb.bind(this))
  }

  /**
   * Logs a message to the database
   * @param {Date} date When the data was logged
   * @param {String} level Severity of the message
   * @param {String} module Name of the module logging the message
   * @param {...*} data Other arguments to be logged
   */
  async logToDb (date, level, module, ...data) {
    try {
      const timestamp = date.toISOString()
      await this.insert({ timestamp, level, module, data })
    } catch (e) { // oh the irony...
      if (this.logInternalErrors) this.log('error', `failed to add log message to database, ${e}`)
    }
  }
}

export default MongoDBLoggerModule
