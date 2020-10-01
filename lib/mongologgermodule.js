const AbstractApiModule = require('adapt-authoring-api');
/**
 * Module for logging message to the MongoDB
 * @extends {AbstractApiModule}
 */
class MongoLoggerModule extends AbstractApiModule {
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
    this.app.onReady().then(async () => {
      const logger = await this.app.waitForModule('logger');
      for(const l of logger.cachedLogs) await this.logToDb(l.date, l.level, l.id, ...l.data);
      logger.on('log', this.logToDb.bind(this));
    });
  }
  /**
   * Logs a message to the database
   * @param {Date} date When the data was logged
   * @param {String} level Severity of the message
   * @param {String} id Identifier for the message. Helps to differentiate between other messages.
   * @param {...*} args Arguments to be logged
   */
  async logToDb(date, level, id, ...data) {
    try {
      const timestamp = date.toISOString();
      await this.insert({ timestamp, level, id, data });
    } catch(e) { // oh the irony...
      this.log('error', `failed to add log message to database, ${e}`);
    }
  }
}

module.exports = MongoLoggerModule;
