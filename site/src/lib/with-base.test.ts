import { describe, expect, test } from 'vitest';
import { joinBase } from './with-base';

describe('joinBase', () => {
  test('joins base and path without doubling slashes', () => {
    expect(joinBase('/femtech-radar/', '/archive')).toBe('/femtech-radar/archive');
    expect(joinBase('/femtech-radar', 'archive')).toBe('/femtech-radar/archive');
  });
  test('root path yields base root', () => {
    expect(joinBase('/femtech-radar/', '/')).toBe('/femtech-radar/');
  });
});
