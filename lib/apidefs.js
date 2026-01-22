/**
 * REST API metadata for the mongodblogger module
 * @memberof mongodblogger
 */
export default {
  getLogs: {
    get: {
      summary: 'Retrieve all logs',
      description: 'Returns all log entries, with optional filtering via query parameters.',
      parameters: [
        {
          name: 'level',
          in: 'query',
          description: 'Filter by log level',
          schema: {
            type: 'string',
            enum: ['verbose', 'debug', 'info', 'success', 'warn', 'error', 'fatal']
          }
        },
        {
          name: 'module',
          in: 'query',
          description: 'Filter by module name'
        },
        {
          name: 'timestamp[$gte]',
          in: 'query',
          description: 'Filter logs from this date (ISO 8601 format)'
        },
        {
          name: 'timestamp[$lte]',
          in: 'query',
          description: 'Filter logs until this date (ISO 8601 format)'
        }
      ],
      responses: {
        200: {
          description: 'List of log entries',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/log' }
              }
            }
          }
        }
      }
    }
  },
  getLog: {
    get: {
      summary: 'Retrieve a single log',
      description: 'Returns a single log entry by its ID.',
      parameters: [
        {
          name: '_id',
          in: 'path',
          description: 'The log entry ID',
          required: true
        }
      ],
      responses: {
        200: {
          description: 'The log entry',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/log' }
            }
          }
        },
        404: {
          description: 'Log entry not found'
        }
      }
    }
  },
  queryLogs: {
    post: {
      summary: 'Query logs',
      description: 'Query log entries using MongoDB query syntax in the request body.',
      requestBody: {
        description: 'MongoDB query object',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                level: {
                  type: 'string',
                  enum: ['verbose', 'debug', 'info', 'success', 'warn', 'error', 'fatal'],
                  description: 'Filter by log level'
                },
                module: {
                  type: 'string',
                  description: 'Filter by module name'
                },
                timestamp: {
                  type: 'object',
                  description: 'Date range filter using MongoDB operators ($gte, $lte)',
                  properties: {
                    $gte: { type: 'string', format: 'date-time' },
                    $lte: { type: 'string', format: 'date-time' }
                  }
                }
              }
            },
            examples: {
              byLevel: {
                summary: 'Filter by level',
                value: { level: 'error' }
              },
              byModule: {
                summary: 'Filter by module',
                value: { module: 'adapt-authoring-auth' }
              },
              byDateRange: {
                summary: 'Filter by date range',
                value: {
                  timestamp: {
                    $gte: '2024-01-01T00:00:00Z',
                    $lte: '2024-01-31T23:59:59Z'
                  }
                }
              },
              combined: {
                summary: 'Combined filters',
                value: {
                  level: 'error',
                  module: 'adapt-authoring-auth',
                  timestamp: { $gte: '2024-01-01T00:00:00Z' }
                }
              }
            }
          }
        }
      },
      responses: {
        200: {
          description: 'List of matching log entries',
          content: {
            'application/json': {
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/log' }
              }
            }
          }
        }
      }
    }
  }
}
