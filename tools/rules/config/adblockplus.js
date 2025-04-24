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

const typeAds = [
  // ar
  "684A25C6-6B5D-458A-8A2B-BAC0A12B0B15",
  // as, bn, gu, hi, kn, ml, mr, ne, or, pa, si, te
  "25A31255-AB36-48A4-9086-06192DE71119",
  // bg
  "E22C3B40-DC90-49D7-8BF5-E60904AB159A",
  // bs, el, hr, sl, sr, th
  "EF6F4884-47DB-46A5-AAF8-8EB819D8D4D8",
  // cs, sk
  "4B6CE485-30AB-4213-AD17-504B3F2D2825",
  // da, fi, fo, is, kl, nb, nn, no, sv
  "96932CD9-6DDF-4D97-B92F-FDF747B6FAA2",
  // de
  "0CD3D105-D3B3-4652-8489-94163DE9A08F",
  // en
  "8C13E995-8F06-4927-BEA7-6C845FB7EEBF",
  // es
  "C3D13A19-3E8D-41F5-AD64-0F3B36DDE128",
  // fr
  "2CEA1481-C29C-44F1-A084-A2A019533797",
  // he
  "07549D8B-F06F-4D9D-A567-929AA59E9D1D",
  // hu
  "88D3F7EA-D99E-43C6-92E0-D89C8A0E7EA9",
  // id, ms
  "B7D76369-DD19-4602-80E8-2E32DDB490AC",
  // it
  "BBC07C05-66F1-42EC-BD4D-7AD495FAC84B",
  // ja
  "361001BD-8F57-4736-97B1-F332C3D79E5D",
  // ko
  "2708BCB7-2E45-41BC-B517-1730CF532F89",
  // lt
  "CBE50FA2-DE3F-480C-B1D7-04289391C033",
  // lv
  "950C88EA-2DD1-42E3-B2A2-2DF2ED15563A",
  // nl
  "A4B88FB6-E5E5-417F-8A49-20B8244995FD",
  // pl
  "3D2C09D0-DF1C-4C8E-9947-A23DCEAF8F8B",
  // pt
  "14DF7BE6-9675-4E07-987A-D8A1000F9FEF",
  // ro
  "EEEF75EC-B2B4-49F4-BC49-17B08266F334",
  // ru, uk
  "1B5F78CA-8B30-4BDF-B0A3-451CB2202984",
  // tr
  "D99D3350-7F11-43E1-87CB-FDE0C78E8CD6",
  // vi
  "1C571EC7-6E52-47CC-B04A-4B3008D0AEBE",
  // zh
  "9BD3EA2F-889D-4CC3-B680-CF484F2BD1B9",
];

const typeAllowing = [
  // full
  "0798B6A2-94A4-4ADF-89ED-BEC112FC4C7F",
  // privacy
  "F12E0801-A00B-49DE-B1E3-52C9C4F90C8C",
];

export const recommended = [
  ...typeAds,
  ...typeAllowing,
  // annoyances
  "CDAD4CF5-2706-42CB-B404-F5B9B61B8CAA",
  // circumvention
  "D4028CDD-3D39-4624-ACC7-8140F4EC3238",
  // cookies-premium
  "588470E8-E163-4CD9-A909-521B2A3BE73F",
  // notifications
  "5BD2BB73-459D-4A74-AF9D-A10157268350",
  // privacy
  "D72B6F06-52B2-4FED-96A2-1BF59CDD7AEC",
  // social
  "0A679439-445F-4DE7-84B9-88341F6DA520",
  // videos
  "294D21F0-B3DC-11EF-9B01-F73C7F3A4DB5",
];

export const privileged = [
  // annoyances
  "CDAD4CF5-2706-42CB-B404-F5B9B61B8CAA",
  // cookies-premium
  "588470E8-E163-4CD9-A909-521B2A3BE73F",
  // videos
  "294D21F0-B3DC-11EF-9B01-F73C7F3A4DB5",
];
