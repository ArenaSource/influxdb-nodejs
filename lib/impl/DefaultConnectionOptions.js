'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/*
 * Default options for {@link Connection.connect}
 * @ignore
 */
var DefaultConnectionOptions = {
  username: 'root',
  password: 'root',
  hostUrl: 'http://localhost:8086',
  autoCreateDatabase: true,
  autoResolveBufferedWritePromises: true,
  maximumWriteDelay: 1000,
  batchSize: 1000,
  batchWriteErrorHandler: function batchWriteErrorHandler(e, dataPoints) {
    console.error('Error writing data points into InfluxDB:\n' + dataPoints, e);
  }
};

exports.default = DefaultConnectionOptions;
module.exports = exports['default'];