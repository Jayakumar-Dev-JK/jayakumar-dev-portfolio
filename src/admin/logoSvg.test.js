import { SKILL_ICONS } from '../components/techIcon';
import { parseLogoInput } from '../lib/validation';
import { builtInLogoSvg, logoInputValue, needsLogoSync, resolveSkillLogos } from './logoSvg';

jest.mock('../services/mediaService', () => ({ uploadLogo: jest.fn(), deleteLogoFile: jest.fn() }));
const { uploadLogo } = require('../services/mediaService');

// CRA resets mock implementations before each test, so set it here.
beforeEach(() => {
  uploadLogo.mockImplementation(async (source, variant) => ({
    url: `https://res.cloudinary.com/demo/image/upload/PortFolio/tech-stack/${variant}/logo.svg`,
    publicId: `PortFolio/tech-stack/${variant}/${typeof source === 'string' ? 'remote' : source.name}`,
  }));
});

describe('builtInLogoSvg', () => {
  it('builds stand-alone SVGs for both versions', () => {
    const hover = builtInLogoSvg('mongodb', 'hover');
    expect(hover).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(hover).toContain('#47A248');
    expect(builtInLogoSvg('mongodb', 'default')).not.toContain('#47A248');
    expect(builtInLogoSvg('mongodb', 'default')).toContain('#FFFFFF');
  });

  it('uses the real brand looks', () => {
    expect(builtInLogoSvg('openai', 'hover')).toContain('#10A37F'); // ChatGPT green tile
    expect(builtInLogoSvg('gemini', 'hover')).toContain('linearGradient');
    expect(builtInLogoSvg('aws', 'hover')).toContain('#FF9900');
    expect(builtInLogoSvg('figma', 'hover')).toContain('#A259FF');
    expect(builtInLogoSvg('photoshop', 'hover')).toContain('#001E36');
  });

  it('returns nothing for skills without a built-in logo', () => {
    expect(builtInLogoSvg('', 'hover')).toBe('');
  });

  it('every built-in logo passes the pasted-SVG checks in both versions', () => {
    Object.keys(SKILL_ICONS).forEach((key) => {
      ['default', 'hover'].forEach((variant) => {
        const result = parseLogoInput(builtInLogoSvg(key, variant));
        expect(result.error).toBeUndefined();
        expect(result.iconSvg).toBeTruthy();
      });
    });
  });
});

describe('resolveSkillLogos', () => {
  it('uploads nothing for built-in logos (they are shared cloud files)', async () => {
    const r = await resolveSkillLogos({ name: 'MongoDB', icon: 'mongodb', logoDefault: '', logoHover: '' });
    expect(uploadLogo).not.toHaveBeenCalled();
    expect(r).toEqual({ logoDefault: null, logoHover: null, replaced: [] });
  });

  it('uploads custom logos into the folder for their version', async () => {
    const r = await resolveSkillLogos({ name: 'UX Pilot', icon: '', logoDefault: '<svg><path/></svg>', logoHover: '<svg><rect/></svg>' });
    expect(uploadLogo.mock.calls.map((c) => c[1])).toEqual(['default', 'hover']);
    expect(r.logoHover).toMatchObject({ source: 'custom' });
    expect(r.logoHover.publicId).toContain('tech-stack/hover');
  });

  it('keeps unchanged files and replaces changed ones', async () => {
    const existing = {
      logoDefault: { url: 'https://res.cloudinary.com/a.svg', publicId: 'd1', source: 'builtin', iconKey: 'mongodb' },
      logoHover: { url: 'https://res.cloudinary.com/b.svg', publicId: 'h1', source: 'custom', iconKey: '' },
    };
    const r = await resolveSkillLogos({ name: 'MongoDB', icon: 'mongodb', logoDefault: '', logoHover: '<svg><path/></svg>' }, existing);
    expect(uploadLogo).toHaveBeenCalledTimes(1);
    expect(r.logoDefault).toBeNull(); // back to the shared built-in file
    expect(r.replaced).toContain('d1');
    expect(r.logoHover.source).toBe('custom');
    expect(r.replaced).toContain('h1');
  });

  it('uploads a pasted URL as a remote file and rejects bad input', async () => {
    await resolveSkillLogos({ name: 'UX Pilot', icon: '', logoDefault: '', logoHover: 'https://x.com/logo.png' });
    expect(uploadLogo).toHaveBeenCalledWith('https://x.com/logo.png', 'hover');
    await expect(resolveSkillLogos({ name: 'X', icon: '', logoDefault: 'http://x', logoHover: '' })).rejects.toThrow(/Default logo/);
  });
});

describe('pasted SVG code', () => {
  it('adds the missing xmlns so Cloudinary and <img> accept it', async () => {
    expect(parseLogoInput('<svg viewBox="0 0 1 1"><path/></svg>').iconSvg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path/></svg>'
    );
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>';
    expect(parseLogoInput(svg).iconSvg).toBe(svg);
    expect(parseLogoInput('<svg><use xlink:href="#a"/></svg>').iconSvg).toContain('xmlns:xlink=');

    await resolveSkillLogos({ name: 'UX Pilot', icon: '', logoDefault: '<svg><path/></svg>', logoHover: '' });
    const file = uploadLogo.mock.calls[0][0];
    expect(file.type).toBe('image/svg+xml');
    // The browser sends the SVG as-is; the server adds the XML declaration.
    expect(await new Response(file).text()).toContain('xmlns="http://www.w3.org/2000/svg"');
  });
});

describe('logo sync helpers', () => {
  it('only shows custom logos in the form', () => {
    expect(logoInputValue({ logoHover: { url: 'u', source: 'custom' } }, 'hover')).toBe('u');
    expect(logoInputValue({ logoHover: { url: 'u', source: 'builtin' } }, 'hover')).toBe('');
    expect(logoInputValue({ icon: '', iconSvg: '<svg/>' }, 'hover')).toBe('<svg/>');
  });

  it('finds skills whose logos are not in the cloud', () => {
    expect(needsLogoSync({ icon: 'react' })).toBe(false);
    expect(needsLogoSync({ icon: '' })).toBe(false);
    expect(needsLogoSync({ icon: '', iconUrl: 'https://x.com/a.png' })).toBe(true);
  });
});
