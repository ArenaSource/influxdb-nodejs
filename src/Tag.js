/**
 * Tag is a key-value pair in InfluxDB’s data structure that records metadata.
 * See: https://docs.influxdata.com/influxdb/v1.2/concepts/glossary/#tag
 *
 * @public
 * @typedef {Object} Tag
 * @property {String} key The key part of the key-value pair that makes up a tag.
 * @property {String} value The value part of the key-value pair that makes up a tag
 *
 * @example
 *
 * let tag={
 *    key: 'location',
 *    value: 'outdoor'
 * }
 *
 */