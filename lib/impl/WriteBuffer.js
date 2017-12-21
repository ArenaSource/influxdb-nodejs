'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _streamBuffers = require('stream-buffers');

var StreamBuffers = _interopRequireWildcard(_streamBuffers);

var _lodash = require('lodash');

var _ = _interopRequireWildcard(_lodash);

var _InfluxDBError = require('../InfluxDBError');

var _InfluxDBError2 = _interopRequireDefault(_InfluxDBError);

var _Field = require('../Field');

var _Field2 = _interopRequireDefault(_Field);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Represents a single data point batch buffer written into into the database. It provides a write
 * method to add new points and a getContent() method to retrieve the content of the buffer.
 *
 * @ignore
 */
var WriteBuffer = function () {
  function WriteBuffer(schemas, autoGenerateTimestamps) {
    _classCallCheck(this, WriteBuffer);

    this.schemas = schemas;
    this.autoGenerateTimestamps = autoGenerateTimestamps;
    this.stream = new StreamBuffers.WritableStreamBuffer();
    this.firstWriteTimestamp = null;
    this.batchSize = 0;
    // stores promise resolve/reject functions for writes that are buffered so that these write
    // promises are resolved/rejected when the buffer is flushed. The values are objects with
    // resolve/reject properties holding the the promise reject/resolve functions
    this.writePromises = [];
  }

  _createClass(WriteBuffer, [{
    key: 'createPromiseToResolveOnFlush',
    value: function createPromiseToResolveOnFlush() {
      var _this = this;

      return new Promise(function (resolve, reject) {
        _this.writePromises.push({ resolve: resolve, reject: reject });
      });
    }
  }, {
    key: 'resolveWritePromises',
    value: function resolveWritePromises() {
      _.forEach(this.writePromises, function (promise) {
        promise.resolve();
      });
    }
  }, {
    key: 'rejectWritePromises',
    value: function rejectWritePromises(error) {
      _.forEach(this.writePromises, function (promise) {
        promise.reject(error);
      });
    }
  }, {
    key: 'write',
    value: function write(dataPoints) {
      var _this2 = this;

      _.forEach(dataPoints, function (dataPoint) {
        _this2.validateDataPoint(dataPoint);
      });
      _.forEach(dataPoints, function (dataPoint) {
        _this2.serializeDataPoint(dataPoint);
        _this2.batchSize += 1;
      });
    }
  }, {
    key: 'validateDataPoint',
    value: function validateDataPoint(dataPoint) {
      this.validateTags(dataPoint);
      this.validateFields(dataPoint);
      WriteBuffer.validateTimestamp(dataPoint);
    }
  }, {
    key: 'validateTags',
    value: function validateTags(dataPoint) {
      var _this3 = this;

      if (Array.isArray(dataPoint.tags)) {
        _.forEach(dataPoint.tags, function (tag) {
          if ((typeof tag === 'undefined' ? 'undefined' : _typeof(tag)) !== 'object') {
            throw new _InfluxDBError2.default('When defining tags as an array, all array members must be objects' + (' with key and value properties: Measurement: ' + dataPoint.measurement));
          }
          if (!tag.key) {
            throw new _InfluxDBError2.default('When defining tags as objects, key property must be supplied. Measurement: ' + dataPoint.measurement);
          }
          _this3.validateTagValue(tag.value, tag.key, dataPoint);
        });
      } else if (_typeof(dataPoint.tags) === 'object') {
        _.forOwn(dataPoint.tags, function (tagValue, tagKey) {
          _this3.validateTagValue(tagValue, tagKey, dataPoint);
        });
      } else if (dataPoint.tags) {
        throw new _InfluxDBError2.default('Datapoint tags must be supplied as an array or object');
      }
    }
  }, {
    key: 'validateTagValue',
    value: function validateTagValue(value, tagName, dataPoint) {
      var schema = this.schemas[dataPoint.measurement];
      if (typeof value !== 'string') throw new _InfluxDBError2.default('Invalid tag value type, must be a string');
      if (schema && schema.tagsDictionary && !schema.tagsDictionary[tagName]) {
        throw new _InfluxDBError2.default('Tag value \'' + value + '\' is not allowed for measurement ' + (dataPoint.measurement + ' based on schema.'));
      }
    }
  }, {
    key: 'validateFields',
    value: function validateFields(dataPoint) {
      var _this4 = this;

      var fieldsDefined = false;
      if (!dataPoint.fields) WriteBuffer.reportMissingFields(dataPoint);
      if (Array.isArray(dataPoint.fields)) {
        _.forEach(dataPoint.fields, function (field) {
          if (typeof field.key !== 'string') {
            throw new _InfluxDBError2.default('Field key must be a string, measurement: \'' + dataPoint.measurement + '\'');
          }
          if (field.value != null) {
            _this4.validateFieldValue(field.value, field.key, dataPoint);
            fieldsDefined = true;
          }
        });
      } else if (_typeof(dataPoint.fields) === 'object') {
        _.forOwn(dataPoint.fields, function (fieldValue, fieldKey) {
          if (fieldValue != null) {
            _this4.validateFieldValue(fieldValue, fieldKey, dataPoint);
            fieldsDefined = true;
          }
        });
      } else {
        throw new _InfluxDBError2.default('Data point fields property must be an array or an object');
      }

      if (!fieldsDefined) WriteBuffer.reportMissingFields(dataPoint);
    }
  }, {
    key: 'validateFieldValue',
    value: function validateFieldValue(value, fieldName, dataPoint) {
      var schema = this.getSchemaRecord(dataPoint.measurement);
      var userSpecifiedType = WriteBuffer.getUserSpecifiedType(schema, fieldName);
      if (schema && schema.fields && userSpecifiedType === null) {
        throw new _InfluxDBError2.default('Field ' + fieldName + ' is not declared in the schema' + (' for measurement ' + dataPoint.measurement));
      }
      if (userSpecifiedType) {
        switch (userSpecifiedType) {
          case _Field2.default.STRING:
            WriteBuffer.validateType('string', typeof value === 'undefined' ? 'undefined' : _typeof(value), fieldName, dataPoint);
            return;
          case _Field2.default.BOOLEAN:
            WriteBuffer.validateType('boolean', typeof value === 'undefined' ? 'undefined' : _typeof(value), fieldName, dataPoint);
            return;
          case _Field2.default.FLOAT:
            WriteBuffer.validateType('number', typeof value === 'undefined' ? 'undefined' : _typeof(value), fieldName, dataPoint);
            return;
          case _Field2.default.INTEGER:
            WriteBuffer.validateType('number', typeof value === 'undefined' ? 'undefined' : _typeof(value), fieldName, dataPoint);
            WriteBuffer.validateInteger(value, fieldName, dataPoint);
            return;
          default:
        }
      } else {
        switch (typeof value === 'undefined' ? 'undefined' : _typeof(value)) {
          case 'string':
          case 'boolean':
          case 'number':
            return;
          default:
        }
      }
      throw new _InfluxDBError2.default('Unsupported value type:' + (typeof value === 'undefined' ? 'undefined' : _typeof(value)));
    }
  }, {
    key: 'serializeDataPoint',
    value: function serializeDataPoint(dataPoint) {
      var outputStream = this.stream;
      outputStream.write(WriteBuffer.escapeMeasurementName(dataPoint.measurement));
      if (dataPoint.tags) {
        outputStream.write(',');
        this.serializeTags(dataPoint);
      }
      outputStream.write(' ');
      this.serializeFields(dataPoint);
      outputStream.write(' ');
      outputStream.write(WriteBuffer.serializeTimestamp(dataPoint.timestamp));
      outputStream.write('\n');
    }
  }, {
    key: 'serializeTags',
    value: function serializeTags(dataPoint) {
      var outputStream = this.stream;
      if (Array.isArray(dataPoint.tags)) {
        _.forEach(dataPoint.tags, function (tag) {
          outputStream.write(WriteBuffer.escape(tag.key));
          outputStream.write('=');
          outputStream.write(WriteBuffer.escape(tag.value));
        });
      } else if (_typeof(dataPoint.tags) === 'object') {
        _.forOwn(dataPoint.tags, function (tagValue, tagKey) {
          outputStream.write(WriteBuffer.escape(tagKey));
          outputStream.write('=');
          outputStream.write(WriteBuffer.escape(tagValue));
        });
      }
    }
  }, {
    key: 'serializeFields',
    value: function serializeFields(dataPoint) {
      var schema = this.getSchemaRecord(dataPoint.measurement);
      var outputStream = this.stream;
      if (Array.isArray(dataPoint.fields)) {
        _.forEach(dataPoint.fields, function (field) {
          // do not serialize fields with null & undefined values
          if (field.value != null) {
            var userSpecifiedType = WriteBuffer.getUserSpecifiedType(schema, field.key);
            outputStream.write(WriteBuffer.escape(field.key));
            outputStream.write('=');
            outputStream.write(WriteBuffer.serializeFieldValue(field.value, userSpecifiedType));
          }
        });
      } else if (_typeof(dataPoint.fields) === 'object') {
        _.forOwn(dataPoint.fields, function (fieldValue, fieldKey) {
          // do not serialize fields with null & undefined values
          if (fieldValue != null) {
            var userSpecifiedType = WriteBuffer.getUserSpecifiedType(schema, fieldKey);
            outputStream.write(WriteBuffer.escape(fieldKey));
            outputStream.write('=');
            outputStream.write(WriteBuffer.serializeFieldValue(fieldValue, userSpecifiedType));
          }
        });
      }
    }
  }, {
    key: 'getSchemaRecord',
    value: function getSchemaRecord(measurement) {
      var schemaRecord = this.schemas[measurement];
      return schemaRecord ? schemaRecord.schema : undefined;
    }

    /*
     * Escape tag keys, tag values, and field keys
     * see https://docs.influxdata.com/influxdb/latest/write_protocols/line_protocol_reference/#special-characters
     */

  }], [{
    key: 'reportMissingFields',
    value: function reportMissingFields(dataPoint) {
      throw new _InfluxDBError2.default('Data point has no fields in measurement \'' + dataPoint.measurement + '\'');
    }
  }, {
    key: 'getUserSpecifiedType',
    value: function getUserSpecifiedType(schema, fieldKey) {
      if (schema && schema.fields) {
        return schema.fields[fieldKey];
      }
      return undefined;
    }
  }, {
    key: 'validateType',
    value: function validateType(expectedType, givenType, fieldName, dataPoint) {
      if (givenType !== expectedType) {
        throw new _InfluxDBError2.default('Invalid type supplied for field \'' + fieldName + '\' of ' + ('measurement \'' + dataPoint.measurement + '.\' ') + ('Supplied \'' + givenType + '\' but \'' + expectedType + '\' is required'));
      }
    }
  }, {
    key: 'validateInteger',
    value: function validateInteger(value, fieldName, dataPoint) {
      if (value !== Math.floor(value)) {
        throw new _InfluxDBError2.default('Invalid value supplied for field \'' + fieldName + '\' of ' + ('measurement \'' + dataPoint.measurement + '\'. ') + 'Should have been an integer but supplied number has a fraction part.');
      }
    }
  }, {
    key: 'validateTimestamp',
    value: function validateTimestamp(dataPoint) {
      var timestamp = dataPoint.timestamp;
      switch (typeof timestamp === 'undefined' ? 'undefined' : _typeof(timestamp)) {
        case 'string':
        case 'number':
        case 'undefined':
          break;
        case 'object':
          if (typeof timestamp.getTime !== 'function') {
            throw new _InfluxDBError2.default('Timestamp must be an instance of Date');
          }
          break;
        default:
          throw new _InfluxDBError2.default('Unsupported timestamp type: ' + (typeof timestamp === 'undefined' ? 'undefined' : _typeof(timestamp)));
      }
    }
  }, {
    key: 'serializeFieldValue',
    value: function serializeFieldValue(value, userSpecifiedType) {
      if (userSpecifiedType) {
        switch (userSpecifiedType) {
          case _Field2.default.STRING:
            return '"' + WriteBuffer.escapeStringFieldValue(value) + '"';
          case _Field2.default.BOOLEAN:
            return value ? 'T' : 'F';
          case _Field2.default.FLOAT:
            return value.toString();
          case _Field2.default.INTEGER:
            return value + 'i';
          default:
        }
      } else {
        switch (typeof value === 'undefined' ? 'undefined' : _typeof(value)) {
          case 'string':
            return '"' + WriteBuffer.escapeStringFieldValue(value) + '"';
          case 'boolean':
            return value ? 'T' : 'F';
          case 'number':
            return value.toString();
          default:
        }
      }
      throw new _InfluxDBError2.default('Unsupported field value type: ' + (typeof value === 'undefined' ? 'undefined' : _typeof(value)));
    }
  }, {
    key: 'escape',
    value: function escape(s) {
      return s.replace(/([,= ])/g, '\\$1');
    }
  }, {
    key: 'escapeMeasurementName',
    value: function escapeMeasurementName(s) {
      return s.replace(/([ ,])/g, '\\$1');
    }
  }, {
    key: 'escapeStringFieldValue',
    value: function escapeStringFieldValue(s) {
      return s.replace(/(["])/g, '\\$1');
    }
  }, {
    key: 'serializeTimestamp',
    value: function serializeTimestamp(timestamp) {
      switch (typeof timestamp === 'undefined' ? 'undefined' : _typeof(timestamp)) {
        case 'string':
          return timestamp;
        case 'object':
          return WriteBuffer.convertMsToNs(timestamp.getTime());
        case 'number':
          return WriteBuffer.convertMsToNs(timestamp);
        case 'undefined':
          return this.autoGenerateTimestamps ? WriteBuffer.convertMsToNs(new Date().getTime()) : '';
        default:
          throw new _InfluxDBError2.default('Assertion failed.');
      }
    }

    // convert number/string in unix ms format into nanoseconds as required by InfluxDB

  }, {
    key: 'convertMsToNs',
    value: function convertMsToNs(ms) {
      return ms + '000000';
    }
  }]);

  return WriteBuffer;
}();

exports.default = WriteBuffer;
module.exports = exports['default'];