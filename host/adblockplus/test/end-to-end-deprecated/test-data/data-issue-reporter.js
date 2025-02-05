/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

"use strict";

module.exports = {
  commentLabelText: "Comment:",
  commentText: "TESTING, ignore report.",
  emailLabelText: "Email:",
  emailText: "********@a******.o*****",
  filterData: [
    '<filter text="testpages.eyeo.com/js/test-script.js" subscriptions="h' +
      'ttps://easylist-downloads.adblockplus.org/easylist.txt" hitCount="1"/>',
    '<filter text="testpages.eyeo.com/js/test-script-regex*" subscriptions="https://easylist-downlo' +
      'ads.adblockplus.org/easylist.txt" hitCount="2"/>',
    '<filter text="testpages.eyeo.com##.test-element-class" subscriptions="https://easylist-downloads.a' +
      'dblockplus.org/easylist.txt" hitCount="1"/>',
    '<filter text="testpages.eyeo.com###test-element-id" subscriptions="https' +
      '://easylist-downloads.adblockplus.org/easylist.txt" hitCount="1"/>'
  ],
  issueTypeLableText: "Issue type:",
  issueTypeText: "False positive",
  otherIssuesText:
    "For all other issues, please contact us via support@adblockplus.org.",
  privacyPolicyUrl: "https://adblockplus.org/en/privacy#issue-reporter",
  reportBeingProcessedText:
    "Please wait, the report is being processed. " +
    "This will usually take at most 1 minute. You do not need to reload this" +
    " page, it will reload automatically.",
  testPageUrl: "http://testpages.eyeo.com:3005/easylist-filters.html",
  topNoteText:
    "Note: An additional tab will temporarily open so the " +
    "page you are on won't be affected by the Issue Reporter.",
  requestData: [
    '<request location="http://testpages.eyeo.com:3005/easylist-filters.html" type="DOCUMENT" docDomain="null" thirdPar' +
      'ty="undefined" count="3" filter="testpages.eyeo.com##.test-element-id"/>',
    '<request location="http://testpages.eyeo.com:3005/easylist-filters.html" type="DOCUMENT" docDomain="null" thirdPar' +
      'ty="undefined" count="3" filter="testpages.eyeo.com##.test-element-class"/>',
    '<request location="http://testpages.eyeo.com:3005/js/test-script.js" type="SCRIPT" docDomain="testpages.' +
      'thirdParty="undefined" count="1" filter="testpages.eyeo.com/js/test-script.js"/>',
    '<request location="http://testpages.eyeo.com:3005/js/test-script-regex.js" type="SCRIPT" docDomain="testpages.' +
      'eyeo.com:3005" thirdParty="undefined" count="1" filter="testpages.eyeo.com##.test-element-class"/>'
  ],
  savedReportText:
    "Your report has been saved. You can access it at " +
    "the following address",
  statusCellLabelText: "Status:",
  statusCellText: "unknown",
  subscriptionsRegex: [
    /<subscription id="https:\/\/easylist-downloads\.adblockplus\.org\/easylist\.txt" version="\d*" lastDownloadAttempt=".*" lastDownloadSuccess=".*" softExpiration="\d*" hardExpiration="\d*" downloadStatus="synchronize_ok" disabledFilters="0"\/>/,
    /<subscription id="https:\/\/easylist-downloads\.adblockplus\.org\/abp-filters-anti-cv\.txt" version="\d*" lastDownloadAttempt=".*" lastDownloadSuccess=".*" softExpiration="\d*" hardExpiration="\d*" downloadStatus="synchronize_ok" disabledFilters="0"\/>/,
    /<subscription id="https:\/\/easylist-downloads\.adblockplus\.org\/exceptionrules\.txt" version="\d*" lastDownloadAttempt=".*" lastDownloadSuccess=".*" softExpiration="\d*" hardExpiration="\d*" downloadStatus="synchronize_ok" disabledFilters="0"\/>/
  ],
  timeCellText: "Time:",
  websiteLabelText: "Website:",
  websiteCellHref: "http://testpages.eyeo.com:3005/easylist-filters.html"
};
