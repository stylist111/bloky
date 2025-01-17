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

export const TEST_PAGES_DOMAIN = "localhost";
export const CROSS_DOMAIN = "127.0.0.1";
export const TEST_PAGES_PORT = 3000;
export const TEST_PAGES_URL = `http://${TEST_PAGES_DOMAIN}:${TEST_PAGES_PORT}`;
export const CROSS_DOMAIN_URL = `http://${CROSS_DOMAIN}:${TEST_PAGES_PORT}`;
export const TEST_ADMIN_PAGES_PORT = 3003;
export const TEST_ADMIN_PAGES_URL = `http://${TEST_PAGES_DOMAIN}:${TEST_ADMIN_PAGES_PORT}`;
// the page will be served with this sitekey if you pass in sitekey=1
// as a query param. Eg http://localhost:3000/image.html?sitekey=1
export const SITEKEY = "MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBANGtTstne7" +
                       "e8MbmDHDiMFkGbcuBgXmiVesGOG3gtYeM1EkrzVhBj" +
                       "GUvKXYE4GLFwqty3v5MuWWbvItUWBTYoVVsCAwEAAQ";
