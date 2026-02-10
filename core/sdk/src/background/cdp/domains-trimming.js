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
   * @param {Number} maxLength The maximum length of the serialized string in
   *                           bytes. For example 90000 for 90Kb. This is
   *                           treated as a soft limit, with critical data like
   *                           the "_UNKNOWN" domain and event stats being added
   *                           even if it exceeds this limit.
   * @param {Array<String>} metrics A list of names of metrics to collect
   *                                e.g. ["impression", "session"].
   * @param {boolean} supportEventStats Whether or not we can add an "es"
   * property to the output.
   * @param {?String|Number} space JSON formatting options (space).
   *                        (2 by default)
   * @throws {Error} "No metrics"
   */
  constructor(maxLength, metrics, supportEventStats, space = 2) {
    if (!metrics || metrics.length == 0) {
      throw new Error("No metrics");
    }

    this.metrics = metrics;
    this.maxLength = maxLength;
    this.metricsDict = new Map();
    this.eventsDict = new Map();
    this.space = space;
    this.supportEventStats = supportEventStats;

    // line indentation length
    this.indentationLength = this.space ? (typeof this.space === "number" ?
      this.space :
      this.space.length) : 0;

    // If there's any indentation, then the colon has a space after it.
    this.colonLength = this.indentationLength > 0 ? 2 : 1;

    // line separator length
    this.newLineLength = this.indentationLength > 0 ? 1 : 0;

    // serialized object (result) length
    this.length = 1 + // {
      this.newLineLength +
      this.indentationLength +
      4 + // "ds"
      this.colonLength +
      2 + // []
      this.newLineLength +
      1; // }

    if (supportEventStats) {
      // With eventStats, our empty object additionally has: ,"es":[]
      this.length += 1 + // comma
        this.newLineLength +
        this.indentationLength +
        4 + // "es"
        this.colonLength +
        2; // []
    }

    this._calcMetricsLength();
  }

  _calcLineLength(property, value) {
    // __"property": value
    // _"i" : "UNKNOWN"
    return this.indentationLength * 3 +
      // * 2 as it's 3rd level of indentation: (array/object)
      2 + // quotes
      property.length +
      this.colonLength +
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
    /* The new domain will add a metrics object in this format, with <domain>
     * being per the domain passed into this function and <metrics> being the
     * serialized list of metrics as passed to the contructor:
     *
     * ,
     * {
     *   "i": "<domain>",
     *   <metrics>
     * }
     */
    return (this.metricsDict.size > 0 ?
        1 /* comma */ :
      this.newLineLength + this.indentationLength /* new line between [] */) +
      this.newLineLength +
      this.indentationLength * 2 + 1 + // opening curly bracket
      this.newLineLength + // \n
      this._calcLineLength("i", `"${domain}"`) +
      1 + // commas between `i` line and metrics lines
      this.newLineLength + // \n
      this.metricsLength + // metrics section length assuming all values are "0"
      this.newLineLength + this.indentationLength * 2 + // \n
      1; // closing curly bracket
  }

  /**
   * Calculate how much larger in bytes the serialised object is going to be
   * with the addition of a new event. This will vary based on the
   * serialisation. The estimate does not need to be perfect. We can have some
   * leeway by reducing the max length in bytes.
   *
   * @param {String} event Event name
   * @param {Number} count Number of events seen
   * @returns {Number} Bytes
   */
  _calcAdditionalEventLength(event, count) {
    /* The new event will add an object to the "es" array:
     *
     * {
     *   "e": "<event>",
     *   "c": <count>
     * }
     */
    let padding = this.eventsDict.size > 0 ?
        1 : // comma
        this.newLineLength + this.indentationLength; // new line between []

    return padding +
      this.newLineLength + // newline after comma or after [
      this.indentationLength * 2 + 1 + // opening curly bracket with indentation
      this.newLineLength + // newline after {
      this._calcLineLength("e", `"${event}"`) + // "e": "eventName" line
      1 + // comma between "e" and "c"
      this.newLineLength + // newline after comma
      this._calcLineLength("c", count.toString()) + // "c": count line
      this.newLineLength + // newline before }
      this.indentationLength * 2 + 1; // closing curly bracket with indentation
  }

  /**
   * Adds or increments an event.
   *
   * @param {String} event Event name
   * @param {Number} increment Number of events seen
   */
  addEvent(event, increment) {
    if (!this.supportEventStats) {
      return;
    }

    if (!this.eventsDict.has(event)) {
      this.length += this._calcAdditionalEventLength(event, increment);
      this.eventsDict.set(event, increment);
    }
    else {
      let before = this.eventsDict.get(event) || 0;
      let after = before + increment;

      this.length += after.toString().length - before.toString().length;
      this.eventsDict.set(event, after);
    }
  }

  /**
   * Adds or increments a metric for a given domain. If there isn't enough
   * space, it updates the metrics for the UNKNOWN domain. Does nothing if the
   * metric is not one of the ones provided to the constructor.
   *
   * @param {String} domain Domain
   * @param {String} metric Metric. It must be known metrics
   * @param {Number} increment Increment
   */
  addMetric(domain, metric, increment) {
    if (!this.metrics.includes(metric)) {
      return;
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
    let before = stats[metric];
    let after = before + increment;

    this.length += after.toString().length - before.toString().length;
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
    const result = {ds: []};
    for (const [domain, stats] of this.metricsDict) {
      result.ds.push({
        i: domain,
        ...stats
      });
    }

    if (this.supportEventStats) {
      result.es = [];
      for (const [event, count] of this.eventsDict) {
        result.es.push({e: event, c: count});
      }
    }

    return JSON.stringify(result, null, this.space);
  }
}
