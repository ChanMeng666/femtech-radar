import { describe, expect, test } from 'vitest';
import { stripHtml, truncate } from './strip-html';

describe('stripHtml', () => {
  test('removes tags and decodes common entities', () => {
    const html = '<a href="x">FDA headlines</a>&nbsp;&nbsp;<font color="#666">Contemporary OB/GYN</font>';
    expect(stripHtml(html)).toBe('FDA headlines Contemporary OB/GYN');
  });
  test('leaves plain text intact', () => {
    expect(stripHtml('A plain abstract.')).toBe('A plain abstract.');
  });
  test('decodes decimal and hex numeric entities', () => {
    expect(stripHtml("Tom&#39;s &#x27;quote&#x27; &amp; more")).toBe("Tom's 'quote' & more");
  });
});

describe('truncate', () => {
  test('truncates on a word boundary with an ellipsis', () => {
    expect(truncate('one two three four', 9)).toBe('one two…');
  });
  test('returns short input unchanged', () => {
    expect(truncate('short', 100)).toBe('short');
  });
});
