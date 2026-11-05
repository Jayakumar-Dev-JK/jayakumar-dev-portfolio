import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { UnsavedGuardProvider, useShellGuard, useUnsavedGuard } from './ui';

// A page that registers unsaved work, inside a shell whose links honour it.
function Page({ dirty, save }) {
  const { leave, guardClick } = useUnsavedGuard({ dirty, save, saveLabel: 'Save & leave' });
  return (
    <div>
      <Link to="/admin" onClick={guardClick('/admin')}>Back</Link>
      <button type="button" onClick={() => leave('/admin')}>Cancel</button>
    </div>
  );
}

function Shell({ children }) {
  const { guardClick } = useShellGuard();
  const { pathname } = useLocation();
  return (
    <div>
      <Link to="/admin/categories" onClick={guardClick('/admin/categories')}>Categories</Link>
      <p data-testid="path">{pathname}</p>
      {children}
    </div>
  );
}

function renderGuarded(pageProps) {
  return render(
    <MemoryRouter initialEntries={['/admin/projects/p1']}>
      <UnsavedGuardProvider>
        <Shell>
          <Routes>
            <Route path="/admin/projects/p1" element={<Page {...pageProps} />} />
            <Route path="*" element={<p>elsewhere</p>} />
          </Routes>
        </Shell>
      </UnsavedGuardProvider>
    </MemoryRouter>
  );
}

const path = () => screen.getByTestId('path').textContent;

test('nothing to lose: links and Back leave straight away', () => {
  renderGuarded({ dirty: false });
  fireEvent.click(screen.getByRole('link', { name: 'Back' }));
  expect(path()).toBe('/admin');
  expect(screen.queryByRole('dialog')).toBeNull();
});

test('unsaved changes: Back asks first, and "Keep editing" stays put', async () => {
  renderGuarded({ dirty: true });
  fireEvent.click(screen.getByRole('link', { name: 'Back' }));
  const dialog = await screen.findByRole('dialog');
  expect(dialog).toHaveTextContent('Leave without saving?');
  expect(path()).toBe('/admin/projects/p1');
  // The safe choice has focus, so Enter can never throw work away.
  expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus();

  fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(path()).toBe('/admin/projects/p1');
});

test('"Discard changes" leaves, whichever link started it', async () => {
  renderGuarded({ dirty: true });
  fireEvent.click(screen.getByRole('link', { name: 'Categories' })); // a shell link, not the page's own
  await screen.findByRole('dialog');
  fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
  await waitFor(() => expect(path()).toBe('/admin/categories'));
});

test('the Cancel button uses the same confirmation', async () => {
  renderGuarded({ dirty: true });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(await screen.findByRole('dialog')).toHaveTextContent('Leave without saving?');
});

test('"Save & leave" saves first and only leaves when the save worked', async () => {
  const save = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  renderGuarded({ dirty: true, save });

  fireEvent.click(screen.getByRole('link', { name: 'Back' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save & leave' }));
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
  expect(path()).toBe('/admin/projects/p1'); // validation failed: stay and show the errors

  fireEvent.click(screen.getByRole('link', { name: 'Back' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Save & leave' }));
  await waitFor(() => expect(path()).toBe('/admin'));
  expect(save).toHaveBeenCalledTimes(2);
});

test('a link opened in a new tab (ctrl-click) is not intercepted', () => {
  renderGuarded({ dirty: true });
  fireEvent.click(screen.getByRole('link', { name: 'Back' }), { ctrlKey: true });
  expect(screen.queryByRole('dialog')).toBeNull();
});
