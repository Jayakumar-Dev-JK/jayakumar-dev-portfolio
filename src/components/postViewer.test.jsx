import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PostViewer, { buildSlides } from './postViewer';
import { ProjectCard } from './projects';

const post = {
  id: 'p1',
  slug: 'summer-poster',
  type: 'Design',
  title: 'Summer poster',
  description: 'Poster series',
  tags: ['Photoshop'],
  display: 'gallery',
  href: 'https://www.behance.net/x',
  links: [],
  thumbnail: 'https://res.cloudinary.com/demo/image/upload/a.png',
  thumbnailAlt: 'Front',
  gallery: [
    { url: 'https://res.cloudinary.com/demo/image/upload/a.png', alt: 'Front' },
    { url: 'https://res.cloudinary.com/demo/image/upload/b.png', alt: 'Back' },
    { url: 'https://res.cloudinary.com/demo/image/upload/c.png', alt: '' },
  ],
  categoryIds: ['others'],
};

test('buildSlides puts the video first and falls back to the cover', () => {
  expect(buildSlides({ ...post, videoEmbedUrl: 'https://www.youtube-nocookie.com/embed/x' }).map((s) => s.kind)).toEqual(['embed', 'image', 'image', 'image']);
  expect(buildSlides({ ...post, gallery: [] })).toEqual([{ kind: 'image', src: post.thumbnail, alt: 'Front' }]);
});

test('carousel moves with buttons and arrow keys, and closes with Escape', () => {
  const onClose = jest.fn();
  render(<PostViewer project={post} categoryNames={['Others']} onClose={onClose} />);

  expect(screen.getByRole('dialog', { name: 'Summer poster' })).toBeInTheDocument();
  expect(screen.getByAltText('Front')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Previous image' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Next image' }));
  expect(screen.getByAltText('Back')).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'ArrowRight' });
  expect(screen.getByAltText('Summer poster')).toBeInTheDocument(); // empty alt falls back to the title
  expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Show image 1 of 3' }));
  expect(screen.getByAltText('Front')).toBeInTheDocument();

  fireEvent.keyDown(document, { key: 'Escape' });
  expect(onClose).toHaveBeenCalled();
});

test('link cards open the project page, which carries the external link', () => {
  render(
    <MemoryRouter>
      <ul>
        <ProjectCard project={{ ...post, display: 'link', href: 'https://deskmate.example' }} onOpen={jest.fn()} />
      </ul>
    </MemoryRouter>
  );
  const link = screen.getByRole('link', { name: /Summer poster/ });
  expect(link).toHaveAttribute('href', `/projects/${post.slug}`);
  expect(link).not.toHaveAttribute('target');
});

test('post cards open the popup and show the image count', () => {
  const onOpen = jest.fn();
  render(
    <MemoryRouter>
      <ul>
        <ProjectCard project={post} onOpen={onOpen} />
      </ul>
    </MemoryRouter>
  );
  expect(screen.getByText('3')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Summer poster' }));
  expect(onOpen).toHaveBeenCalledWith(post);
});
