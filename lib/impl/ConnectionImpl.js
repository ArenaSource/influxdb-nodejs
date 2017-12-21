'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();
/** @namespace JSON */

var _requestPromise = require('request-promise');

var RequestPromise = _interopRequireWildcard(_requestPromise);

var _lodash = require('lodash');

var _ = _interopRequireWildcard(_lodash);

var _InfluxDBError = require('../InfluxDBError');

var _InfluxDBError2 = _interopRequireDefault(_InfluxDBError);

var _WriteBuffer = require('./WriteBuffer');

var _WriteBuffer2 = _interopRequireDefault(_WriteBuffer);

var _ConnectionTracker = require('./ConnectionTracker');

var _ConnectionTracker2 = _interopRequireDefault(_ConnectionTracker);

var _DefaultConnectionOptions = require('./DefaultConnectionOptions');

var _DefaultConnectionOptions2 = _interopRequireDefault(_DefaultConnectionOptions);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * @ignore
 */
var ConnectionImpl = function () {
  function ConnectionImpl(options) {
    _classCallCheck(this, ConnectionImpl);

    this.schemas = {};
    ConnectionImpl.validateteOptions(options);
    this.options = ConnectionImpl.prepareOptions(options);
    ConnectionImpl.validateSchemas(options.schema);
    this.schemas = ConnectionImpl.prepareSchemas(options.schema);
    // for convenience of the user ignore a slash at the end of the URL
    this.hostUrl = ConnectionImpl.stripTrailingSlashIfNeeded(this.options.hostUrl);
    // buffer for data points, new instance is created for every batch
    this.writeBuffer = new _WriteBuffer2.default(this.schemas, this.options.autoGenerateTimestamps);
    // timer handle used to flush the buffer when it becomes too old
    this.bufferFlushTimerHandle = null;
    // unique ID of this connection
    this.connectionId = _ConnectionTracker2.default.generateConnectionID();
    // becomes true when connection to InfluxDB gets verified either automatically or by
    // calling connect()
    this.connected = false;
    // becomes false after the user explicitly calls disconnect(); the connection will
    // not be usable without reconnecting
    this.disconnected = false;
  }

  _createClass(ConnectionImpl, [{
    key: 'onProcessExit',


    // called by the connection tracker when the node process is exiting
    value: function onProcessExit() {
      if (this.writeBuffer.batchSize > 0) {
        console.error('Warning: there are still buffered data points to be written into InfluxDB, ' + 'but the process is about to exit. Forgot to call Connection.flush() ?');
      }
      this.writeBuffer.rejectWritePromises(new _InfluxDBError2.default('Can\'t write data points to InfluxDB, process is exiting'));
    }
  }, {
    key: 'write',
    value: function write(dataPoints, forceFlush) {
      var _this = this;

      try {
        if (!dataPoints) return this.writeEmptySetOfPoints(forceFlush);
        if (!Array.isArray(dataPoints)) {
          if ((typeof dataPoints === 'undefined' ? 'undefined' : _typeof(dataPoints)) === 'object') {
            return this.write([dataPoints], forceFlush);
          }
          return Promise.reject(new _InfluxDBError2.default('Invalid arguments supplied'));
        }
        if (dataPoints.length === 0) return this.writeEmptySetOfPoints(forceFlush);
        return this.whenConnected(function () {
          return _this.writeWhenConnectedAndInputValidated(dataPoints, forceFlush);
        });
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }, {
    key: 'writeEmptySetOfPoints',
    value: function writeEmptySetOfPoints(forceFlush) {
      if (forceFlush) {
        return this.flush();
      }
      return Promise.resolve();
    }
  }, {
    key: 'writeWhenConnectedAndInputValidated',
    value: function writeWhenConnectedAndInputValidated(dataPoints, forceFlush) {
      var batchSizeLimitNotReached = this.options.batchSize > 0 && this.writeBuffer.batchSize + dataPoints.length < this.options.batchSize;
      var timeoutLimitNotReached = this.writeBuffer.firstWriteTimestamp === null || this.options.maximumWriteDelay > 0 && new Date().getTime() - this.writeBuffer.firstWriteTimestamp < this.options.maximumWriteDelay;

      this.writeBuffer.write(dataPoints);

      if (batchSizeLimitNotReached && timeoutLimitNotReached && !forceFlush) {
        // just write into the buffer
        return this.promiseBufferedWrite();
      }
      // write to InfluxDB now, but serialize submitted data points first
      return this.flush();
    }
  }, {
    key: 'promiseBufferedWrite',
    value: function promiseBufferedWrite() {
      var _this2 = this;

      if (this.writeBuffer.firstWriteTimestamp === null) {
        this.writeBuffer.firstWriteTimestamp = new Date().getTime();
        _ConnectionTracker2.default.startTracking(this);
        this.scheduleFlush(function () {
          _this2.flush();
        }, this.options.maximumWriteDelay);
      }
      if (this.options.autoResolveBufferedWritePromises) {
        return Promise.resolve();
      }
      return this.writeBuffer.createPromiseToResolveOnFlush();
    }
  }, {
    key: 'scheduleFlush',
    value: function scheduleFlush(onFlush, delay) {
      if (this.bufferFlushTimerHandle === null) {
        this.bufferFlushTimerHandle = setTimeout(onFlush, delay);
      }
    }
  }, {
    key: 'cancelFlushSchedule',
    value: function cancelFlushSchedule() {
      if (this.bufferFlushTimerHandle !== null) {
        clearTimeout(this.bufferFlushTimerHandle);
        this.bufferFlushTimerHandle = null;
      }
    }
  }, {
    key: 'flush',
    value: function flush() {
      var _this3 = this;

      var url = this.hostUrl + '/write?db=' + this.options.database;
      var bodyBuffer = this.writeBuffer.stream.getContents();
      var flushedWriteBuffer = this.writeBuffer;
      // prevent sending empty requests to the db
      if (flushedWriteBuffer.batchSize === 0) return Promise.resolve();
      // from now on all writes will be redirected to a new buffer
      this.writeBuffer = new _WriteBuffer2.default(this.schemas, this.options.autoGenerateTimestamps);
      // prevent repeated flush call if flush invoked before expiration timeout
      this.cancelFlushSchedule();
      // shutdown hook doesn't need to track this connection any more
      _ConnectionTracker2.default.stopTracking(this);

      return new RequestPromise.Request({
        resolveWithFullResponse: true,
        url: url,
        method: 'POST',
        headers: { 'Content-Type': 'application/text' },
        body: bodyBuffer,
        auth: {
          user: this.options.username,
          pass: this.options.password
        }
      }).then(function (result) {
        if (result.statusCode >= 200 && result.statusCode < 400) {
          flushedWriteBuffer.resolveWritePromises();
          return Promise.resolve();
        }
        var message = 'Influx db write failed ' + result.statusCode;
        // add information returned by the server if possible
        try {
          message += ': ' + JSON.parse(result.body).error;
        } catch (e) {
          // we append the message only if it can be parsed form the response
        }
        return _this3.onFlushError(flushedWriteBuffer, message, bodyBuffer.toString());
      }).catch(function (e) {
        var message = 'Cannot write data to InfluxDB, reason: ' + e.message;
        return _this3.onFlushError(flushedWriteBuffer, message, bodyBuffer.toString());
      });
    }
  }, {
    key: 'onFlushError',
    value: function onFlushError(flushedWriteBuffer, message, data) {
      var error = new _InfluxDBError2.default(message);
      if (this.options.autoResolveBufferedWritePromises) {
        this.options.batchWriteErrorHandler(error, data);
      } else {
        flushedWriteBuffer.rejectWritePromises(error);
      }
      return Promise.reject(error);
    }
  }, {
    key: 'executeQuery',
    value: function executeQuery(query, database) {
      return this.executeRawQuery(query, database).then(ConnectionImpl.postProcessQueryResults);
    }
  }, {
    key: 'executeRawQuery',
    value: function executeRawQuery(query, database) {
      var _this4 = this;

      return this.whenConnected(function () {
        return _this4.executeInternalQuery(query, database);
      });
    }
  }, {
    key: 'executeInternalQuery',
    value: function executeInternalQuery(query, database) {
      var db = !database ? this.options.database : database;
      var url = this.hostUrl + '/query?db=' + encodeURIComponent(db) + '&q=' + encodeURIComponent(query);
      return new RequestPromise.Request({
        resolveWithFullResponse: true,
        url: url,
        auth: {
          user: this.options.username,
          pass: this.options.password
        }
      }).then(function (result) {
        if (result.statusCode >= 200 && result.statusCode < 400) {
          var contentType = result.headers['content-type'];
          if (contentType === 'application/json') {
            var data = JSON.parse(result.body);
            if (data.results[0].error) {
              return Promise.reject(new _InfluxDBError2.default(data.results[0].error));
            }
            return Promise.resolve(data);
          }
          return Promise.reject(new _InfluxDBError2.default('Unexpected result content-type: ' + contentType));
        }
        var error = new _InfluxDBError2.default('HTTP ' + result.statusCode + ' communication error');
        return Promise.reject(error);
      }).catch(function (e) {
        return Promise.reject(new _InfluxDBError2.default('Cannot read data from InfluxDB, reason: ' + e.message));
      });
    }
  }, {
    key: 'connect',
    value: function connect() {
      var _this5 = this;

      if (this.options.autoCreateDatabase) {
        // This works because create database operation is idempotent; unfortunately,
        // SHOW DATABASES requires the same admin permissions as CREATE DATABASE. Therefore
        // there is no point in trying to list the databases first and checking for the one
        // the user is trying to use.
        return this.executeInternalQuery('CREATE DATABASE ' + this.options.database).then(function () {
          _this5.connected = true;
          _this5.disconnected = false;
        });
      }
      var result = this.executeInternalQuery('SHOW DATABASES').then(function (databases) {
        _this5.connected = _this5.doesDatabaseExists(databases);
        _this5.disconnected = !_this5.connected;
        if (!_this5.connected) {
          return result.reject(new _InfluxDBError2.default('Database \'' + _this5.options.database + '\' does not exist'));
        }
        return Promise.resolve();
      }).catch(function () {
        // When user authentication is in use, SHOW DATABASES will fail due to insufficient user
        // privileges Therefore we try if the server is alive at least...
        var url = _this5.hostUrl + '/ping';
        return new RequestPromise.Request({ uri: url }).then(function () {
          _this5.connected = true;
          _this5.disconnected = false;
        }).catch(function (e) {
          return Promise.reject(new _InfluxDBError2.default('Unable to contact InfluxDB, ping operation on \'' + url + '\' failed, reason: ' + e.message));
        });
      });
      return result;
    }
  }, {
    key: 'disconnect',
    value: function disconnect() {
      var result = this.flush();
      this.connected = false;
      this.disconnected = true;
      return result;
    }
  }, {
    key: 'doesDatabaseExists',
    value: function doesDatabaseExists(showDatabasesResult) {
      // there is always _internal database available/visible
      // noinspection JSUnresolvedVariable - we don't want to document InfluxDB result format here
      var values = showDatabasesResult.results[0].series[0].values;
      // this is a lodash problem; it doesn't declare string parameter but it is documented
      // noinspection JSCheckFunctionSignatures
      return _.findIndex(values, this.options.database) >= 0;
    }
  }, {
    key: 'whenConnected',
    value: function whenConnected(action) {
      try {
        if (this.disconnected) {
          return Promise.reject(new _InfluxDBError2.default('Attempt to use a disconnected connection detected'));
        }
        if (!this.connected) {
          return this.connect().then(action);
        }
        return action();
      } catch (e) {
        return Promise.reject(e);
      }
    }
  }], [{
    key: 'stripTrailingSlashIfNeeded',
    value: function stripTrailingSlashIfNeeded(url) {
      if (url.endsWith('/')) return url.substring(0, url.length - 1);
      return url;
    }
  }, {
    key: 'validateSchemas',
    value: function validateSchemas(schemas) {
      _.forEach(schemas, function (schema) {
        if (!schema.measurement) {
          throw new _InfluxDBError2.default('Each data point schema must have "measurement" property defined');
        }
      });
    }

    // Copy the supplied schema so that it won't get affected by further modifications from
    // the user. Also convert tags to a map for faster access during serialization

  }, {
    key: 'prepareSchemas',
    value: function prepareSchemas(schemas) {
      if (schemas) {
        var data = _.map(schemas, function (schema) {
          return {
            measurement: schema.measurement,
            schema: _.cloneDeep(schema),
            tagsDictionary: _.groupBy(schema.tags)
          };
        });
        return _.keyBy(data, 'measurement');
      }
      return {};
    }
  }, {
    key: 'validateteOptions',
    value: function validateteOptions(options) {
      if (!options.database) throw new _InfluxDBError2.default("'database' option must be specified");
    }
  }, {
    key: 'prepareOptions',
    value: function prepareOptions(options) {
      var results = {};
      Object.assign(results, _DefaultConnectionOptions2.default);
      Object.assign(results, options);
      return results;
    }
  }, {
    key: 'postProcessQueryResults',
    value: function postProcessQueryResults(results) {
      var outcome = [];
      _.forEach(results.results, function (queryResult) {
        _.forEach(queryResult.series, function (series) {
          // use for loops form now on to get better performance
          var _iteratorNormalCompletion = true;
          var _didIteratorError = false;
          var _iteratorError = undefined;

          try {
            for (var _iterator = series.values[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
              var values = _step.value;

              var result = {};
              var i = 0;
              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;
              var _iteratorError2 = undefined;

              try {
                for (var _iterator2 = series.columns[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                  var columnName = _step2.value;

                  if (columnName === 'time') {
                    try {
                      result[columnName] = new Date(values[i]);
                    } catch (e) {
                      result[columnName] = values[i];
                    }
                  } else {
                    result[columnName] = values[i];
                  }
                  i += 1;
                }
              } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion2 && _iterator2.return) {
                    _iterator2.return();
                  }
                } finally {
                  if (_didIteratorError2) {
                    throw _iteratorError2;
                  }
                }
              }

              if (series.tags) Object.assign(result, series.tags);
              outcome.push(result);
            }
          } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
              }
            } finally {
              if (_didIteratorError) {
                throw _iteratorError;
              }
            }
          }
        });
      });
      return Promise.resolve(outcome);
    }
  }]);

  return ConnectionImpl;
}();

exports.default = ConnectionImpl;
module.exports = exports['default'];