"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * When using the {@link Connection}, errors will be signaled by this class.
 *
 * @property
 */
var InfluxDBError = function (_Error) {
  _inherits(InfluxDBError, _Error);

  /**
   * @param {String} message Information about the error
   * @param {String} [data] Holds data points formatted using InfluxDB line protocol that were not
   *  written into the database due to errors in the communication with InfluxDB
   */
  function InfluxDBError(message, data) {
    _classCallCheck(this, InfluxDBError);

    var _this = _possibleConstructorReturn(this, (InfluxDBError.__proto__ || Object.getPrototypeOf(InfluxDBError)).call(this, message));

    _this.data = data;
    return _this;
  }

  return InfluxDBError;
}(Error);

exports.default = InfluxDBError;
module.exports = exports["default"];