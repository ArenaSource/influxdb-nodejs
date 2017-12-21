'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.InfluxDBError = exports.FieldType = exports.Connection = undefined;

var _Field = require('./Field');

var _Field2 = _interopRequireDefault(_Field);

var _Connection = require('./Connection');

var _Connection2 = _interopRequireDefault(_Connection);

var _InfluxDBError = require('./InfluxDBError');

var _InfluxDBError2 = _interopRequireDefault(_InfluxDBError);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * @ignore
 */
exports.Connection = _Connection2.default;
exports.FieldType = _Field2.default;
exports.InfluxDBError = _InfluxDBError2.default;
/**
 * @ignore
 */
/**
 * This is the main import of the influxdb-node.js package.
 *
 * @public
 * @typedef {Object} InfluxDB
 * @property {Connection} Connection reference to the {@link Connection} object
 * @property {FieldType} FieldType reference to the {@link FieldType} object, used to define
 *   measurement schemas
 *
 * @example
 * const InfluxDB=require('influxdb-nodejs');
 *
 * const connection=new InfluxDB.Connection({
 *       hostUrl: 'http://localhost:8086',
 *       database: 'mydb'
 * });
 *
 * ...
 *
 */

/**
 * @ignore
 */