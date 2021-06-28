/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
/**
 * @fileoverview Checks to see if the images used on the page are larger than
 *   their display sizes. The audit will list all images that are larger than
 *   their display size with DPR (a 1000px wide image displayed as a
 *   500px high-res image on a Retina display is 100% used);
 */
'use strict';

const Audit = require('../audit.js');
const UsesResponsiveImages = require('./uses-responsive-images.js');
const URL = require('../../lib/url-shim.js');
const i18n = require('../../lib/i18n/i18n.js');

const UIStrings = {
  /** Label for a column in a data table; entries will be the dimensions of an image as it appears on the page. */
  columnDisplayedDimensions: 'Displayed dimensions',
  /** Label for a column in a data table; entries will be the dimensions of an image from it's source file. */
  columnActualDimensions: 'Actual dimensions',
};

Object.assign(UIStrings, UsesResponsiveImages.UIStrings);

const str_ = i18n.createMessageInstanceIdFn(__filename, UIStrings);

class UsesResponsiveImagesSnapshot extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'uses-responsive-images-snapshot',
      // @ts-ignore Title imported from UsesResponsiveImages.
      title: str_(UIStrings.title),
      // @ts-ignore Description imported from UsesResponsiveImages.
      description: str_(UIStrings.description),
      supportedModes: ['snapshot'],
      requiredArtifacts: ['ImageElements', 'ViewportDimensions'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts) {
    /** @type {LH.Audit.Details.TableItem[]} */
    const items = [];
    for (const image of artifacts.ImageElements) {
      if (!image.naturalDimensions) continue;
      const actual = image.naturalDimensions;
      const displayed = UsesResponsiveImages.getDisplayedDimensions(
        {...image, naturalWidth: actual.width, naturalHeight: actual.height},
        artifacts.ViewportDimensions
      );

      const actualPixels = actual.width * actual.height *
        Math.pow(artifacts.ViewportDimensions.devicePixelRatio, 2);
      const usedPixels = displayed.width * displayed.height *
        Math.pow(artifacts.ViewportDimensions.devicePixelRatio, 2);

      if (actualPixels <= usedPixels) continue;

      items.push({
        url: URL.elideDataURI(image.src),
        displayedDimensions: `${displayed.width}x${displayed.height}`,
        actualDimensions: `${actual.width}x${actual.height}`,
      });
    }

    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      /* eslint-disable max-len */
      {key: 'url', itemType: 'thumbnail', text: ''},
      {key: 'url', itemType: 'url', text: str_(i18n.UIStrings.columnURL)},
      {key: 'displayedDimensions', itemType: 'text', text: str_(UIStrings.columnDisplayedDimensions)},
      {key: 'actualDimensions', itemType: 'text', text: str_(UIStrings.columnActualDimensions)},
      /* eslint-enable max-len */
    ];

    const details = Audit.makeTableDetails(headings, items);

    return {
      score: items.length ? 0 : 1,
      details,
    };
  }
}

module.exports = UsesResponsiveImagesSnapshot;
module.exports.UIStrings = UIStrings;
