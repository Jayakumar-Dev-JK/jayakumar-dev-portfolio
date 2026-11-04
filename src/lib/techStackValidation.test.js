import { parseLogoInput, validateTechCategory, validateTechSkill } from './validation';

describe('validateTechCategory', () => {
  const ok = { name: 'AI Design', icon: 'ai', sortOrder: 1 };
  it('accepts a valid category', () => expect(validateTechCategory(ok)).toEqual({}));
  it('requires a name', () => expect(validateTechCategory({ ...ok, name: '  ' }).name).toBeTruthy());
  it('rejects names with no letters or numbers', () => expect(validateTechCategory({ ...ok, name: '!!!' }).name).toBeTruthy());
  it('rejects bad icon keys and sort orders', () => {
    const errors = validateTechCategory({ ...ok, icon: 'Bad Key', sortOrder: 'x' });
    expect(errors.icon).toBeTruthy();
    expect(errors.sortOrder).toBeTruthy();
  });
});

describe('validateTechSkill', () => {
  const ok = { name: 'React.js', icon: 'react', logoDefault: '', logoHover: '', categoryId: 'development', sortOrder: 0 };
  it('accepts a valid skill', () => expect(validateTechSkill(ok)).toEqual({}));
  it('allows an empty icon (initials tile)', () => expect(validateTechSkill({ ...ok, icon: '' })).toEqual({}));
  it('requires name and category', () => {
    const errors = validateTechSkill({ ...ok, name: '', categoryId: '' });
    expect(errors.name).toBeTruthy();
    expect(errors.categoryId).toBeTruthy();
  });
  it('only accepts https logo URLs or SVG code', () => {
    expect(validateTechSkill({ ...ok, logoDefault: 'http://x.com/a.svg' }).logoDefault).toBeTruthy();
    expect(validateTechSkill({ ...ok, logoHover: 'javascript:alert(1)' }).logoHover).toBeTruthy();
    expect(validateTechSkill({ ...ok, logoDefault: 'https://x.com/a.svg' })).toEqual({});
    expect(validateTechSkill({ ...ok, logoHover: '<svg viewBox="0 0 1 1"><path d="M0 0"/></svg>' })).toEqual({});
  });
});

describe('parseLogoInput', () => {
  it('splits URLs and SVG code', () => {
    expect(parseLogoInput('')).toEqual({ iconUrl: '', iconSvg: '' });
    expect(parseLogoInput(' https://x.com/a.png ')).toEqual({ iconUrl: 'https://x.com/a.png', iconSvg: '' });
    expect(parseLogoInput('<svg><path/></svg>')).toEqual({ iconUrl: '', iconSvg: '<svg xmlns="http://www.w3.org/2000/svg"><path/></svg>' });
  });
  it('rejects unsafe or broken SVG', () => {
    expect(parseLogoInput('<svg onload="x()"></svg>').error).toBeTruthy();
    expect(parseLogoInput('<svg><script>x()</script></svg>').error).toBeTruthy();
    expect(parseLogoInput('<svg><path/>').error).toBeTruthy();
    expect(parseLogoInput('<svg>' + 'a'.repeat(20001) + '</svg>').error).toBeTruthy();
  });
});
