/*
 * This file is part of eyeo's Web Extension Ad Blocking Toolkit (EWE),
 * Copyright (C) 2006-present eyeo GmbH
 *
 * EWE is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * EWE is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with EWE.  If not, see <http://www.gnu.org/licenses/>.
 */

const _UNKNOWN = "UNKNOWN";
const _MAX_DOMAIN_LENGTH = 25;

/**
 * Maintain a running size of a metrics dictionary
 * and only add a new domain if there is space,
 * otherwise increment metrics against an UNKNOWN domain.
 * @ignore
 */
export class MaxLengthMetricsDict {
  /**
   * Initiate a MaxLengthMetricsDict
   *
   * @param {Number} maxLength The maximum length of the serialized string
   *                           in bytes. For example 90000 for 90Kb.
   * @param {Array<String>} metrics A list of names of metrics to collect
   *                                e.g. ["impression", "session"].
   * @param {?String|Number} space JSON formatting options (space).
   *                        (2 by default)
   * @throws {Error} "No metrics"
   */
  constructor(maxLength, metrics, space = 2) {
    if (!metrics || metrics.length == 0) {
      throw new Error("No metrics");
    }

    this.metrics = metrics;
    this.maxLength = maxLength;
    this.metricsDict = new Map();
    this.space = space;

    // line indentation length
    this.indentationLength = this.space ? (typeof this.space === "number" ?
      this.space :
      this.space.length) : 0;

    // line separator length
    this.newLineLength = this.indentationLength > 0 ? 1 : 0;

    // serialized object (result) length
    this.length = 2; // array opening and closing brackets

    this._calcMetricsLength();
  }

  _calcLineLength(property, value) {
    // __"property": value
    // _"site_id" : "UNKNOWN"
    return this.indentationLength * 2 +
      // * 2 as it's 2nd level of indentation: (array/object)
      2 + // quotes
      property.length +
      1 + // colon
      (this.indentationLength > 0 ? 1 : 0) + // space
      value.length;
  }

  _calcMetricsLength() {
    this.metricsLength = 0; // length of empty metric section
    for (const metric of this.metrics) {
      this.metricsLength += this._calcLineLength(metric, "0");
    }
    if (this.metrics.length > 1) {
      this.metricsLength += this.metrics.length - 1; // commas
      if (this.newLineLength > 0) {
        this.metricsLength += this.metrics.length - 1; // new lines
      }
    }
  }

  /**
   * Calculate how much larger in bytes the serialised object is going to be
   * with the addition of a new domain. This will vary based on the
   * serialisation. The estimate does not need to be perfect. We can have some
   * leeway by reducing the max length in bytes.
   *
   * @param {String} domain Domain
   * @returns {Number} Bytes
   */
  _calcAdditionalLength(domain) {
    /* Example:
  ,
  {
    "site_id": "UNKNOWN",
    "sessions_count": 0
  }
    */
    return (this.metricsDict.size > 0 ?
        1 /* comma */ :
        this.newLineLength /* new line between [] */) +
      this.newLineLength +
      this.indentationLength + 1 + // opening curly bracket
      this.newLineLength + // \n
      this._calcLineLength("site_id", `"${domain}"`) +
      1 + // commas between site_id line and metrics lines
      this.newLineLength + // \n
      this.metricsLength +
      // metrics section length assuming all the values are "0"s
      this.indentationLength + this.newLineLength + // \n
      1; // closing curly bracket
  }

  /**
   * Adds or increments a metric for a given domain.
   * If there isn't enough space, it updates the metrics for the UNKNOWN domain.
   *
   * @param {String} domain Domain
   * @param {String} metric Metric. It must known metrics
   * @param {Number} increment Increment
   * @throws {Error} "Unknown metric"
   */
  addMetric(domain, metric, increment) {
    if (!this.metrics.includes(metric)) {
      throw new Error("Unknown metric");
    }

    if (!this.metricsDict.has(domain)) {
      const additionalLength = this._calcAdditionalLength(domain);
      if ((domain.length > _MAX_DOMAIN_LENGTH) ||
          (this.length + additionalLength) > this.maxLength) {
        domain = _UNKNOWN;
        if (!this.metricsDict.has(domain)) {
          this.length += this._calcAdditionalLength(domain);
        }
      }
      else {
        this.length += additionalLength;
      }

      // init stats
      if (!this.metricsDict.has(domain)) {
        let stats = {};
        for (const eachMetric of this.metrics) {
          stats[eachMetric] = 0;
        }
        this.metricsDict.set(domain, stats);
      }
    }
    let stats = this.metricsDict.get(domain);
    stats[metric] += increment;
  }

  /**
   * Return formatted JSON length (precalculated)
   * @returns {Number} Formatted JSON length
   */
  getLength() {
    return this.length;
  }

  /**
   * Serialise the dictionary for transport.
   *
   * A proto format would likely be more storage efficient.
   * @returns {String} String representation of the dictionary
   */
  serialize() {
    let result = [];
    for (const [domain, stats] of this.metricsDict) {
      result.push({
        site_id: domain,
        ...stats
      });
    }

    return JSON.stringify(result, null, this.space);
  }
}


