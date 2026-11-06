import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import IconMarquee from './skills';
import { monogram } from './techIcon';

jest.mock('../services/publicTechStackService', () => ({ fetchPublicTechStack: jest.fn() }));
const { fetchPublicTechStack } = require('../services/publicTechStackService');

const categories = [
  {
    id: 'development', name: 'Development', icon: 'code',
    skills: [
      { id: 'a', name: 'React.js', icon: 'react', iconUrl: '' },
      { id: 'b', name: 'UX Pilot', icon: '', iconUrl: '' },
    ],
  },
];

describe('Tech stack section', () => {
  it('renders categories and skills from the service', async () => {
    fetchPublicTechStack.mockResolvedValue(categories);
    render(<IconMarquee />);
    expect(await screen.findByRole('heading', { name: 'Development' })).toBeInTheDocument();
    expect(screen.getByText('React.js')).toBeInTheDocument();
    expect(screen.getByText('UX Pilot')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    fetchPublicTechStack.mockResolvedValue([]);
    render(<IconMarquee />);
    expect(await screen.findByText(/No technologies to show/)).toBeInTheDocument();
  });

  it('shows an error state with retry', async () => {
    fetchPublicTechStack.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(categories);
    render(<IconMarquee />);
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load");
    userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('React.js')).toBeInTheDocument();
  });
});

describe('monogram', () => {
  it('builds initials', () => {
    expect(monogram('UX Pilot')).toBe('UP');
    expect(monogram('Figma')).toBe('Fi');
    expect(monogram('')).toBe('?');
  });
});

describe('built-in logos', () => {
  it('load from the Cloudinary files', async () => {
    fetchPublicTechStack.mockResolvedValue(categories);
    const { container } = render(<IconMarquee />);
    await screen.findByText('React.js');
    const sources = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(sources.some((src) => /res\.cloudinary\.com\/.*tech-stack\/default\/default-react\.svg$/.test(src))).toBe(true);
    expect(sources.some((src) => /tech-stack\/hover\/hover-react\.svg$/.test(src))).toBe(true);
  });
});
