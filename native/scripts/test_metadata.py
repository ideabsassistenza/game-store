# Copyright (C) 2026 half144 and PS5 React contributors
# SPDX-License-Identifier: GPL-3.0-or-later
# Additional attribution term: see LICENSE-ATTRIBUTION.
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('enrich', Path(__file__).with_name('enrich-metadata.py'))
enrich = importlib.util.module_from_spec(spec)
spec.loader.exec_module(enrich)


def page(product_id, classification='FULL_GAME'):
    product = {'id': product_id, 'topCategory': 'GAME', 'storeDisplayClassification': classification,
               'descriptions': [{'type': 'SHORT', 'value': 'Fight &amp; explore.'}],
               'concept': {'__ref': 'Concept:1'}}
    first = {'cache': {'Product:' + product_id: product}}
    second = {'cache': {'Product:' + product_id: {'publisherName': 'A Studio'},
                        'Concept:1': {'media': [
                            {'role': 'SCREENSHOT', 'type': 'IMAGE', 'url': 'https://example.com/shot.jpg'},
                            {'role': 'SCREENSHOT', 'type': 'IMAGE', 'url': 'https://example.com/shot.webp'}]}}}
    data = {'props': {'pageProps': {'batarangs': {str(i): {'text': '<script type="application/json">' + json.dumps(value) + '</script>'} for i, value in enumerate([first, second])}}}}
    return '<script id="__NEXT_DATA__">' + json.dumps(data).replace('<', '\\u003c') + '</script>'


class MetadataTests(unittest.TestCase):
    def test_merges_fragments_for_requested_product_and_filters_images(self):
        result = enrich.parse_store(page('UP0000-PPSA00001_00-TEST'), 'UP0000-PPSA00001_00-TEST')
        self.assertEqual(result['publisher'], 'A Studio')
        self.assertEqual(result['shortDescription'], 'Fight & explore.')
        self.assertEqual(result['screenshots'], ['https://example.com/shot.jpg'])
        self.assertEqual(result['images']['hero'], 'https://example.com/shot.jpg')

    def test_rejects_dlc_or_wrong_product(self):
        for product_id, classification in [('OTHER', 'FULL_GAME'), ('TEST', 'ADD_ON')]:
            with self.assertRaises(ValueError):
                enrich.parse_store(page(product_id, classification), 'TEST')

    def test_accepts_full_game_premium_editions(self):
        result = enrich.parse_store(page('TEST', 'PREMIUM_EDITION'), 'TEST')
        self.assertEqual(result['shortDescription'], 'Fight & explore.')

    def test_title_matching_preserves_sequels_and_expansions(self):
        self.assertEqual(enrich.title_key('Wo Long: Fallen Dynasty (PS4 & PS5)'), enrich.title_key('Wo Long Fallen Dynasty'))
        self.assertNotEqual(enrich.title_key('Wo Long 2: Wings of Ember'), enrich.title_key('Wo Long: Fallen Dynasty'))
        self.assertNotEqual(enrich.title_key('Elden Ring'), enrich.title_key('Elden Ring Shadow of the Erdtree'))


if __name__ == '__main__':
    unittest.main()
