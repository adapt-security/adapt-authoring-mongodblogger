import AbstractApiModule from 'adapt-authoring-api';
/**
 * Module for logging message to the MongoDB
 * @extends {AbstractApiModule}
 */
class MongoDBLoggerModule extends AbstractApiModule {
  /** @override */
  async setValues() {
    /** @ignore */ this.root = 'logs';
    /** @ignore */ this.schemaName = 'log';
    /** @ignore */ this.collectionName = 'logs';
    /** @ignore */ this.routes = [
      {
        route: '/:_id?',
        handlers: { get: this.requestHandler() },
        permissions: { get: ['read:logs'] }
      },
      {
        route: '/query',
        validate: false,
        handlers: { post: this.queryHandler() },
        permissions: { post: ['read:logs'] }
      }
    ];
  }
  /** @override */
  async init() {
    await super.init();
    /**
     * Whether internal errors should be logged
     * @type {Boolean}
     */
    this.logInternalErrors = this.getConfig('logInternalErrors');

    this.app.onReady().then(async () => {
      const logger = await this.app.waitForModule('logger');
      for(const l of logger.cachedLogs) await this.logToDb(l.date, l.level, l.id, ...l.data);
      logger.on('log', this.logToDb.bind(this));
    });
    // try and create the capped collection
    const db = await this.app.waitForModule('mongodb');
    try {
      const max = this.getConfig('maxLogCount');
      await db.client.db().createCollection(this.collectionName, { capped: true, max, size: max*1000 });
    } catch(e) {
      if(e.code === 48) {
        if(!await db.getCollection(this.collectionName).isCapped()) {
          this.log('warn', `'${this.collectionName}' collection already exists and is not capped`);
        }
        return;
      }
      this.log('error', e);
    }
  }
  /**
   * Logs a message to the database
   * @param {Date} date When the data was logged
   * @param {String} level Severity of the message
   * @param {String} module Name of the module logging the message
   * @param {...*} data Other arguments to be logged
   */
  async logToDb(date, level, module, ...data) {
    try {
      const timestamp = date.toISOString();
      await this.insert({ timestamp, level, module, data });
    } catch(e) { // oh the irony...
      if(this.logInternalErrors) this.log('error', `failed to add log message to database, ${e}`);
    }
  }
}

export default MongoDBLoggerModule;