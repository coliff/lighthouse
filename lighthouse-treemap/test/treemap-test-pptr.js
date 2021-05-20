/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-env jest */

/* global document, window */

const fs = require('fs');
const puppeteer = require('../../node_modules/puppeteer/index.js');
const {server} = require('../../lighthouse-cli/test/fixtures/static-server.js');
const portNumber = 10200;
const treemapUrl = `http://localhost:${portNumber}/dist/gh-pages/treemap/index.html`;
const debugOptions = require('../app/debug.json');

// These tests run in Chromium and have their own timeouts.
// Make sure we get the more helpful test-specific timeout error instead of jest's generic one.
jest.setTimeout(35_000);

describe('Lighthouse Treemap', () => {
  // eslint-disable-next-line no-console
  console.log('\n✨ Be sure to have recently run this: yarn build-treemap');

  /** @type {import('puppeteer').Browser} */
  let browser;
  /** @type {import('puppeteer').Page} */
  let page;
  /** @type {Error[]} */
  let pageErrors = [];

  beforeAll(async function() {
    await server.listen(portNumber, 'localhost');
  });

  afterAll(async function() {
    await Promise.all([
      new Promise(resolve => server.close(resolve)),
      browser && browser.close(),
    ]);
  });

  beforeEach(async () => {
    if (!browser) browser = await puppeteer.launch({headless: true});
    page = await browser.newPage();
    page.on('pageerror', pageError => pageErrors.push(pageError));
  });

  afterEach(async () => {
    await page.close();

    // Fails if any unexpected errors ocurred.
    // If a test expects an error, it will clear this array.
    expect(pageErrors).toMatchObject([]);
    pageErrors = [];
  });

  describe('Recieves options', () => {
    it('from debug data', async () => {
      await page.goto(`${treemapUrl}?debug`, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });
      const options = await page.evaluate(() => window.__treemapOptions);
      expect(options.lhr.requestedUrl).toBe(debugOptions.lhr.requestedUrl);
    });

    async function loadFromPostMessage(options) {
      const openerPage = await browser.newPage();
      await openerPage.evaluate((treemapUrl, options) => {
        const popup = window.open(treemapUrl);
        window.addEventListener('message', () => {
          popup.postMessage(options, new URL(treemapUrl).origin);
        });
      }, treemapUrl, options);
      await new Promise(resolve => browser.on('targetcreated', resolve));
      const target = (await browser.targets()).find(target => target.url() === treemapUrl);
      page = await target.page();
      await page.waitForFunction(
        () => window.__treemapOptions || document.body.textContent.startsWith('Error'));
    }

    it('from window postMessage', async () => {
      await loadFromPostMessage(debugOptions);
      const optionsInPage = await page.evaluate(() => window.__treemapOptions);
      expect(optionsInPage.lhr.requestedUrl).toBe(debugOptions.lhr.requestedUrl);
    });

    it('handles errors', async () => {
      await loadFromPostMessage({});
      const optionsInPage = await page.evaluate(() => window.__treemapOptions);
      expect(optionsInPage).toBeUndefined();
      const error = await page.evaluate(() => document.body.textContent);
      expect(error).toBe('Error: Invalid options');
    });

    async function loadFromFragment(options) {
      const json = JSON.stringify(options);
      const encoded = await page.evaluate(`
        ${fs.readFileSync(require.resolve('pako/dist/pako_deflate.js'))}
        ${fs.readFileSync(
          require.resolve('../../lighthouse-core/report/html/renderer/base64.js'), 'utf-8')}
        Base64.toBinary(${JSON.stringify(json)});
      `);
      await page.goto(`${treemapUrl}#${encoded}`);
      await page.waitForFunction(
        () => window.__treemapOptions || document.body.textContent.startsWith('Error'));
    }

    it('from encoded fragment', async () => {
      const options = JSON.parse(JSON.stringify(debugOptions));
      options.lhr.requestedUrl += '😃😃😃';
      await loadFromFragment(options);
      const optionsInPage = await page.evaluate(() => window.__treemapOptions);
      expect(optionsInPage.lhr.requestedUrl).toBe(options.lhr.requestedUrl);
    });
  });
});